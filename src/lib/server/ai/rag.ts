/**
 * RAG retrieval híbrido com PREFERÊNCIA EXPLÍCITA POR ACSM > AHA.
 *
 * Pipeline:
 *   1. Embed query (Gemini RETRIEVAL_QUERY)
 *   2. Vector search topK em knowledge_chunks (cosine distance)
 *   3. Reranking por organização: distance final = raw_distance - org_boost
 *      onde ACSM ganha bônus maior que AHA
 *   4. Diversificação por fonte (cap em ⌈K/3⌉ chunks/source)
 *   5. Retorna chunks com metadado completo
 */
import { sql as sqlOp, type SQL } from 'drizzle-orm';
import { embed } from 'ai';
import { google } from './provider';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

/**
 * Boost por organização — distância FINAL = raw_distance - boost.
 * Valor positivo = chunk fica MELHOR ranqueado (distância menor).
 *
 * Decisão de produto: ACSM tem PRIORIDADE absoluta sobre AHA.
 * - ACSM: bonus de 0.05 (significativo — equivale a ~25% mais próximo no ranking)
 * - AHA: penalty de -0.02 (chunks AHA descem no ranking)
 * - Outras orgs: neutro (0)
 *
 * Tunável conforme feedback clínico. Mudar este map basta — o resto
 * do pipeline lê daqui.
 */
const ORG_BOOST: Record<string, number> = {
	acsm: 0.05,
	aha: -0.02,
	oms: 0.01,
	essa: 0.01,
	sbmfe: 0.01,
	ada: 0.01,
	esc: 0.01,
	ministerio_saude: 0.0,
	sbc: 0.0,
	sbd: 0.0,
	outro: 0.0
};

export type RetrievedChunk = {
	chunk_id: string;
	source_id: string;
	source_title: string;
	source_organization: string;
	source_year: number | null;
	page_number: number | null;
	content: string;
	raw_distance: number;
	final_distance: number;
	org_boost: number;
	population_tags: string[];
	category: string;
};

export type RetrievalQuery = {
	conditionTags: string[];
	goals: string[];
	freeText?: string;
	topK?: number;
};

const EMBED_MODEL = env.AI_MODEL_EMBEDDING ?? 'gemini-embedding-001';
const EMBED_DIMS = 768;

function buildQueryText(q: RetrievalQuery): string {
	const parts: string[] = [];
	if (q.conditionTags.length) parts.push(`Condições clínicas: ${q.conditionTags.join(', ')}.`);
	if (q.goals.length) parts.push(`Objetivos do aluno: ${q.goals.join(', ')}.`);
	if (q.freeText) parts.push(q.freeText);
	parts.push(
		'Quero recomendações de prescrição de exercício (intensidade, frequência, contraindicações, monitoramento) baseadas em diretrizes — preferindo ACSM, depois ESSA/ADA/OMS, e por último AHA — e estudos peer-reviewed.'
	);
	return parts.join(' ');
}

async function embedQuery(text: string): Promise<number[]> {
	const { embedding } = await embed({
		model: google.textEmbeddingModel(EMBED_MODEL),
		value: text,
		// Embed costuma ser <2s. Abort em 20s pra impedir que o RAG trave a
		// função e estoure o maxDuration de 60s sem nem chegar na IA.
		abortSignal: AbortSignal.timeout(20_000),
		providerOptions: {
			google: { outputDimensionality: EMBED_DIMS, taskType: 'RETRIEVAL_QUERY' }
		}
	});
	return embedding;
}

type ChunkRow = {
	chunk_id: string;
	source_id: string;
	source_title: string;
	source_organization: string;
	source_year: number | null;
	page_number: number | null;
	content: string;
	distance: number;
	population_tags: string[];
	category: string;
};

async function vectorSearch(
	embeddingLiteral: string,
	tagFilter: SQL | null,
	limit: number
): Promise<ChunkRow[]> {
	return (await db.execute(sqlOp`
		select
			kc.id            as chunk_id,
			kc.source_id     as source_id,
			ks.title         as source_title,
			ks.organization::text as source_organization,
			ks.year          as source_year,
			kc.page_number   as page_number,
			kc.content       as content,
			(kc.embedding <=> ${embeddingLiteral}::vector)::float as distance,
			ks.population_tags as population_tags,
			ks.category::text as category
		from public.knowledge_chunks kc
		join public.knowledge_sources ks on ks.id = kc.source_id
		where kc.embedding is not null
			${tagFilter ? sqlOp`and ${tagFilter}` : sqlOp``}
		order by kc.embedding <=> ${embeddingLiteral}::vector
		limit ${limit}
	`)) as unknown as ChunkRow[];
}

function applyOrgBoost(rows: ChunkRow[]): RetrievedChunk[] {
	return rows.map((r) => {
		const boost = ORG_BOOST[r.source_organization] ?? 0;
		return {
			chunk_id: r.chunk_id,
			source_id: r.source_id,
			source_title: r.source_title,
			source_organization: r.source_organization,
			source_year: r.source_year,
			page_number: r.page_number,
			content: r.content,
			raw_distance: r.distance,
			final_distance: r.distance - boost,
			org_boost: boost,
			population_tags: r.population_tags,
			category: r.category
		};
	});
}

export async function retrieveRelevantChunks(q: RetrievalQuery): Promise<RetrievedChunk[]> {
	const k = q.topK ?? 8;
	const queryText = buildQueryText(q);
	const startMs = Date.now();

	const embedding = await embedQuery(queryText);
	const embeddingLiteral = `[${embedding.join(',')}]`;

	// Fase 1: filtrada por tag (se houver)
	let taggedRows: ChunkRow[] = [];
	if (q.conditionTags.length > 0) {
		const arrayLiteral = '{' + q.conditionTags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',') + '}';
		const tagFilter = sqlOp`ks.population_tags ?| ${arrayLiteral}::text[]`;
		taggedRows = await vectorSearch(embeddingLiteral, tagFilter, k * 2);
	}

	// Fase 2: busca aberta (recupera ACSM/AHA/OMS sem tag específica)
	const openRows = await vectorSearch(embeddingLiteral, null, k * 3);

	// Merge dedup
	const byId = new Map<string, ChunkRow>();
	for (const r of [...taggedRows, ...openRows]) {
		const cur = byId.get(r.chunk_id);
		if (!cur || r.distance < cur.distance) byId.set(r.chunk_id, r);
	}

	// APLICA BOOST POR ORGANIZAÇÃO + reordena por final_distance
	const boosted = applyOrgBoost(Array.from(byId.values())).sort(
		(a, b) => a.final_distance - b.final_distance
	);

	// Diversificação por fonte
	const perSourceCap = Math.max(2, Math.ceil(k / 3));
	const sourceCount = new Map<string, number>();
	const diversified: RetrievedChunk[] = [];
	const overflow: RetrievedChunk[] = [];
	for (const r of boosted) {
		const cur = sourceCount.get(r.source_id) ?? 0;
		if (cur < perSourceCap) {
			diversified.push(r);
			sourceCount.set(r.source_id, cur + 1);
		} else {
			overflow.push(r);
		}
		if (diversified.length >= k) break;
	}
	if (diversified.length < k) {
		for (const r of overflow) {
			diversified.push(r);
			if (diversified.length >= k) break;
		}
	}

	// Telemetria — quantos ACSM vs AHA no top-K final
	const orgCounts = diversified.reduce<Record<string, number>>((acc, r) => {
		acc[r.source_organization] = (acc[r.source_organization] ?? 0) + 1;
		return acc;
	}, {});
	const elapsed = Date.now() - startMs;
	logger.info(
		{
			tags: q.conditionTags,
			tagged_hits: taggedRows.length,
			open_hits: openRows.length,
			merged: byId.size,
			returned: diversified.length,
			unique_sources: new Set(diversified.map((r) => r.source_id)).size,
			org_distribution: orgCounts,
			top_org: diversified[0]?.source_organization,
			top_raw_distance: diversified[0]?.raw_distance,
			top_final_distance: diversified[0]?.final_distance,
			elapsed_ms: elapsed
		},
		'rag.retrieve.done'
	);

	return diversified;
}

/**
 * Formata chunks pro CONTEXTO CLÍNICO do prompt — preserva chunk_id
 * pra IA poder citá-lo em source_refs. Marca explicitamente quando
 * a fonte é ACSM (preferida) pra IA dar o peso devido.
 */
export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
	if (chunks.length === 0) {
		return '(nenhum chunk relevante recuperado — gerar com base em conhecimento geral, marcando todas as recomendações como source: inference)';
	}
	return chunks
		.map((c, i) => {
			const orgUpper = c.source_organization.toUpperCase();
			const orgPriority =
				c.org_boost > 0.03
					? '★ ALTA PREFERÊNCIA'
					: c.org_boost > 0
						? '◆ alta'
						: c.org_boost < 0
							? '○ baixa'
							: '·';
			const meta = [orgUpper, c.source_year, c.page_number ? `p.${c.page_number}` : null]
				.filter(Boolean)
				.join(' · ');
			return [
				`[#${i + 1}] chunk_id=${c.chunk_id}  ${orgPriority}`,
				`source="${c.source_title}" (${meta})`,
				`tags=${(c.population_tags ?? []).join(', ') || '—'}`,
				`distance=${c.raw_distance.toFixed(3)} (after_boost=${c.final_distance.toFixed(3)})`,
				`---`,
				c.content.slice(0, 1800),
				`---`
			].join('\n');
		})
		.join('\n\n');
}

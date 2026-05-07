/**
 * Verificação RAG no BR — contagens, distribuição por organização,
 * busca semântica de teste com ranking ACSM > AHA.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });

console.log('━━━ DIAGNÓSTICO RAG ━━━\n');

const [s] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM knowledge_sources`;
const [c] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM knowledge_chunks`;
const [withEmb] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM knowledge_chunks WHERE embedding IS NOT NULL`;
console.log(`fontes:        ${s!.n}`);
console.log(`chunks:        ${c!.n}`);
console.log(`com embedding: ${withEmb!.n}`);
console.log();

console.log('━ por organização ━');
const orgs = await sql<{ organization: string; n: number }[]>`
	SELECT organization::text, count(*)::int n
	FROM knowledge_sources
	GROUP BY organization
	ORDER BY n DESC
`;
for (const o of orgs) console.log(`  ${o.organization.padEnd(20)} ${o.n}`);
console.log();

console.log('━ por categoria ━');
const cats = await sql<{ category: string; n: number }[]>`
	SELECT category::text, count(*)::int n
	FROM knowledge_sources
	GROUP BY category
	ORDER BY n DESC
`;
for (const c of cats) console.log(`  ${c.category.padEnd(28)} ${c.n}`);
console.log();

// Teste de busca semântica
const query = 'hipertensão arterial exercício resistido contraindicação';
console.log(`━ busca: "${query}" ━`);

const { embedding } = await embed({
	model: google.textEmbeddingModel(process.env.AI_MODEL_EMBEDDING ?? 'gemini-embedding-001'),
	value: query,
	providerOptions: { google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' } }
});
const embLit = `[${embedding.join(',')}]`;

console.log('\nsem boost (ranking puro por distância):');
const raw = await sql<{ title: string; org: string; distance: number; snippet: string }[]>`
	SELECT
		ks.title, ks.organization::text AS org,
		(kc.embedding <=> ${embLit}::vector)::float AS distance,
		substring(kc.content, 1, 100) AS snippet
	FROM knowledge_chunks kc
	JOIN knowledge_sources ks ON ks.id = kc.source_id
	WHERE kc.embedding IS NOT NULL
	ORDER BY kc.embedding <=> ${embLit}::vector
	LIMIT 8
`;
for (const r of raw) {
	console.log(`  [${r.distance.toFixed(3)}] ${r.org.padEnd(8)} ${r.title.slice(0, 50)}`);
}

console.log('\ncom boost ACSM (-0.05) e AHA (+0.02):');
const boosted = await sql<{ title: string; org: string; distance: number; final: number }[]>`
	SELECT
		ks.title, ks.organization::text AS org,
		(kc.embedding <=> ${embLit}::vector)::float AS distance,
		(
			(kc.embedding <=> ${embLit}::vector)::float
			- CASE ks.organization::text WHEN 'acsm' THEN 0.05 ELSE 0 END
			+ CASE ks.organization::text WHEN 'aha' THEN 0.02 ELSE 0 END
		)::float AS final
	FROM knowledge_chunks kc
	JOIN knowledge_sources ks ON ks.id = kc.source_id
	WHERE kc.embedding IS NOT NULL
	ORDER BY final ASC
	LIMIT 8
`;
for (const r of boosted) {
	console.log(`  [${r.final.toFixed(3)}] ${r.org.padEnd(8)} ${r.title.slice(0, 50)} (raw ${r.distance.toFixed(3)})`);
}

await sql.end();

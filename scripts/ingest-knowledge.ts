/**
 * Ingestão de documento na base de conhecimento (RAG).
 *
 * Até aqui existia script pra ingerir CATÁLOGO DE EXERCÍCIOS e nenhum pra
 * ingerir DIRETRIZ. Os 2.040 chunks das 49 fontes atuais entraram por um
 * caminho que não ficou no repositório, então subir material novo (HIV, LCA
 * 6-12 meses, ACC 2026) exigia refazer isso do zero toda vez.
 *
 * Uso:
 *   tsx scripts/ingest-knowledge.ts <arquivo> --title "..." [opções]
 *
 * Opções:
 *   --title <t>      obrigatório. Título que aparece na citação do plano.
 *   --org <o>        acsm|aha|ada|oms|esc|essa|sbc|sbd|sbmfe|ministerio_saude|outro
 *   --category <c>   diretriz_oficial|estudo_clinico|revisao_sistematica|posicionamento|guia_pratico
 *   --year <a>       ano da publicação
 *   --authors <a,b>  autores separados por vírgula
 *   --tags <a,b>     population_tags (tags da condition_taxonomy)
 *   --url <u>        link ou DOI da fonte
 *   --dry-run        extrai e fatia sem gravar nada nem gastar embedding
 *   --reingest       refaz os chunks de uma fonte já ingerida (mesmo arquivo)
 *
 * Formatos: .docx (mammoth), .pdf (pdfjs, com número de página), .txt/.md.
 *
 * Idempotente por arquivo: `knowledge_sources.file_hash` é UNIQUE sobre o
 * sha256 do arquivo, então rodar de novo não duplica fonte. Dentro da fonte,
 * `(source_id, content_hash)` também é UNIQUE, então chunk repetido é pulado.
 *
 * ATENÇÃO ao modelo de embedding: a base inteira foi embedada com
 * gemini-embedding-001 em 768 dimensões. Trocar o modelo aqui obriga a
 * re-embedar os 2.040 chunks, senão a busca compara vetores de espaços
 * diferentes e devolve lixo com cara de resultado.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postgres from 'postgres';
import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const EMBED_MODEL = process.env.AI_MODEL_EMBEDDING ?? 'gemini-embedding-001';
const EMBED_DIMS = 768;

/**
 * Alvo de ~4.000 caracteres por chunk. A base atual tem média de 5.900 e vai
 * de 960 a 13.680, então isto fica dentro da distribuição que o retrieval já
 * enfrenta, com margem pro teto de tokens do embedding. O corte respeita
 * parágrafo: cortar no meio de uma recomendação clínica é o que produz chunk
 * que cita intensidade sem dizer de qual condição.
 */
const CHUNK_ALVO = 4000;
const CHUNK_MIN = 700;

type Opts = {
	title: string;
	org: string;
	category: string;
	year: number | null;
	authors: string[];
	tags: string[];
	url: string | null;
	dryRun: boolean;
	reingest: boolean;
};

const ORGS = [
	'acsm',
	'aha',
	'ada',
	'oms',
	'esc',
	'essa',
	'sbc',
	'sbd',
	'sbmfe',
	'ministerio_saude',
	'outro'
];
const CATEGORIAS = [
	'diretriz_oficial',
	'estudo_clinico',
	'revisao_sistematica',
	'posicionamento',
	'guia_pratico'
];

function parseArgs(argv: string[]): { file: string; opts: Opts } {
	const file = argv[0];
	if (!file || file.startsWith('--')) {
		console.error('Uso: tsx scripts/ingest-knowledge.ts <arquivo> --title "..." [opções]');
		process.exit(1);
	}
	const get = (name: string): string | undefined => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const has = (name: string) => argv.includes(`--${name}`);
	const lista = (v: string | undefined) =>
		(v ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

	const title = get('title');
	if (!title) {
		console.error('--title é obrigatório: é o texto que aparece na citação dentro do plano.');
		process.exit(1);
	}
	const org = get('org') ?? 'outro';
	if (!ORGS.includes(org)) {
		console.error(`--org inválido: ${org}. Valores: ${ORGS.join(', ')}`);
		process.exit(1);
	}
	const category = get('category') ?? 'diretriz_oficial';
	if (!CATEGORIAS.includes(category)) {
		console.error(`--category inválida: ${category}. Valores: ${CATEGORIAS.join(', ')}`);
		process.exit(1);
	}
	const yearRaw = get('year');
	return {
		file,
		opts: {
			title,
			org,
			category,
			year: yearRaw ? Number(yearRaw) : null,
			authors: lista(get('authors')),
			tags: lista(get('tags')),
			url: get('url') ?? null,
			dryRun: has('dry-run'),
			reingest: has('reingest')
		}
	};
}

/** Trecho de texto com a página de onde saiu (null fora de PDF). */
type Trecho = { page: number | null; text: string };

async function extrair(file: string): Promise<{ trechos: Trecho[]; pageCount: number | null }> {
	const ext = path.extname(file).toLowerCase();

	if (ext === '.docx') {
		const mammoth = await import('mammoth');
		const { value } = await mammoth.extractRawText({ path: file });
		return { trechos: [{ page: null, text: value }], pageCount: null };
	}

	if (ext === '.pdf') {
		// Build "legacy": o moderno depende de APIs de browser e quebra no Node.
		const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
		const doc = await pdfjs.getDocument({
			data: new Uint8Array(fs.readFileSync(file)),
			useSystemFonts: true
		}).promise;
		const trechos: Trecho[] = [];
		for (let p = 1; p <= doc.numPages; p++) {
			const page = await doc.getPage(p);
			const content = await page.getTextContent();
			const text = content.items
				.map((i: unknown) => (i as { str?: string }).str ?? '')
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
			if (text) trechos.push({ page: p, text });
		}
		return { trechos, pageCount: doc.numPages };
	}

	if (ext === '.txt' || ext === '.md') {
		return { trechos: [{ page: null, text: fs.readFileSync(file, 'utf8') }], pageCount: null };
	}

	console.error(`Formato não suportado: ${ext}. Use .docx, .pdf, .txt ou .md.`);
	process.exit(1);
}

/**
 * Fatia respeitando parágrafo. Junta parágrafos até passar do alvo; parágrafo
 * sozinho maior que o alvo é quebrado por frase, e só então na força.
 */
function fatiar(trechos: Trecho[]): Trecho[] {
	const out: Trecho[] = [];

	for (const t of trechos) {
		const paragrafos = t.text
			.split(/\n{2,}|\r\n{2,}/)
			.map((p) => p.replace(/[ \t]+/g, ' ').trim())
			.filter(Boolean);

		let buf = '';
		const push = () => {
			const texto = buf.trim();
			if (texto) out.push({ page: t.page, text: texto });
			buf = '';
		};

		for (const p of paragrafos) {
			if (p.length > CHUNK_ALVO) {
				push();
				const frases = p.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [p];
				let sub = '';
				for (const f of frases) {
					if (sub.length + f.length > CHUNK_ALVO && sub) {
						out.push({ page: t.page, text: sub.trim() });
						sub = '';
					}
					// Frase única monstruosa (tabela virada em texto): corta na marra.
					if (f.length > CHUNK_ALVO) {
						for (let i = 0; i < f.length; i += CHUNK_ALVO)
							out.push({ page: t.page, text: f.slice(i, i + CHUNK_ALVO).trim() });
						continue;
					}
					sub += f;
				}
				if (sub.trim()) out.push({ page: t.page, text: sub.trim() });
				continue;
			}
			if (buf.length + p.length > CHUNK_ALVO) push();
			buf += (buf ? '\n\n' : '') + p;
		}
		push();
	}

	// Rabicho curto demais vira contexto sem sentido no retrieval: cola no
	// anterior da MESMA página.
	const juntos: Trecho[] = [];
	for (const c of out) {
		const anterior = juntos[juntos.length - 1];
		if (c.text.length < CHUNK_MIN && anterior && anterior.page === c.page) {
			anterior.text += '\n\n' + c.text;
			continue;
		}
		juntos.push({ ...c });
	}
	return juntos;
}

const google = createGoogleGenerativeAI({
	apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!
});

async function embedar(texto: string): Promise<number[]> {
	let ultimo: unknown;
	for (let tentativa = 0; tentativa < 3; tentativa++) {
		try {
			const { embedding } = await embed({
				model: google.textEmbeddingModel(EMBED_MODEL),
				value: texto,
				abortSignal: AbortSignal.timeout(30_000),
				// RETRIEVAL_DOCUMENT, não RETRIEVAL_QUERY: é o lado do documento.
				// O rag.ts usa QUERY na busca, que é o par correto deste.
				providerOptions: {
					google: { outputDimensionality: EMBED_DIMS, taskType: 'RETRIEVAL_DOCUMENT' }
				}
			});
			return embedding;
		} catch (err) {
			ultimo = err;
			await new Promise((r) => setTimeout(r, 2000 * (tentativa + 1)));
		}
	}
	throw ultimo;
}

const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');

// ─────────────────────────────────────────────────────────────────────────────

const { file, opts } = parseArgs(process.argv.slice(2));
if (!fs.existsSync(file)) {
	console.error(`Arquivo não encontrado: ${file}`);
	process.exit(1);
}

const bytes = fs.readFileSync(file);
const fileHash = sha(bytes);

console.log(`arquivo   ${path.basename(file)} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`hash      ${fileHash.slice(0, 16)}…`);

const { trechos, pageCount } = await extrair(file);
const chunks = fatiar(trechos);
const chars = chunks.reduce((n, c) => n + c.text.length, 0);

console.log(`título    ${opts.title}`);
console.log(`fonte     ${opts.org} · ${opts.category}${opts.year ? ` · ${opts.year}` : ''}`);
console.log(`tags      ${opts.tags.join(', ') || '(nenhuma)'}`);
console.log(`páginas   ${pageCount ?? 'n/a'}`);
console.log(`chunks    ${chunks.length} · ${chars.toLocaleString('pt-BR')} chars no total`);

if (chunks.length === 0) {
	console.error('\nNenhum texto extraído. PDF escaneado precisa de OCR antes.');
	process.exit(1);
}

console.log('\n── amostra do primeiro chunk ──');
console.log(chunks[0]!.text.slice(0, 400).replace(/\s+/g, ' ') + '…\n');

if (opts.dryRun) {
	console.log('--dry-run: nada foi gravado e nenhum embedding foi gasto.');
	process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const [existente] = await sql<Array<{ id: string; title: string }>>`
	SELECT id, title FROM knowledge_sources WHERE file_hash = ${fileHash}`;

if (existente && !opts.reingest) {
	const [{ n }] = await sql<Array<{ n: number }>>`
		SELECT count(*)::int n FROM knowledge_chunks WHERE source_id = ${existente.id}`;
	console.log(`\nEsse arquivo já está na base como "${existente.title}" (${n} chunks).`);
	console.log('Use --reingest pra refazer os chunks.');
	await sql.end();
	process.exit(0);
}

let sourceId: string;
if (existente) {
	sourceId = existente.id;
	const r = await sql`DELETE FROM knowledge_chunks WHERE source_id = ${sourceId}`;
	console.log(`--reingest: ${r.count} chunks antigos apagados.`);
	await sql`UPDATE knowledge_sources SET last_reingested_at = now() WHERE id = ${sourceId}`;
} else {
	const [nova] = await sql<Array<{ id: string }>>`
		INSERT INTO knowledge_sources
			(title, authors, year, url, category, organization, population_tags, file_hash, page_count, language)
		VALUES (
			${opts.title}, ${sql.json(opts.authors)}, ${opts.year}, ${opts.url},
			${opts.category}::source_category, ${opts.org}::organization,
			${sql.json(opts.tags)}, ${fileHash}, ${pageCount}, 'pt-BR'
		) RETURNING id`;
	sourceId = nova!.id;
	console.log(`\nfonte criada: ${sourceId}`);
}

console.log(`embedando ${chunks.length} chunks (${EMBED_MODEL}, ${EMBED_DIMS}d)…`);

let gravados = 0;
let pulados = 0;
for (const [i, c] of chunks.entries()) {
	const embedding = await embedar(c.text);
	const r = await sql`
		INSERT INTO knowledge_chunks
			(source_id, page_number, chunk_index, content, content_hash, embedding, metadata, tokens)
		VALUES (
			${sourceId}, ${c.page}, ${i}, ${c.text}, ${sha(c.text)},
			${`[${embedding.join(',')}]`}::vector,
			${sql.json({ organization: opts.org, population_tags: opts.tags })},
			${Math.round(c.text.length / 4)}
		)
		ON CONFLICT (source_id, content_hash) DO NOTHING`;
	if (r.count > 0) gravados++;
	else pulados++;
	if ((i + 1) % 10 === 0 || i === chunks.length - 1)
		process.stdout.write(`\r  ${i + 1}/${chunks.length}`);
}

console.log(
	`\n\nOK — ${gravados} chunks gravados${pulados ? `, ${pulados} repetidos pulados` : ''}.`
);
const [tot] = await sql<Array<{ fontes: number; chunks: number }>>`
	SELECT (SELECT count(*)::int FROM knowledge_sources) fontes,
	       (SELECT count(*)::int FROM knowledge_chunks) chunks`;
console.log(`base agora: ${tot!.fontes} fontes · ${tot!.chunks} chunks.`);
await sql.end();

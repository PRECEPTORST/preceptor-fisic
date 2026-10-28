/**
 * Prova que o conteúdo recém-ingerido é ALCANÇÁVEL pela busca.
 *
 * Gravar chunk não é o mesmo que o RAG achar o chunk: embedding no espaço
 * errado, taskType trocado ou texto fatiado no lugar errado produzem linha no
 * banco que nunca aparece numa recuperação. Este script faz a busca pelo mesmo
 * caminho do rag.ts (embed da pergunta + distância de cosseno) e mostra de qual
 * fonte veio cada resultado.
 *
 * Uso: tsx scripts/check-rag-novos.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });

/**
 * DATABASE_URL de propósito, a MESMA conexão do app. Não trocar por
 * DATABASE_URL_DIRECT: lá o parâmetro `ivfflat.probes` nem existe, o índice cai
 * no default de 1 lista sondada, e a busca devolve chunk errado ou NENHUM. Um
 * teste de recuperação rodando por outro caminho que o da produção não prova
 * nada sobre a produção. Foi o que aconteceu na primeira versão deste script.
 */
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const PERGUNTAS = [
	'Qual a intensidade e frequência do treino aeróbio para pessoa vivendo com HIV?',
	'Paciente 9 meses após reconstrução de LCA: pode fazer pliometria e corrida?',
	'Reparo de menisco junto com LCA muda as restrições de flexão e carga?',
	'Como calcular a zona de treinamento aeróbio pela frequência cardíaca de reserva?',
	'Quem usa betabloqueador pode ter o aeróbio prescrito por frequência cardíaca?',
	'Prescrição de exercício para doença arterial periférica com claudicação'
];

for (const pergunta of PERGUNTAS) {
	const { embedding } = await embed({
		model: google.textEmbeddingModel(process.env.AI_MODEL_EMBEDDING ?? 'gemini-embedding-001'),
		value: pergunta,
		providerOptions: { google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' } }
	});

	const rows = await sql<Array<{ title: string; page: number | null; dist: number; txt: string }>>`
		SELECT ks.title, kc.page_number AS page,
		       (kc.embedding <=> ${`[${embedding.join(',')}]`}::vector) AS dist,
		       left(regexp_replace(kc.content, '\\s+', ' ', 'g'), 110) AS txt
		FROM knowledge_chunks kc JOIN knowledge_sources ks ON ks.id = kc.source_id
		ORDER BY kc.embedding <=> ${`[${embedding.join(',')}]`}::vector
		LIMIT 3`;

	console.log(`\n▸ ${pergunta}`);
	for (const r of rows) {
		const pg = r.page ? ` p.${r.page}` : '';
		console.log(`   ${r.dist.toFixed(3)}  ${r.title.slice(0, 62)}${pg}`);
		console.log(`          ${r.txt}…`);
	}
}

await sql.end();

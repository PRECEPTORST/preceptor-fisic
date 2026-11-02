/**
 * As citações das regras passam a apontar pra documento que existe na base.
 *
 * Duas coisas estavam erradas ao mesmo tempo:
 *
 * 1. Quatro regras citavam "ACSM 11ª ed.", edição que a gente não tem. O Jonas
 *    confirmou que a 11ª só acrescentou prescrição pra autismo, que ela está
 *    na biblioteca digital da FEPI e que podemos seguir com a 10ª, que é a
 *    que está ingerida. As citações passam a apontar a 10ª, com página.
 *
 * 2. As demais citavam o documento por apelido ("OARSI 2019", "ACOG 2024",
 *    "GOLD 2025", "WHO Physical Activity 2020"). Agora que esses PDFs foram
 *    ingeridos, a citação passa a usar o título exato da fonte na base, que é
 *    o que o doutor consegue procurar.
 *
 * ── Onde a fonte NÃO diz o número que a regra aplica ───────────────────────
 *
 * HTA-002 dizia "Recomendação ACSM: RPE máximo 8 para HAS estágio 1, 7 para
 * estágio 2". A 10ª edição (p. 491) prescreve intensidade MODERADA pra
 * hipertensão: 40 a 59% da FCR, PSE 12 a 13 na escala de 6 a 20, que é 5 a 6
 * na escala de 0 a 10 que o sistema usa. Ela não diz 8 em lugar nenhum. O teto
 * de 8 continua valendo como limite duro, e a descrição passa a dizer as duas
 * coisas separadas: o alvo da fonte e o teto do sistema.
 *
 * IDOSO-002 dizia "ACSM sugere zona moderada como base" sem página. A 10ª
 * (p. 339, FITT pra idosos) usa a escala de 0 a 10 e define moderada como 5 a
 * 6 e vigorosa como 7 a 8. O teto de 7 pro aluno de 75+ é o piso do vigoroso,
 * e a descrição passa a dizer isso.
 *
 * HTA-004 exigia liberação médica com PA acima de 180/110 citando a ACSM. Esse
 * número não aparece na 10ª: quem traz 180/110 na base é a diretriz ACC/AHA de
 * hipertensão e os Standards da ADA. A citação da ACSM sai e fica a ACC/AHA.
 *
 * ── Os três documentos que continuam faltando ──────────────────────────────
 *
 * ATS/ERS Pulmonary Rehab (DPOC-001), The Obesity Society 2023 (OBE-001) e
 * NSCA Essentials of Personal Training (VOL-002) ainda não vieram. A citação
 * passa a dizer isso na cara, em vez de parecer uma referência conferível.
 * Quando o arquivo chegar, ingere e tira o aviso.
 *
 * Idempotente. Uso: tsx scripts/corrige-citacoes-regras.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const ACSM10 = 'Diretrizes do ACSM — 10ª edição';
const ACC_AHA_HAS = 'ACC/AHA — Diretriz de Hipertensão';
const PENDENTE = ' (documento ainda não está na base)';

type Mudanca = { refs: string[]; description?: string };

const MUDANCAS: Record<string, Mudanca> = {
	'HTA-001': {
		refs: [`${ACSM10}, p. 435`, ACC_AHA_HAS],
		description:
			'A manobra de Valsalva eleva a PA de forma abrupta. A 10ª edição do ACSM manda evitar Valsalva no treinamento de resistência justamente pra não causar elevação excessiva de PA. Vale pra HAS estágio 1 em diante, e em especial pra isometria máxima sustentada acima de 10 s.'
	},
	'HTA-002': {
		refs: [`${ACSM10}, p. 491`],
		description:
			'O FITT da 10ª edição do ACSM pra hipertensão é intensidade MODERADA: 40 a 59% da FCR, PSE 12 a 13 na escala de 6 a 20, que equivale a 5 a 6 na escala de 0 a 10 usada aqui. Esse é o alvo. O teto de PSE 8 que esta regra bloqueia é limite duro do sistema, não é número da fonte: serve pra barrar prescrição vigorosa, e não pra autorizar PSE 8 como intensidade de trabalho.'
	},
	'HTA-003': { refs: [ACC_AHA_HAS] },
	'HTA-004': {
		refs: [ACC_AHA_HAS],
		description:
			'PA de repouso acima de 180/110 mmHg, ou diagnóstico recente ainda sem controle, exige liberação médica antes de iniciar o programa. O corte de 180/110 vem da diretriz ACC/AHA de hipertensão, não do ACSM.'
	},
	'IDOSO-002': {
		refs: [`${ACSM10}, p. 339`],
		description:
			'FITT da 10ª edição do ACSM pra idosos, na escala de 0 a 10: moderada é 5 a 6 e vigorosa é 7 a 8. Aos 75 anos ou mais o risco cardiovascular acumulado pesa, então o teto fica em 7, o piso do vigoroso, com a zona moderada como base do programa.'
	},
	'IDOSO-001': { refs: ['WHO Guidelines on Physical Activity and Sedentary Behaviour (2020)'] },
	'OA-001': {
		refs: [
			'OARSI Guidelines for the non-surgical management of knee, hip, and polyarticular osteoarthritis (2019)'
		]
	},
	'GEST-001': {
		refs: [
			'ACOG Committee Opinion 804 — Physical Activity and Exercise During Pregnancy and the Postpartum Period (reafirmado 2024)'
		]
	},
	'GEST-002': {
		refs: [
			'ACOG Committee Opinion 804 — Physical Activity and Exercise During Pregnancy and the Postpartum Period (reafirmado 2024)',
			'PARmed-X for Pregnancy' + PENDENTE
		]
	},
	// O GOLD 2025 foi ingerido inteiro (230 chunks) e NÃO traz o corte de SpO2
	// < 88% pra interromper exercício: procurando por "saturation|SpO2|88" no
	// documento, o que aparece é número de referência bibliográfica. Quem traz
	// esse corte é a literatura de reabilitação pulmonar, ou seja, justamente o
	// ATS/ERS que ainda não veio. Então a citação do GOLD sai de perto do
	// número e fica dito que o corte está sem fonte conferível.
	'DPOC-001': {
		refs: [
			'GOLD 2025 — Global Strategy for Prevention, Diagnosis and Management of COPD (2025 Report)',
			'ATS/ERS Pulmonary Rehabilitation' + PENDENTE
		],
		description:
			'Oximetria de pulso obrigatória durante a sessão. O GOLD 2025 sustenta o acompanhamento, e o corte de SpO2 < 88% pra interromper o esforço não consta dele: ele vem da prática de reabilitação pulmonar e está pendente do documento ATS/ERS. Até lá, tratar 88% como limite conservador do sistema, e não como número citável.'
	},
	// A 10ª edição do ACSM (p. 449) prescreve a intensidade na DPOC pela
	// DISPNEIA na escala CR10 de Borg, 3 a 6, e avisa que alvo por %FCmáx ou
	// %FCR pode ser inadequado nesses alunos. Dispneia 3-6 não é a mesma coisa
	// que PSE 3-6: são escalas de sintomas diferentes. O teto de PSE 6 desta
	// regra continua como está, e a descrição passa a dizer de onde veio.
	'DPOC-002': {
		refs: [
			`${ACSM10}, p. 449`,
			'GOLD 2025 — Global Strategy for Prevention, Diagnosis and Management of COPD (2025 Report)'
		],
		description:
			'DPOC grave treina em intensidade controlada, com ênfase em endurance contínuo. A 10ª edição do ACSM regula a intensidade na DPOC pela dispneia na escala CR10 de Borg, entre 3 e 6, que corresponde a 53% a 80% do VO2pico, e avisa que alvo por percentual de FC pode ser inadequado nestes alunos. O teto de PSE 6 aqui é o limite do sistema na escala de esforço, que é escala diferente da de dispneia.'
	},
	'OBE-001': { refs: ['The Obesity Society 2023' + PENDENTE] },
	'VOL-002': { refs: ['NSCA Essentials of Personal Training' + PENDENTE] }
};

console.log('━ ANTES');
for (const r of await sql`
	SELECT code, source_refs::text AS refs FROM clinical_rules
	WHERE code = ANY(${Object.keys(MUDANCAS)}) ORDER BY code`) {
	console.log(`  ${r.code}: ${r.refs}`);
}

// Citação que aponta pra título de fonte tem que ser título que EXISTE, senão
// o doutor procura e não acha, que é o problema que este script resolve.
const titulos = new Set(
	(await sql<Array<{ title: string }>>`SELECT title FROM knowledge_sources`).map((r) => r.title)
);
const orfas = Object.entries(MUDANCAS)
	.flatMap(([code, m]) => m.refs.map((ref) => ({ code, ref })))
	.filter(({ ref }) => !ref.includes(PENDENTE.trim()) && !titulos.has(ref.split(', p. ')[0]!));
if (orfas.length > 0) {
	console.error('\nFALHOU: citação sem fonte correspondente na base:');
	for (const o of orfas) console.error(`  ${o.code} → ${o.ref}`);
	await sql.end();
	process.exit(1);
}

if (DRY) {
	console.log('\n--dry-run: nada gravado. Ficaria assim:');
	for (const [code, m] of Object.entries(MUDANCAS)) {
		console.log(`  ${code}: ${JSON.stringify(m.refs)}`);
		if (m.description) console.log(`      ${m.description}`);
	}
	await sql.end();
	process.exit(0);
}

for (const [code, m] of Object.entries(MUDANCAS)) {
	const r = m.description
		? await sql`
			UPDATE clinical_rules SET source_refs = ${sql.json(m.refs)}, description = ${m.description},
			       version = version + 1, updated_at = now()
			WHERE code = ${code}`
		: await sql`
			UPDATE clinical_rules SET source_refs = ${sql.json(m.refs)},
			       version = version + 1, updated_at = now()
			WHERE code = ${code}`;
	console.log(r.count ? `✓ ${code}` : `! ${code} não encontrada`);
}

const ruins = await sql<Array<{ code: string; typ: string }>>`
	SELECT code, jsonb_typeof(source_refs) AS typ FROM clinical_rules
	WHERE code = ANY(${Object.keys(MUDANCAS)}) AND jsonb_typeof(source_refs) <> 'array'`;
if (ruins.length > 0) {
	console.error(`\nFALHOU: ${ruins.map((r) => `${r.code}=${r.typ}`).join(', ')}`);
	await sql.end();
	process.exit(1);
}

const [{ n }] = await sql<Array<{ n: number }>>`
	SELECT count(*)::int n FROM clinical_rules WHERE active AND source_refs::text ILIKE '%11ª%'`;
console.log(`\nregras ainda citando a 11ª edição: ${n}`);

console.log('\n━ DEPOIS');
for (const r of await sql`
	SELECT code, source_refs::text AS refs FROM clinical_rules
	WHERE code = ANY(${Object.keys(MUDANCAS)}) ORDER BY code`) {
	console.log(`  ${r.code}: ${r.refs}`);
}

await sql.end();

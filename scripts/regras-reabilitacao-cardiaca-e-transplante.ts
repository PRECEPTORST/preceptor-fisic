/**
 * Duas condições que o guia de aeróbio da Anna já prescrevia e que não existiam
 * no sistema: reabilitação cardíaca de indivíduos internados e pós-transplante
 * cardíaco. O Jonas confirmou que entram.
 *
 * Fontes, as duas na base:
 *   - Treinamento Aeróbio — zonas, fórmulas e prescrição por condição
 *     (protocolo PreceptorFISIC), que traz a coluna do aeróbio das duas;
 *   - as tabelas FITT do ACSM que o Jonas mandou em imagem, transcritas em
 *     docs/fontes/ e ingeridas, que trazem as colunas de força e flexibilidade.
 *
 * ── INTERNADO ──────────────────────────────────────────────────────────────
 *
 * A tabela do ACSM fecha com uma nota que muda tudo:
 *
 *   "O treinamento físico de força muscular esquelética não é recomendado no
 *    ambiente hospitalar."
 *
 * É a única condição do sistema em que o treino de força sai inteiro. A regra
 * é VERMELHA e bloqueia por padrão de exercício, com lista de nome de aparelho
 * e de movimento de academia. Falso positivo aqui é barato: o plano sai só com
 * caminhada e mobilidade, que é exatamente o que a tabela prescreve. Falso
 * negativo é um aluno internado recebendo leg press.
 *
 * Intensidade: FCrepouso + 20 bpm no IAM, + 30 bpm no pós-operatório, teto de
 * 120 bpm, que a própria tabela traduz como EEP ≤ 13 na escala de 6 a 20. Na
 * escala de 0 a 10 do sistema isso é 5. Note que aqui a FC É a prescrição, ao
 * contrário do betabloqueador e da fibrilação atrial: não entra
 * `intensity_prescribed_by_hr`.
 *
 * ── PÓS-TRANSPLANTE ────────────────────────────────────────────────────────
 *
 * "Usar a percepção APENAS, como em uma EEP de 11 a 14, ou teste de fala."
 *
 * O coração transplantado é denervado: ele não responde ao comando autonômico
 * como antes, então zona-alvo por FC não representa o esforço. É o mesmo caso
 * do betabloqueador e da fibrilação atrial, e usa o mesmo
 * `intensity_prescribed_by_hr`.
 *
 * EEP 14 de 20 é 6 na escala de 0 a 10. Na força, a tabela começa em 40% de
 * 1-RM em cima e 50% embaixo, subindo pra 70% ao longo de semanas a meses:
 * o teto de 70% vira regra, o piso não, porque piso depende de quanto tempo
 * faz o transplante e o sistema não registra essa data.
 *
 * Idempotente. Uso:
 *   tsx scripts/regras-reabilitacao-cardiaca-e-transplante.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const TABELAS =
	'FITT: reabilitação cardíaca de internados e pós-transplante cardíaco (tabelas do ACSM, enviadas pelos doutores)';
const AEROBIO =
	'Treinamento Aeróbio — zonas, fórmulas e prescrição por condição (protocolo PreceptorFISIC)';

const TAGS_NOVAS = [
	{
		tag: 'reabilitacao_cardiaca_internado',
		label: 'Reabilitação cardíaca, paciente internado',
		category: 'cardiovascular'
	},
	{
		tag: 'pos_transplante_cardiaco',
		label: 'Pós-transplante cardíaco',
		category: 'cardiovascular'
	}
];

/**
 * Nome de aparelho e de movimento de musculação. Serve pra barrar o plano de
 * academia num aluno internado, não pra classificar exercício com precisão.
 */
const FORCA = [
	'leg\\s*press',
	'\\bsupino\\b',
	'agachamento',
	'levantamento\\s*terra',
	'\\bremada\\b',
	'puxada',
	'\\bcrucifixo\\b',
	'desenvolvimento\\s*(?:de\\s*)?ombro',
	'\\brosca\\b',
	'tr[ií]ceps\\s*(?:testa|corda|pulley)',
	'cadeira\\s*(?:extensora|flexora|adutora|abdutora)',
	'mesa\\s*flexora',
	'\\bpanturrilha\\s*(?:em\\s*p[ée]|sentad)',
	'\\bhalter',
	'\\bbarra\\s*fixa',
	'\\bpulley\\b',
	'flex[ãa]o\\s*de\\s*bra[çc]o',
	'\\bavan[çc]o\\b',
	'afundo',
	'\\bstiff\\b'
];

type Regra = {
	code: string;
	title: string;
	description: string;
	severity: 'red' | 'yellow' | 'green';
	tags: string[];
	dsl: RuleDSL;
	refs: string[];
};

const REGRAS: Regra[] = [
	{
		code: 'RCI-001',
		title: 'Reabilitação cardíaca de internado — sem treino de força',
		description:
			'A tabela FITT do ACSM para reabilitação cardíaca de indivíduos internados diz, em nota: o treinamento físico de força muscular esquelética não é recomendado no ambiente hospitalar. O programa é caminhada mais flexibilidade. Caminhada de 3 a 5 min intermitente, razão exercício/repouso de 2:1, progredindo para 10 a 15 min contínuos, 2 a 4 sessões por dia nos primeiros 3 dias. Flexibilidade pelo menos 1 vez ao dia, 30 s por grande articulação, com precaução no esterno.',
		severity: 'red',
		tags: ['reabilitacao_cardiaca_internado'],
		dsl: {
			when: { condition_tags_any: ['reabilitacao_cardiaca_internado'] },
			forbid: { exercise_patterns: FORCA },
			suggest_replacement: {
				'leg press': [
					'caminhada intermitente de 3 a 5 min',
					'caminhada em esteira em velocidade baixa',
					'bicicleta ergométrica leve'
				],
				supino: [
					'mobilidade de ombro em amplitude confortável',
					'alongamento passivo assistido para quem está restrito ao leito'
				]
			}
		},
		refs: [`${TABELAS}, tabela do internado`, AEROBIO]
	},
	{
		code: 'RCI-002',
		title: 'Reabilitação cardíaca de internado — teto de 120 bpm e PSE 5',
		description:
			'Intensidade pela frequência cardíaca de repouso, sentado ou em pé: mais 20 bpm para quem teve IAM e mais 30 bpm para quem está se recuperando de cirurgia cardíaca. Limite máximo de 120 bpm, que a própria tabela traduz como EEP até 13 na escala de 6 a 20, ou seja, 5 na escala de 0 a 10 usada aqui. Monitorar FC e sintomas em todas as sessões.',
		severity: 'red',
		tags: ['reabilitacao_cardiaca_internado'],
		dsl: {
			when: { condition_tags_any: ['reabilitacao_cardiaca_internado'] },
			forbid: { intensity_above: { metric: 'rpe', value: 5 } },
			require: { monitoring: ['FC', 'sintomas'] }
		},
		refs: [`${TABELAS}, tabela do internado`, AEROBIO]
	},
	{
		code: 'TXC-001',
		title: 'Pós-transplante cardíaco — não prescrever intensidade por frequência cardíaca',
		description:
			'O coração transplantado é denervado e não responde ao comando autonômico como antes, então zona-alvo calculada por FCmáx, %FCR ou Karvonen não corresponde ao esforço real. A tabela do ACSM é explícita: usar a percepção apenas, EEP de 11 a 14 na escala de 6 a 20, ou teste de fala. Monitorar a FC continua indicado como acompanhamento, e não como alvo.',
		severity: 'yellow',
		tags: ['pos_transplante_cardiaco'],
		dsl: {
			when: { condition_tags_any: ['pos_transplante_cardiaco'] },
			forbid: { intensity_prescribed_by_hr: true },
			require: { monitoring: ['PSE'] }
		},
		refs: [`${TABELAS}, tabela do pós-transplante`, AEROBIO]
	},
	{
		code: 'TXC-002',
		title: 'Pós-transplante cardíaco — teto de PSE 6 e 5 sessões por semana',
		description:
			'Aeróbio em EEP de 11 a 14 na escala de 6 a 20, que é até 6 na escala de 0 a 10 usada aqui, progredindo para 20 a 60 min/dia. A tabela pede no mínimo 3 dias por semana e preferencialmente até 5, então 5 é o teto.',
		severity: 'yellow',
		tags: ['pos_transplante_cardiaco'],
		dsl: {
			when: { condition_tags_any: ['pos_transplante_cardiaco'] },
			forbid: {
				intensity_above: { metric: 'rpe', value: 6 },
				volume_above: { metric: 'sessions_per_week', value: 5 }
			}
		},
		refs: [`${TABELAS}, tabela do pós-transplante`, AEROBIO]
	},
	{
		// Regra separada da TXC-002 porque `forbid.intensity_above` guarda UMA
		// métrica: num mesmo objeto, o teto de 1RM sobrescreveria o de PSE e a
		// regra faria metade do que o título promete.
		code: 'TXC-003',
		title: 'Pós-transplante cardíaco — força até 70% de 1RM',
		description:
			'Força 1 a 2 dias não consecutivos por semana, 1 a 2 séries de 10 a 15 repetições nos principais grupos musculares. Começa em 40% de 1RM nos membros superiores e 50% nos inferiores, subindo gradualmente até 70% ao longo de semanas a meses. O teto de 70% é o da fonte. O piso não vira regra porque depende de quanto tempo faz o transplante, e o sistema não registra essa data.',
		severity: 'yellow',
		tags: ['pos_transplante_cardiaco'],
		dsl: {
			when: { condition_tags_any: ['pos_transplante_cardiaco'] },
			forbid: { intensity_above: { metric: 'percent_1rm', value: 70 } }
		},
		refs: [`${TABELAS}, tabela do pós-transplante`]
	}
];

const titulos = new Set(
	(await sql<Array<{ title: string }>>`SELECT title FROM knowledge_sources`).map((r) => r.title)
);
const orfas = REGRAS.flatMap((r) => r.refs).filter(
	(ref) => !titulos.has(ref.split(', tabela')[0]!)
);
if (orfas.length > 0) {
	console.error('FALHOU: citação sem fonte na base:');
	for (const o of orfas) console.error(`  ${o}`);
	await sql.end();
	process.exit(1);
}

console.log('━ ANTES');
const [{ antes }] = await sql<Array<{ antes: number }>>`
	SELECT count(*)::int antes FROM clinical_rules WHERE active`;
console.log(`  ${antes} regras ativas`);
for (const t of TAGS_NOVAS) {
	const [existe] = await sql`SELECT tag FROM condition_taxonomy WHERE tag = ${t.tag}`;
	console.log(`  tag ${t.tag}: ${existe ? 'já existe' : 'não existe'}`);
}

if (DRY) {
	console.log('\n--dry-run: nada gravado. Entraria:');
	for (const t of TAGS_NOVAS) console.log(`  tag ${t.tag} — ${t.label} (${t.category})`);
	for (const r of REGRAS) {
		console.log(`\n  [${r.severity.toUpperCase()}] ${r.code} — ${r.title}`);
		console.log(`      dsl: ${JSON.stringify(r.dsl)}`);
		console.log(`      fonte: ${r.refs.join(' · ')}`);
	}
	await sql.end();
	process.exit(0);
}

for (const t of TAGS_NOVAS) {
	await sql`
		INSERT INTO condition_taxonomy (tag, label, category)
		VALUES (${t.tag}, ${t.label}, ${t.category})
		ON CONFLICT (tag) DO UPDATE SET label = EXCLUDED.label`;
	console.log(`✓ tag ${t.tag}`);
}

for (const r of REGRAS) {
	await sql`
		INSERT INTO clinical_rules (code, title, description, condition_tags, rule_dsl, severity, source_refs, active)
		VALUES (
			${r.code}, ${r.title}, ${r.description}, ${sql.json(r.tags)}, ${sql.json(r.dsl)},
			${r.severity}::severity, ${sql.json(r.refs)}, true
		)
		ON CONFLICT (code) DO UPDATE SET
			title = EXCLUDED.title, description = EXCLUDED.description,
			condition_tags = EXCLUDED.condition_tags, rule_dsl = EXCLUDED.rule_dsl,
			severity = EXCLUDED.severity, source_refs = EXCLUDED.source_refs,
			active = true, version = clinical_rules.version + 1, updated_at = now()`;
	console.log(`✓ ${r.code}`);
}

const ruins = await sql<Array<{ code: string; typ: string }>>`
	SELECT code, jsonb_typeof(rule_dsl) AS typ FROM clinical_rules
	WHERE code = ANY(${REGRAS.map((r) => r.code)}) AND jsonb_typeof(rule_dsl) <> 'object'`;
if (ruins.length > 0) {
	console.error(`\nFALHOU: ${ruins.map((r) => `${r.code}=${r.typ}`).join(', ')}`);
	await sql.end();
	process.exit(1);
}

console.log('\n━ DEPOIS');
for (const r of await sql`
	SELECT code, severity, title FROM clinical_rules
	WHERE code = ANY(${REGRAS.map((x) => x.code)}) AND active ORDER BY code`) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
}
const [{ depois }] = await sql<Array<{ depois: number }>>`
	SELECT count(*)::int depois FROM clinical_rules WHERE active`;
const [{ sem }] = await sql<Array<{ sem: number }>>`
	SELECT count(*)::int sem FROM condition_taxonomy ct
	WHERE NOT EXISTS (SELECT 1 FROM clinical_rules cr WHERE cr.active AND cr.condition_tags ? ct.tag)`;
console.log(`\nregras ativas: ${depois} · condições sem regra: ${sem}`);

await sql.end();

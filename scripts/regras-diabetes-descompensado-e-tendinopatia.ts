/**
 * Duas condições que estavam na taxonomia sem nenhuma regra: diabetes
 * descompensado e tendinopatia patelar.
 *
 * Aluno com a tag recebia plano como se não tivesse a condição. Agora as duas
 * têm fonte na base:
 *
 *   - Colberg et al. (2016), posicionamento da ADA sobre exercício e diabetes
 *   - Malliaras et al. (2015), JOSPT, diagnóstico clínico e manejo de carga na
 *     tendinopatia patelar
 *
 * ── DIABETES DESCOMPENSADO ─────────────────────────────────────────────────
 *
 * A ADA é específica e os números são dela, não meus:
 *
 *   "Test for ketones. Do not perform any exercise if moderate-to-large
 *    amounts of ketones are present."
 *   "Intense exercise should be delayed until glucose levels are < 250 mg/dL
 *    because intense exercise may exaggerate the hyperglycemia."
 *   "Individuals with type 1 diabetes should test for blood ketones if they
 *    have unexplained hyperglycemia (≥ 250 mg/dL)."
 *
 * Então são três coisas diferentes, e só a terceira é prescrição: medir antes,
 * não treinar com cetose, e segurar a intensidade enquanto a glicemia estiver
 * alta. A regra VERMELHA cobre as duas primeiras como monitoramento
 * obrigatório; a AMARELA limita a intensidade.
 *
 * ── TENDINOPATIA PATELAR ───────────────────────────────────────────────────
 *
 * O Malliaras organiza a reabilitação em quatro estágios, e a passagem de um
 * pro outro depende de DOR e de FORÇA medidas no aluno:
 *
 *   1. Isométrico: 5 × 45 s, 2 a 3 vezes por dia, progredindo até 70% da
 *      contração voluntária máxima, com o joelho entre 30° e 60°.
 *   2. Isotônico: quando a dor no isotônico for ≤ 3/10. 3 a 4 séries de 15RM
 *      progredindo até 6RM, dia sim dia não. Os autores preferem heavy slow
 *      resistance ao agachamento em declive.
 *   3. Armazenamento de energia (salto, aceleração, desaceleração, mudança de
 *      direção): só com força adequada (referência deles: 4 × 8 de leg press
 *      unilateral com cerca de 150% do peso corporal) E tolerância de carga,
 *      ou seja, dor ≤ 3/10 durante o exercício e dor voltando ao basal em até
 *      24 h no teste de carga.
 *   4. Retorno ao esporte.
 *
 * O sistema não tem onde registrar dor do dia nem teste de carga, então não dá
 * pra saber em que estágio o aluno está. Igual ao LCA sem data de cirurgia: na
 * dúvida, vale o estágio mais restritivo. A regra bloqueia o estágio 3 e manda
 * o monitoramento de dor junto, que é o critério que destrava o resto.
 *
 * O que NÃO virou regra: o protocolo isométrico em si. Exigir "5 × 45 s a 70%
 * da CVM" depende de `require.exercise_pattern_sessions`, que ainda está em
 * PR. Gravar isso agora deixaria a exigência escrita e inerte, que é
 * exatamente o problema que a IDOSO-001 tinha.
 *
 * Idempotente. Uso:
 *   tsx scripts/regras-diabetes-descompensado-e-tendinopatia.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const ADA =
	'Physical Activity/Exercise and Diabetes: A Position Statement of the American Diabetes Association (Colberg et al., 2016)';
const MALLIARAS =
	'Patellar Tendinopathy: Clinical Diagnosis, Load Management, and Advice (Malliaras et al., 2015)';

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
		code: 'DM-003',
		title: 'Diabetes descompensado — glicemia e cetona antes de cada sessão',
		description:
			'A ADA manda testar cetona quando houver hiperglicemia inexplicada a partir de 250 mg/dL, e não realizar exercício nenhum com quantidade moderada a grande de cetonas presentes, porque glicemia e cetonas podem subir ainda mais mesmo com atividade leve. Medir glicemia e cetona antes da sessão e cancelar o treino se houver cetose.',
		severity: 'red',
		tags: ['diabetes_descompensado'],
		dsl: {
			when: { condition_tags_any: ['diabetes_descompensado'] },
			require: { monitoring: ['glicemia', 'cetona'] }
		},
		refs: [`${ADA}, p. 4 e p. 8`]
	},
	{
		code: 'DM-004',
		title: 'Diabetes descompensado — sem alta intensidade enquanto a glicemia estiver alta',
		description:
			'A ADA posterga o exercício intenso até a glicemia ficar abaixo de 250 mg/dL, porque o esforço intenso pode agravar a hiperglicemia. Exercício de intensidade leve a moderada pode ser iniciado. Enquanto o aluno estiver classificado como descompensado, manter a prescrição na faixa moderada: PSE até 6 na escala de 0 a 10.',
		severity: 'yellow',
		tags: ['diabetes_descompensado'],
		dsl: {
			when: { condition_tags_any: ['diabetes_descompensado'] },
			forbid: { intensity_above: { metric: 'rpe', value: 6 } }
		},
		refs: [`${ADA}, p. 4`]
	},
	{
		code: 'TEND-001',
		title: 'Tendinopatia patelar — sem salto, corrida e mudança de direção sem critério',
		description:
			'Salto, aceleração, desaceleração e mudança de direção são o estágio 3 do Malliaras, o de armazenamento de energia, e só entram com dois critérios atendidos: força adequada, com referência de 4 séries de 8 repetições de leg press unilateral a cerca de 150% do peso corporal, e tolerância de carga, ou seja, dor até 3/10 durante o exercício e dor voltando ao basal em até 24 h no teste de carga. Nada disso está registrado no sistema, então vale o estágio mais conservador. Base do programa: isométrico de quadríceps e isotônico pesado, do tipo heavy slow resistance, entre 15RM e 6RM.',
		severity: 'yellow',
		tags: ['tendinopatia_patelar'],
		dsl: {
			when: { condition_tags_any: ['tendinopatia_patelar'] },
			forbid: {
				exercise_patterns: [
					'\\bsalto',
					'\\bsaltado',
					'\\bplyo',
					'pliometr',
					'\\bsprint',
					'corrida\\s+(?:intensa|de\\s+velocidade)',
					'mudan[çc]a\\s+de\\s+dire[çc][ãa]o',
					'\\bcutting\\b',
					'agachamento\\s+em\\s+declive'
				]
			},
			suggest_replacement: {
				salto: [
					'extensão de joelho isométrica entre 30° e 60°',
					'agachamento espanhol',
					'leg press pesado, 15RM progredindo pra 6RM'
				],
				corrida: ['bicicleta horizontal', 'caminhada em terreno plano']
			}
		},
		refs: [`${MALLIARAS}, p. 5 a 7`]
	},
	{
		code: 'TEND-002',
		title: 'Tendinopatia patelar — monitorar dor na escala 0 a 10 e a resposta em 24 h',
		description:
			'A dor é o que guia a progressão: até 3/10 durante o exercício é considerada aceitável pelo Malliaras, e o critério que mais importa é a resposta 24 h depois num teste de carga, como o agachamento unilateral em declive. Dor maior no dia seguinte significa que a carga passou do que o tendão tolera, e o treino regride pro estágio anterior. Registrar a dor na sessão e no dia seguinte.',
		severity: 'yellow',
		tags: ['tendinopatia_patelar'],
		dsl: {
			when: { condition_tags_any: ['tendinopatia_patelar'] },
			require: { monitoring: ['dor'] },
			forbid: { intensity_above: { metric: 'rpe', value: 8 } }
		},
		refs: [`${MALLIARAS}, p. 5 e p. 6`]
	}
];

// Citação tem que apontar pra fonte que existe na base, senão o doutor procura
// e não acha. Confere antes de gravar qualquer coisa.
const titulos = new Set(
	(await sql<Array<{ title: string }>>`SELECT title FROM knowledge_sources`).map((r) => r.title)
);
const orfas = REGRAS.flatMap((r) => r.refs).filter((ref) => !titulos.has(ref.split(', p. ')[0]!));
if (orfas.length > 0) {
	console.error('FALHOU: citação sem fonte na base:');
	for (const o of orfas) console.error(`  ${o}`);
	await sql.end();
	process.exit(1);
}

// Tag tem que existir na taxonomia, senão a regra nunca casa com aluno nenhum.
const tags = new Set(
	(await sql<Array<{ tag: string }>>`SELECT tag FROM condition_taxonomy`).map((r) => r.tag)
);
const semTag = REGRAS.flatMap((r) => r.tags).filter((t) => !tags.has(t));
if (semTag.length > 0) {
	console.error(`FALHOU: tag fora da taxonomia: ${semTag.join(', ')}`);
	await sql.end();
	process.exit(1);
}

console.log('━ ANTES');
for (const r of await sql`
	SELECT code, severity, title FROM clinical_rules
	WHERE code = ANY(${REGRAS.map((r) => r.code)}) ORDER BY code`) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
}
const [{ antes }] = await sql<Array<{ antes: number }>>`
	SELECT count(*)::int antes FROM clinical_rules WHERE active`;
console.log(`  (${antes} regras ativas)`);

if (DRY) {
	console.log('\n--dry-run: nada gravado. Entraria:');
	for (const r of REGRAS) {
		console.log(`\n  [${r.severity.toUpperCase()}] ${r.code} — ${r.title}`);
		console.log(`      tags: ${r.tags.join(', ')}`);
		console.log(`      dsl:  ${JSON.stringify(r.dsl)}`);
		console.log(`      fonte: ${r.refs.join(' · ')}`);
	}
	await sql.end();
	process.exit(0);
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

// jsonb gravado como string em vez de objeto já aconteceu nesta base e o
// estrago é silencioso: a regra para de casar e ninguém vê.
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
	SELECT code, severity, title, rule_dsl::text AS dsl FROM clinical_rules
	WHERE code = ANY(${REGRAS.map((r) => r.code)}) AND active ORDER BY code`) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
	console.log(`      ${r.dsl}`);
}
const [{ depois }] = await sql<Array<{ depois: number }>>`
	SELECT count(*)::int depois FROM clinical_rules WHERE active`;
const [{ sem }] = await sql<Array<{ sem: number }>>`
	SELECT count(*)::int sem FROM condition_taxonomy ct
	WHERE NOT EXISTS (
		SELECT 1 FROM clinical_rules cr WHERE cr.active AND cr.condition_tags ? ct.tag
	)`;
console.log(`\nregras ativas: ${depois} · condições ainda sem regra: ${sem}`);

await sql.end();

/**
 * O estágio 1 do Malliaras vira exigência, e as regras de tendinopatia passam
 * a citar as duas versões do artigo que estão na base.
 *
 * Quando a TEND-001 e a TEND-002 entraram, o protocolo isométrico ficou de
 * fora de propósito: exigir "5 × 45 s a 70% da CVM" depende de
 * `require.exercise_pattern_sessions`, que estava em PR. Agora está na main.
 *
 * O que o Malliaras (2015) diz do estágio 1:
 *
 *   "Cinco repetições de 45 segundos de exercício isométrico de quadríceps em
 *    amplitude média a 70% da contração voluntária máxima reduzem a dor do
 *    tendão patelar por 45 minutos após o exercício."
 *
 *   Indicado "quando a dor limita a capacidade de realizar exercícios
 *   isotônicos", 2 a 3 vezes por dia, joelho entre 30° e 60°, sem fasciculação
 *   muscular, e o isométrico do estágio 1 pode ser combinado com os estágios
 *   seguintes para manejar a dor.
 *
 * Como o sistema não registra dor do dia nem teste de carga, não dá pra saber
 * em que estágio o aluno está, e a TEND-001 já trata todo mundo como
 * pré-estágio 3. O isométrico é a base que vale em qualquer um dos estágios
 * anteriores, então vira exigência de 2 sessões na semana.
 *
 * Citação: as duas versões do artigo ficaram na base porque a extração nova
 * perdeu a seção de carga no tendão que a antiga tem (a frase do leg press a
 * 3 vezes o peso corporal, e os números da aterrissagem). As regras passam a
 * citar as duas, pra citação cobrir o artigo inteiro.
 *
 * Idempotente. Uso: tsx scripts/regras-tendinopatia-isometrico.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const MALLIARAS_NOVA =
	'Patellar Tendinopathy: Clinical Diagnosis, Load Management, and Advice (Malliaras et al., 2015)';
const MALLIARAS_ANTIGA =
	'Patellar Tendinopathy — Clinical Diagnosis, Load Management and Advice (Malliaras et al.)';
const REFS = [`${MALLIARAS_NOVA}, p. 5 a 7`, MALLIARAS_ANTIGA];

/**
 * Marcadores de carga isométrica de quadríceps. `matchesPatterns` tira o
 * acento dos dois lados antes de comparar.
 *
 * "cadeira" sozinho não entra: cadeira extensora isotônica é estágio 2, e
 * marcaria a exigência como cumprida sem o aluno ter feito isometria.
 */
const PADROES_ISOMETRICO = [
	'isom[eé]tric',
	'isometria',
	'agachamento\\s+espanhol',
	'spanish\\s+squat',
	'wall\\s*sit',
	'sustenta[çc][ãa]o\\s+(?:de\\s+)?45\\s*s'
];

const TEND_003_DSL: RuleDSL = {
	when: { condition_tags_any: ['tendinopatia_patelar'] },
	require: {
		exercise_pattern_sessions: {
			patterns: PADROES_ISOMETRICO,
			min_sessions_per_week: 2,
			label: 'carga isométrica de quadríceps'
		}
	}
};

const TEND_003 = {
	code: 'TEND-003',
	title: 'Tendinopatia patelar — isometria de quadríceps como base do programa',
	description:
		'Estágio 1 do Malliaras: 5 repetições de 45 s de isometria de quadríceps em amplitude média, 2 a 3 vezes por dia, progredindo até 70% da contração voluntária máxima conforme a dor permitir, com o joelho entre 30° e 60° e sem fasciculação muscular, que indica carga alta demais. Reduz a dor do tendão por cerca de 45 minutos depois do exercício. Pode ser extensão de joelho na máquina ou agachamento espanhol, de preferência unilateral. O isométrico é a base e segue valendo junto dos estágios seguintes para manejar a dor.',
	severity: 'yellow' as const,
	tags: ['tendinopatia_patelar'],
	dsl: TEND_003_DSL,
	refs: REFS
};

const titulos = new Set(
	(await sql<Array<{ title: string }>>`SELECT title FROM knowledge_sources`).map((r) => r.title)
);
for (const ref of REFS) {
	const t = ref.split(', p. ')[0]!;
	if (!titulos.has(t)) {
		console.error(`FALHOU: fonte "${t}" não está na base`);
		await sql.end();
		process.exit(1);
	}
}

console.log('━ ANTES');
for (const r of await sql`
	SELECT code, title, source_refs::text AS refs FROM clinical_rules
	WHERE code LIKE 'TEND-%' ORDER BY code`) {
	console.log(`  ${r.code} — ${r.title}\n      ${r.refs}`);
}

if (DRY) {
	console.log('\n--dry-run: nada gravado.');
	console.log(`  ${TEND_003.code}: ${JSON.stringify(TEND_003.dsl)}`);
	console.log(`  TEND-001 e TEND-002 passariam a citar: ${JSON.stringify(REFS)}`);
	await sql.end();
	process.exit(0);
}

await sql`
	INSERT INTO clinical_rules (code, title, description, condition_tags, rule_dsl, severity, source_refs, active)
	VALUES (
		${TEND_003.code}, ${TEND_003.title}, ${TEND_003.description}, ${sql.json(TEND_003.tags)},
		${sql.json(TEND_003.dsl)}, ${TEND_003.severity}::severity, ${sql.json(TEND_003.refs)}, true
	)
	ON CONFLICT (code) DO UPDATE SET
		title = EXCLUDED.title, description = EXCLUDED.description,
		condition_tags = EXCLUDED.condition_tags, rule_dsl = EXCLUDED.rule_dsl,
		severity = EXCLUDED.severity, source_refs = EXCLUDED.source_refs,
		active = true, version = clinical_rules.version + 1, updated_at = now()`;
console.log(`✓ ${TEND_003.code}`);

const upd = await sql`
	UPDATE clinical_rules SET source_refs = ${sql.json(REFS)}, version = version + 1, updated_at = now()
	WHERE code IN ('TEND-001','TEND-002')`;
console.log(`✓ citação das TEND-001 e TEND-002 (${upd.count} regras)`);

const ruins = await sql<Array<{ code: string; typ: string }>>`
	SELECT code, jsonb_typeof(rule_dsl) AS typ FROM clinical_rules
	WHERE code LIKE 'TEND-%' AND jsonb_typeof(rule_dsl) <> 'object'`;
if (ruins.length > 0) {
	console.error(`\nFALHOU: ${ruins.map((r) => `${r.code}=${r.typ}`).join(', ')}`);
	await sql.end();
	process.exit(1);
}

console.log('\n━ DEPOIS');
for (const r of await sql`
	SELECT code, title, rule_dsl::text AS dsl, source_refs::text AS refs FROM clinical_rules
	WHERE code LIKE 'TEND-%' AND active ORDER BY code`) {
	console.log(`  ${r.code} — ${r.title}\n      ${r.refs}`);
}
const [{ n }] = await sql<
	Array<{ n: number }>
>`SELECT count(*)::int n FROM clinical_rules WHERE active`;
console.log(`\nregras ativas: ${n}`);
await sql.end();

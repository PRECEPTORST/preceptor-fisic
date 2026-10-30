/**
 * Duas regras que não faziam o que o próprio título dizia.
 *
 * ── IDOSO-001 ──────────────────────────────────────────────────────────────
 *
 * Título: "Idoso frágil — exigir treino de potência 2x/sem".
 * Descrição: "WHO 2020: idosos com sarcopenia ou fragilidade devem incluir 2
 * sessões de treino de potência (velocidade na fase concêntrica)".
 * rule_dsl: `forbid.volume_above: 5 sessions_per_week`.
 *
 * A regra nunca checou potência. Idoso frágil recebia plano sem um único
 * exercício de potência e nada era sinalizado, enquanto o doutor lia no painel
 * que a exigência estava coberta. Pior que não ter a regra, porque dava a
 * impressão de ter.
 *
 * O teto de 5 sessões semanais que estava lá no lugar não aparece no título,
 * não aparece na descrição e não sai da fonte citada. Saiu daqui. Idoso frágil
 * continua com o teto geral de 6 sessões da VOL-002, que vale pra todo mundo.
 *
 * ── VOL-001 ────────────────────────────────────────────────────────────────
 *
 * Título: "Volume excessivo — máx. 90 min/sessão pra iniciante".
 * rule_dsl: `when: { age_lte: 200 }`, que é um jeito de escrever "todo mundo".
 *
 * O teto de 90 min caía em aluno avançado também, e a restrição aparecia no
 * plano de quem treina há dez anos. Agora a regra filtra por
 * `experience_level_any: ['iniciante']`. Aluno sem preferências registradas
 * conta como iniciante, que é o default da coluna no banco.
 *
 * Idempotente. Uso: tsx scripts/corrige-idoso-001-vol-001.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

/**
 * Marcadores de treino de potência no nome do exercício. `matchesPatterns` no
 * validator tira o acento do padrão e do texto antes de comparar, então
 * `pot[eê]ncia` cobre "potência" e "potencia".
 *
 * Pliometria e salto de propósito NÃO entram: potência em idoso frágil é
 * velocidade na fase concêntrica de um exercício de força, e salto em quem já
 * tem risco de queda é outra conversa.
 */
const PADROES_POTENCIA = [
	'pot[eê]ncia',
	'explosiv',
	'arremesso',
	'medicine\\s*ball',
	'(?:fase\\s+)?conc[eê]ntrica\\s+r[aá]pida',
	'velocidade\\s+conc[eê]ntrica'
];

const IDOSO_001_DSL: RuleDSL = {
	when: { age_gte: 60, condition_tags_any: ['idoso_fragil', 'sarcopenia'] },
	require: {
		exercise_pattern_sessions: {
			patterns: PADROES_POTENCIA,
			min_sessions_per_week: 2,
			label: 'treino de potência'
		}
	}
};

const IDOSO_001_DESCRICAO =
	'WHO 2020: idoso com sarcopenia ou fragilidade deve incluir 2 sessões semanais de treino de potência, ou seja, velocidade na fase concêntrica de exercícios de força, com descida controlada. Não é pliometria nem salto: o objetivo é a taxa de produção de força, que é o que cai primeiro e o que sustenta levantar da cadeira e reagir a um desequilíbrio.';

const VOL_001_DSL: RuleDSL = {
	when: { experience_level_any: ['iniciante'] },
	forbid: { volume_above: { metric: 'minutes_per_session', value: 90 } }
};

const VOL_001_DESCRICAO =
	'Sessões acima de 90 min em iniciante aumentam dor tardia e abandono. ACSM Beginner Guidelines. Vale só pra quem está registrado como iniciante: aluno intermediário e avançado não recebe este teto.';

console.log('━ ANTES');
for (const r of await sql`
	SELECT code, title, description, rule_dsl::text AS dsl FROM clinical_rules
	WHERE code IN ('IDOSO-001','VOL-001') ORDER BY code`) {
	console.log(`  ${r.code} — ${r.title}\n      dsl: ${r.dsl}`);
}

if (DRY) {
	console.log('\n--dry-run: nada gravado. DSL que seria gravado:');
	console.log(`  IDOSO-001: ${JSON.stringify(IDOSO_001_DSL)}`);
	console.log(`  VOL-001:   ${JSON.stringify(VOL_001_DSL)}`);
	await sql.end();
	process.exit(0);
}

const u1 = await sql`
	UPDATE clinical_rules
	SET description = ${IDOSO_001_DESCRICAO}, rule_dsl = ${sql.json(IDOSO_001_DSL)},
	    version = version + 1, updated_at = now()
	WHERE code = 'IDOSO-001'`;
console.log(u1.count ? '✓ IDOSO-001' : '! IDOSO-001 não encontrada');

const u2 = await sql`
	UPDATE clinical_rules
	SET description = ${VOL_001_DESCRICAO}, rule_dsl = ${sql.json(VOL_001_DSL)},
	    version = version + 1, updated_at = now()
	WHERE code = 'VOL-001'`;
console.log(u2.count ? '✓ VOL-001' : '! VOL-001 não encontrada');

// jsonb gravado como string em vez de objeto já aconteceu nesta base
// (`${JSON.stringify(x)}::jsonb` em postgres.js), e o estrago é silencioso:
// a regra para de casar e ninguém vê. Falha alto se repetir.
const check = await sql<Array<{ code: string; typ: string }>>`
	SELECT code, jsonb_typeof(rule_dsl) AS typ FROM clinical_rules
	WHERE code IN ('IDOSO-001','VOL-001')`;
const ruim = check.filter((r) => r.typ !== 'object');
if (ruim.length > 0) {
	console.error(`\nFALHOU: ${ruim.map((r) => `${r.code}=${r.typ}`).join(', ')}`);
	await sql.end();
	process.exit(1);
}

console.log('\n━ DEPOIS');
for (const r of await sql`
	SELECT code, title, description, rule_dsl::text AS dsl FROM clinical_rules
	WHERE code IN ('IDOSO-001','VOL-001') ORDER BY code`) {
	console.log(`  ${r.code} — ${r.title}\n      ${r.description}\n      dsl: ${r.dsl}`);
}

await sql.end();

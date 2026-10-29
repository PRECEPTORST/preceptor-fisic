/**
 * Reescreve a regra de LCA em FASES, conforme o guia dos doutores (out/2026).
 *
 * Como estava: LCA-001, vermelha (bloqueia publicação), proibindo pivô,
 * pliometria, salto e corrida lateral pra QUALQUER aluno marcado como
 * pós-cirúrgico de LCA. O "≤6m" existia só no título — o `rule_dsl` não tinha
 * nenhuma condição de tempo. Aluno de nove meses de pós-operatório recebia a
 * prescrição correta do guia e o plano saía bloqueado em vermelho.
 *
 * Como fica, seguindo os capítulos 6, 7 e 8 do guia:
 *
 *   LCA-001  0 a 6 meses    vermelha  proíbe pivô, plyo, salto (igual a hoje)
 *   LCA-002  6 a 12 meses   amarela   libera plyo e salto, exige monitoramento
 *   LCA-003  após 12 meses  amarela   manutenção, exige reavaliação periódica
 *
 * O guia é explícito em dois pontos que a regra NÃO pode fingir que resolve:
 * a progressão depende de critério clínico, e completar nove ou doze meses por
 * si só não é critério de alta. Por isso as fases 2 e 3 são amarelas e exigem
 * monitoramento, em vez de simplesmente liberar. Quem decide continua sendo o
 * doutor na auditoria; a regra só deixa de bloquear o que o guia prescreve.
 *
 * A fase vem de `health_profiles.surgeries`, campo que já existia. Aluno sem
 * data de cirurgia registrada cai na LCA-001, que é a mais restritiva — o
 * mesmo comportamento de hoje.
 *
 * Idempotente. Uso: tsx scripts/regras-lca-por-fase.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

/** Casa reconstrução de LCA e reparo de menisco, que o guia trata junto. */
const PROCEDIMENTO = '(lca|ligamento\\s+cruzado|cruzado\\s+anterior|menisc)';

const TAGS = ['lca_pos_cirurgico'];
const FONTE = 'Guia de Reabilitação do LCA e Menisco — PreceptorFISIC (2026), cap. 6-8';

type Regra = {
	code: string;
	title: string;
	description: string;
	severity: 'red' | 'yellow';
	dsl: RuleDSL;
};

const REGRAS: Regra[] = [
	{
		code: 'LCA-001',
		title: 'Pós-LCA, 0 a 6 meses — sem pivô, salto ou pliometria',
		description:
			'Fase de proteção, força inicial e preparação para corrida (cap. 6). Evitar rotação sob carga, saltos e pliometria. Corrida só com critério clínico: extensão completa, sem derrame significativo, marcha e mecânica satisfatórias e liberação da equipe. Não iniciar saltos por ter completado um número de semanas.',
		severity: 'red',
		dsl: {
			when: {
				condition_tags_any: TAGS,
				months_since_surgery: { procedure_matches: PROCEDIMENTO, lt: 6 }
			},
			forbid: {
				exercise_patterns: [
					'\\bpivô\\b',
					'\\bpiv[oô]\\b',
					'\\bpliom[ée]tric',
					'\\bplyo\\b',
					'\\bsalto\\b',
					'\\bcorrida\\s+lateral\\b'
				]
			},
			suggest_replacement: {
				plyo: ['step-up controlado', 'cadeia cinética fechada'],
				salto: ['agachamento isométrico parede', 'leg press unilateral']
			}
		}
	},
	{
		code: 'LCA-002',
		title: 'Pós-LCA, 6 a 12 meses — pliometria liberada com critério',
		description:
			'Fase de fortalecimento avançado e retorno progressivo ao esporte (cap. 7). Força 2-3x/semana a 60-85% de 1RM; pliometria 1-2x/semana começando com baixo volume e contatos de menor intensidade, evoluindo para saltos unilaterais e multidirecionais. Exigir controle de aterrissagem, ausência de derrame e tolerância no dia seguinte. Reduzir ou suspender carga diante de derrame recorrente, dor progressiva, perda de extensão ou episódios de falseio. Simetria ≥90% é referência, não prova de segurança.',
		severity: 'yellow',
		dsl: {
			when: {
				condition_tags_any: TAGS,
				months_since_surgery: { procedure_matches: PROCEDIMENTO, gte: 6, lt: 12 }
			},
			require: { monitoring: ['derrame', 'dor', 'amplitude'] }
		}
	},
	{
		code: 'LCA-003',
		title: 'Pós-LCA, após 12 meses — manutenção e prevenção secundária',
		description:
			'Concluir o primeiro ano não encerra a recuperação (cap. 8). Força de manutenção 2x/semana com ênfase em quadríceps, posteriores, quadril e panturrilha; pliometria e controle neuromuscular 1-2x/semana integrados ao aquecimento. Reavaliar a cada 8-12 semanas e após mudanças relevantes de carga. Fraqueza persistente de quadríceps, derrame após treinos, falseio ou restrição de extensão indicam reabilitação não concluída. Não existe data universal de alta.',
		severity: 'yellow',
		dsl: {
			when: {
				condition_tags_any: TAGS,
				months_since_surgery: { procedure_matches: PROCEDIMENTO, gte: 12 }
			},
			require: { monitoring: ['assimetria', 'derrame'] }
		}
	}
];

console.log('━ ANTES');
for (const r of await sql`
	SELECT code, severity, title, rule_dsl::text AS dsl FROM clinical_rules
	WHERE code LIKE 'LCA-%' ORDER BY code`) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
	console.log(`      ${r.dsl.slice(0, 150)}`);
}

if (DRY) {
	console.log('\n━ FICARIA');
	for (const r of REGRAS) {
		console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
		console.log(`      when: ${JSON.stringify(r.dsl.when)}`);
	}
	console.log('\n--dry-run: nada gravado.');
	await sql.end();
	process.exit(0);
}

for (const r of REGRAS) {
	await sql`
		INSERT INTO clinical_rules (code, title, description, condition_tags, rule_dsl, severity, source_refs, active)
		VALUES (
			${r.code}, ${r.title}, ${r.description}, ${sql.json(TAGS)}, ${sql.json(r.dsl)},
			${r.severity}::severity, ${sql.json([FONTE])}, true
		)
		ON CONFLICT (code) DO UPDATE SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			condition_tags = EXCLUDED.condition_tags,
			rule_dsl = EXCLUDED.rule_dsl,
			severity = EXCLUDED.severity,
			source_refs = EXCLUDED.source_refs,
			active = true,
			version = clinical_rules.version + 1,
			updated_at = now()`;
	console.log(`✓ ${r.code}`);
}

console.log('\n━ DEPOIS');
const depois = await sql<
	Array<{ code: string; severity: string; title: string; typ: string; dsl: string }>
>`
	SELECT code, severity, title, jsonb_typeof(rule_dsl) AS typ, rule_dsl::text AS dsl
	FROM clinical_rules WHERE code LIKE 'LCA-%' AND active ORDER BY code`;
for (const r of depois) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
	console.log(`      ${JSON.stringify(JSON.parse(r.dsl).when)}`);
}

// A gravação errada de jsonb (string em vez de objeto) já aconteceu neste
// projeto e deixou regra sem disparar. Confere antes de dar OK.
const torto = depois.filter((r) => r.typ !== 'object');
if (torto.length > 0) {
	console.error(`\nFALHOU: rule_dsl gravado como ${torto.map((r) => r.typ).join(', ')}`);
	await sql.end();
	process.exit(1);
}
if (depois.length !== REGRAS.length) {
	console.error(`\nFALHOU: esperava ${REGRAS.length} regras LCA ativas, achei ${depois.length}`);
	await sql.end();
	process.exit(1);
}

console.log(`\nOK — ${depois.length} fases ativas.`);
await sql.end();

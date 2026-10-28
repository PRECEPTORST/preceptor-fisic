/**
 * HIV entra no sistema: tag na taxonomia e regras clínicas.
 *
 * Antes disso, HIV não existia em lugar nenhum. Não havia tag, não havia
 * regra e não havia fonte na base. Se o aluno declarasse, nada disparava e o
 * plano saía como se ele não tivesse a condição — silenciosamente, que é o
 * pior jeito de falhar quando o doutor é o único filtro.
 *
 * Base: Guia de Prescrição de Exercício Físico para PVHIV (PreceptorFISIC,
 * 2026), já ingerido na base de conhecimento.
 *
 * ── O que NÃO virou regra, e por quê ───────────────────────────────────────
 *
 * O guia separa contraindicações ABSOLUTAS TEMPORÁRIAS (febre com
 * comprometimento sistêmico, infecção oportunista ativa, dor torácica,
 * síncope, instabilidade hemodinâmica, hipoglicemia sintomática) de
 * RELATIVAS (anemia, neuropatia periférica, lipodistrofia, osteopenia).
 *
 * As absolutas são ESTADO DO DIA, não condição crônica: valem para suspender
 * a sessão na hora, e o sistema não tem onde registrar "como o aluno está
 * hoje". Virar regra vermelha a partir do cadastro bloquearia o plano de
 * alguém estável, e não bloquearia nada de quem passar mal na terça. Então
 * elas entram como critério de SUSPENSÃO no monitoramento do plano, que é
 * onde o profissional e o aluno vão ler, e não como bloqueio de publicação.
 *
 * O guia também é explícito: CD4 baixo e carga viral detectável NÃO são
 * contraindicação automática em quem está estável. Nenhuma regra aqui olha
 * esses números, de propósito.
 *
 * E a nota crítica dos próprios doutores sobre o protocolo combinado (HIIT a
 * 80-85% da FCmáx, Borg >17, força a 80% de 1RM) diz que aquilo é protocolo
 * de pesquisa, não recomendação inicial universal. Por isso HIV-001 limita a
 * intensidade inicial sem proibir progressão: é amarela, não vermelha.
 *
 * Idempotente. Uso: tsx scripts/regras-hiv.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const TAG = 'hiv';
const FONTE = 'Guia de Prescrição de Exercício Físico para PVHIV — PreceptorFISIC (2026)';

type Regra = {
	code: string;
	title: string;
	description: string;
	severity: 'red' | 'yellow';
	dsl: RuleDSL;
};

const REGRAS: Regra[] = [
	{
		code: 'HIV-001',
		title: 'PVHIV — progressão conservadora e monitoramento de sintomas',
		description:
			'Prescrição segura e recomendada em todas as fases da infecção, desde que individualizada e progressiva. Aeróbio 3 a 5 dias/semana, intensidade leve a moderada (40-60% da FC de reserva ou PSE 3-5/10), 20 a 60 min, contínuo ou fracionado, até ≥150 min/semana de forma PROGRESSIVA (não é exigência imediata para pessoa debilitada). Força 2 a 3 dias/semana, 40-70% de 1RM, 1-3 séries de 8-15 repetições em grandes grupos; teste de 1RM não é obrigatório em pessoa frágil ou destreinada. Flexibilidade e exercícios neuromotores ≥2 dias/semana, com equilíbrio e coordenação especialmente quando há neuropatia periférica. Registrar PSE, sintomas, fadiga, adesão e recuperação; reavaliar capacidade funcional a cada 6-8 semanas ou antes se houver intercorrência. Regularidade importa mais que intensidade elevada.',
		severity: 'yellow',
		dsl: {
			when: { condition_tags_any: [TAG] },
			forbid: { intensity_above: { metric: 'rpe', value: 6 } },
			require: { monitoring: ['PSE', 'fadiga'] }
		}
	},
	{
		code: 'HIV-002',
		title: 'PVHIV — sem Valsalva e sem isometria máxima na força',
		description:
			'Orientação de execução do guia: iniciar com cargas toleráveis, evitar manobra de Valsalva e observar técnica, dor, recuperação e comorbidades. Risco cardiovascular aumentado e uso prolongado de TARV reforçam a cautela com picos pressóricos.',
		severity: 'yellow',
		dsl: {
			when: { condition_tags_any: [TAG] },
			forbid: {
				exercise_patterns: [
					'\\bvalsalva\\b',
					'(?:isometria|isom[ée]tric|prancha\\s+m[aá]xima)\\s+m[aá]xima',
					'\\bapne[ia]a?\\s+resp(?:irat[oó]ri[ao])?'
				]
			}
		}
	},
	{
		code: 'HIV-003',
		title: 'PVHIV — critérios de suspensão da sessão no monitoramento',
		description:
			'O plano precisa trazer, no monitoramento, os critérios de suspender a sessão e encaminhar: dor torácica sugestiva de isquemia, síncope inexplicada, dispneia intensa em repouso, instabilidade hemodinâmica ou arritmia sintomática; febre com comprometimento sistêmico, infecção aguda grave ou infecção oportunista ativa; hipoxemia importante, desidratação grave, vômitos ou diarreia intensos; hipoglicemia sintomática ou hiperglicemia com sinais de descompensação. São sinais de suspensão e encaminhamento, não classificação de gravidade do HIV. CD4 baixo ou carga viral detectável exigem interpretação clínica individual e NÃO são contraindicação automática em pessoa estável.',
		severity: 'yellow',
		dsl: {
			when: { condition_tags_any: [TAG] },
			require: { monitoring: ['sintomas', 'temperatura'] }
		}
	}
];

console.log('━ ANTES');
const [{ n: tagAntes }] = await sql<Array<{ n: number }>>`
	SELECT count(*)::int n FROM condition_taxonomy WHERE tag = ${TAG}`;
console.log(`  tag "${TAG}" na taxonomia: ${tagAntes ? 'existe' : 'NÃO existe'}`);
const antes = await sql`SELECT code, severity, title FROM clinical_rules WHERE code LIKE 'HIV-%'`;
console.log(`  regras HIV: ${antes.length ? antes.map((r) => r.code).join(', ') : 'nenhuma'}`);

if (DRY) {
	console.log('\n━ FICARIA');
	console.log(`  taxonomia: ${TAG} · "HIV / PVHIV" · imunologico`);
	for (const r of REGRAS) {
		console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
		console.log(`      forbid: ${JSON.stringify(r.dsl.forbid ?? null)}`);
		console.log(`      require: ${JSON.stringify(r.dsl.require ?? null)}`);
	}
	console.log('\n--dry-run: nada gravado.');
	await sql.end();
	process.exit(0);
}

await sql`
	INSERT INTO condition_taxonomy (tag, label, category, synonyms, description)
	VALUES (
		${TAG}, 'HIV / PVHIV', 'imunologico',
		${sql.json(['pessoa vivendo com HIV', 'PVHIV', 'aids', 'sida', 'soropositivo'])},
		'Pessoa vivendo com HIV. Exercício é seguro e recomendado em todas as fases, com individualização e progressão. CD4 e carga viral não são corte automático.'
	)
	ON CONFLICT (tag) DO UPDATE SET
		label = EXCLUDED.label, category = EXCLUDED.category,
		synonyms = EXCLUDED.synonyms, description = EXCLUDED.description`;
console.log(`\n✓ taxonomia: ${TAG}`);

for (const r of REGRAS) {
	await sql`
		INSERT INTO clinical_rules (code, title, description, condition_tags, rule_dsl, severity, source_refs, active)
		VALUES (
			${r.code}, ${r.title}, ${r.description}, ${sql.json([TAG])}, ${sql.json(r.dsl)},
			${r.severity}::severity, ${sql.json([FONTE])}, true
		)
		ON CONFLICT (code) DO UPDATE SET
			title = EXCLUDED.title, description = EXCLUDED.description,
			condition_tags = EXCLUDED.condition_tags, rule_dsl = EXCLUDED.rule_dsl,
			severity = EXCLUDED.severity, source_refs = EXCLUDED.source_refs,
			active = true, version = clinical_rules.version + 1, updated_at = now()`;
	console.log(`✓ ${r.code}`);
}

console.log('\n━ DEPOIS');
const depois = await sql<Array<{ code: string; severity: string; title: string; typ: string }>>`
	SELECT code, severity, title, jsonb_typeof(rule_dsl) AS typ
	FROM clinical_rules WHERE code LIKE 'HIV-%' AND active ORDER BY code`;
for (const r of depois) console.log(`  [${r.severity}] ${r.code} — ${r.title}`);

const torto = depois.filter((r) => r.typ !== 'object');
if (torto.length > 0 || depois.length !== REGRAS.length) {
	console.error(
		`\nFALHOU: ${depois.length}/${REGRAS.length} regras, jsonb torto em ${torto.length}`
	);
	await sql.end();
	process.exit(1);
}

// A regra só serve se a tag que ela cita existir na taxonomia — foi esse
// descasamento que deixou gestante e DPOC sem disparar por meses.
const [{ n: orfas }] = await sql<Array<{ n: number }>>`
	SELECT count(*)::int n FROM clinical_rules r, jsonb_array_elements_text(r.condition_tags) t(tag)
	WHERE r.active AND r.code LIKE 'HIV-%'
	  AND NOT EXISTS (SELECT 1 FROM condition_taxonomy c WHERE c.tag = t.tag)`;
if (orfas > 0) {
	console.error(`\nFALHOU: ${orfas} tag(s) de regra HIV fora da taxonomia`);
	await sql.end();
	process.exit(1);
}

console.log(
	`\nOK — ${depois.length} regras HIV ativas. Total: ${(await sql`SELECT count(*)::int n FROM clinical_rules WHERE active`)[0]!.n}`
);
await sql.end();

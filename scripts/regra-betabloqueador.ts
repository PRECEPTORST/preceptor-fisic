/**
 * Betabloqueador: não prescrever o aeróbio por frequência cardíaca.
 *
 * Vem do guia de Treinamento Aeróbio dos doutores (2026), em OBSERVAÇÕES:
 * "Para indivíduos que façam uso de betabloqueadores, não prescrever o
 * treinamento aeróbio por meio da frequência cardíaca."
 *
 * O remédio achata a resposta cronotrópica: a FC não sobe como subiria, então
 * a zona-alvo calculada por FCmáx ou Karvonen fica errada e o aluno treina
 * abaixo (ou acima) do que a prescrição pretendia. A conta de FCmáx por idade
 * (208 − 0,7 × idade) não sabe nada sobre o remédio.
 *
 * Conflito com o que já existia: a CARD-002 mandava, em texto, "FC monitorada
 * via Karvonen é obrigatória. Manter dentro da zona alvo individual definida no
 * teste ergométrico". Isso é prescrever por FC, e betabloqueador é dos remédios
 * mais comuns justamente em cardiopata, que é o público da CARD-002. A descrição
 * dela passa a separar as duas coisas: monitorar a FC continua obrigatório,
 * prescrever a intensidade por ela depende do remédio.
 *
 * A regra nova NÃO tem condition_tags de propósito: betabloqueador aparece em
 * cardiopata e em hipertenso, e a contraindicação é do remédio, não do
 * diagnóstico.
 *
 * Idempotente. Uso: tsx scripts/regra-betabloqueador.ts [--dry-run]
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
 * A classe termina em -olol (atenolol, metoprolol, propranolol, bisoprolol,
 * nebivolol), -alol (sotalol, labetalol) ou -ilol (carvedilol). O sufixo
 * genérico cobre as três e dispensa manter lista de nomes comerciais.
 *
 * Falso positivo aqui é barato: o plano sai prescrito por percepção de esforço
 * em vez de FC, que é seguro pra qualquer aluno. Falso NEGATIVO é que custa.
 * Mesmos padrões em `usaBetabloqueador` no generator.ts — mudou aqui, mudar lá.
 */
const BETABLOQUEADORES = ['\\w*[oai]lol\\b', '\\bbetabloq'];

const FONTE = 'Guia de Treinamento Aeróbio — PreceptorFISIC (2026), OBSERVAÇÕES';

const CARD_004_DSL: RuleDSL = {
	when: { medications_any: BETABLOQUEADORES },
	forbid: { intensity_prescribed_by_hr: true },
	require: { monitoring: ['PSE'] }
};

const CARD_004 = {
	code: 'CARD-004',
	title: 'Betabloqueador — não prescrever intensidade por frequência cardíaca',
	description:
		'O betabloqueador achata a resposta cronotrópica, então a zona-alvo calculada por FCmáx, %FCR ou Karvonen não corresponde ao esforço real e a prescrição sai errada. Prescrever a intensidade por percepção subjetiva de esforço (PSE) ou teste da fala. Monitorar a FC continua indicado como acompanhamento, e não como alvo. Se houver teste ergométrico feito COM o aluno medicado, a zona daquele teste é válida e deve ser citada.',
	severity: 'yellow' as const,
	dsl: CARD_004_DSL
};

/** Só a descrição muda: as tags, o DSL e a gravidade da CARD-002 seguem iguais. */
const CARD_002_DESCRICAO =
	'Monitoramento de FC obrigatório em cardiopatia isquêmica, pós-IAM e IC compensada. A zona-alvo vem do teste ergométrico do aluno. Atenção ao betabloqueador: nesse caso a FC serve para acompanhar, não para definir a intensidade, e a prescrição vai por PSE ou teste da fala (ver CARD-004).';

console.log('━ ANTES');
for (const r of await sql`
	SELECT code, severity, title, description FROM clinical_rules
	WHERE code IN ('CARD-002','CARD-004') ORDER BY code`) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
	console.log(`      ${r.description}`);
}

if (DRY) {
	console.log('\n━ FICARIA');
	console.log(`  CARD-002 descrição → ${CARD_002_DESCRICAO}`);
	console.log(`  [${CARD_004.severity}] CARD-004 — ${CARD_004.title}`);
	console.log(`      when: ${JSON.stringify(CARD_004.dsl.when)}`);
	console.log(`      forbid: ${JSON.stringify(CARD_004.dsl.forbid)}`);
	console.log('\n--dry-run: nada gravado.');
	await sql.end();
	process.exit(0);
}

const upd = await sql`
	UPDATE clinical_rules
	SET description = ${CARD_002_DESCRICAO}, version = version + 1, updated_at = now()
	WHERE code = 'CARD-002' AND description IS DISTINCT FROM ${CARD_002_DESCRICAO}`;
console.log(upd.count ? '✓ CARD-002 descrição atualizada' : '· CARD-002 já estava atualizada');

await sql`
	INSERT INTO clinical_rules (code, title, description, condition_tags, rule_dsl, severity, source_refs, active)
	VALUES (
		${CARD_004.code}, ${CARD_004.title}, ${CARD_004.description},
		${sql.json([])}, ${sql.json(CARD_004.dsl)}, ${CARD_004.severity}::severity,
		${sql.json([FONTE])}, true
	)
	ON CONFLICT (code) DO UPDATE SET
		title = EXCLUDED.title, description = EXCLUDED.description,
		condition_tags = EXCLUDED.condition_tags, rule_dsl = EXCLUDED.rule_dsl,
		severity = EXCLUDED.severity, source_refs = EXCLUDED.source_refs,
		active = true, version = clinical_rules.version + 1, updated_at = now()`;
console.log('✓ CARD-004');

const [chk] = await sql<Array<{ typ: string; dsl: string }>>`
	SELECT jsonb_typeof(rule_dsl) AS typ, rule_dsl::text AS dsl
	FROM clinical_rules WHERE code = 'CARD-004'`;
if (chk!.typ !== 'object') {
	console.error(`\nFALHOU: rule_dsl gravado como ${chk!.typ}`);
	await sql.end();
	process.exit(1);
}

console.log('\n━ DEPOIS');
for (const r of await sql`
	SELECT code, severity, title, description, rule_dsl::text AS dsl FROM clinical_rules
	WHERE code IN ('CARD-002','CARD-004') AND active ORDER BY code`) {
	console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
	console.log(`      ${r.description}`);
}
console.log(
	`\nregras ativas: ${(await sql`SELECT count(*)::int n FROM clinical_rules WHERE active`)[0]!.n}`
);
await sql.end();

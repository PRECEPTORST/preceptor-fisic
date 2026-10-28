/**
 * Conserta as tags de condição que as regras clínicas citavam com nome errado.
 *
 * As regras guardam o nome da condição como texto, em `condition_tags` e dentro
 * de `rule_dsl.when.condition_tags_any`, e o validador compara por igualdade
 * exata (`ctx.conditionTags.includes(t)`). Seis nomes usados pelas regras não
 * existem na `condition_taxonomy` nem são produzidos por
 * `deriveTagsFromDiagnosisLabels`, então essas regras NUNCA disparavam:
 *
 *   gestante_1tri/2tri/3tri → a derivação produz gestante_*_trimestre.
 *     Efeito: GEST-001 e GEST-002, as duas únicas regras vermelhas de
 *     gestação, jamais rodaram pra nenhuma aluna.
 *   dpoc_moderado → a taxonomia e a derivação usam dpoc_moderada (com a).
 *     Efeito: DPOC-001 não disparava pro caso mais comum de DPOC.
 *
 * Os outros dois órfãos ficam como estão, de propósito:
 *   pos_iam → coberto na prática, porque "infarto" na derivação cai em
 *     cardiopatia_isquemica, que as duas regras CARD já listam.
 *   pos_covid_longo → a derivação nunca produz; é tag morta, e criá-la é
 *     decisão clínica dos doutores, não conserto de digitação.
 *
 * Idempotente: roda quantas vezes quiser. Imprime antes e depois e confere que
 * sobrou zero tag órfã nas regras ativas (fora as duas aceitas acima).
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

/** nome errado → nome canônico da condition_taxonomy */
const RENAMES: Record<string, string> = {
	gestante_1tri: 'gestante_primeiro_trimestre',
	gestante_2tri: 'gestante_segundo_trimestre',
	gestante_3tri: 'gestante_terceiro_trimestre',
	dpoc_moderado: 'dpoc_moderada'
};

/** Órfãs conhecidas que NÃO são erro de digitação — ver cabeçalho. */
const ACEITAS = ['pos_iam', 'pos_covid_longo'];

type RuleRow = { code: string; tags_text: string; dsl_text: string };

/**
 * Desembrulha jsonb que foi gravado como STRING contendo JSON.
 *
 * Passar `${JSON.stringify(x)}::jsonb` num template do postgres.js grava o
 * texto como jsonb do tipo string, não como objeto — `jsonb_typeof` devolve
 * "string" e `jsonb_array_elements_text` quebra com "cannot extract elements
 * from a scalar". A gravação correta é `sql.json(x)`. Esta função conserta o
 * que já foi gravado errado e deixa o script idempotente nas duas formas.
 */
function unwrap<T>(text: string): T {
	let v: unknown = JSON.parse(text);
	while (typeof v === 'string') v = JSON.parse(v);
	return v as T;
}

async function orfas() {
	return sql<Array<{ tag: string; codes: string[] }>>`
		SELECT t.tag, array_agg(DISTINCT r.code) AS codes
		FROM clinical_rules r, jsonb_array_elements_text(r.condition_tags) t(tag)
		WHERE r.active
		  AND jsonb_typeof(r.condition_tags) = 'array'
		  AND NOT EXISTS (SELECT 1 FROM condition_taxonomy c WHERE c.tag = t.tag)
		GROUP BY t.tag ORDER BY t.tag`;
}

/** Linhas cujo jsonb está gravado como string — ver `unwrap`. */
async function embrulhadas() {
	return sql<Array<{ code: string }>>`
		SELECT code FROM clinical_rules
		WHERE jsonb_typeof(condition_tags) <> 'array' OR jsonb_typeof(rule_dsl) <> 'object'
		ORDER BY code`;
}

console.log('━ ANTES — tags citadas por regra que não existem na taxonomia');
for (const o of await orfas()) console.log(`  ${o.tag} → ${o.codes.join(', ')}`);
const presas = await embrulhadas();
if (presas.length > 0)
	console.log(`  (jsonb gravado como string em: ${presas.map((p) => p.code).join(', ')})`);

const alvos = Object.keys(RENAMES);
const rows = await sql<RuleRow[]>`
	SELECT code, condition_tags::text AS tags_text, rule_dsl::text AS dsl_text
	FROM clinical_rules
	WHERE active AND (
		condition_tags::text ~ ${alvos.join('|')}
		OR rule_dsl::text ~ ${alvos.join('|')}
		OR jsonb_typeof(condition_tags) <> 'array'
		OR jsonb_typeof(rule_dsl) <> 'object'
	) ORDER BY code`;

if (rows.length === 0) console.log('\nNada a renomear — já estava consertado.');

for (const r of rows) {
	const tagsAntes = unwrap<string[]>(r.tags_text);
	const tags = tagsAntes.map((t) => RENAMES[t] ?? t);
	// Troca nos nomes dentro do DSL sem reescrever a estrutura: o DSL tem
	// forbid/require/suggest_replacement que não são da nossa conta aqui.
	let dslText = JSON.stringify(unwrap<Record<string, unknown>>(r.dsl_text));
	for (const [de, para] of Object.entries(RENAMES)) {
		dslText = dslText.split(`"${de}"`).join(`"${para}"`);
	}
	const dsl = JSON.parse(dslText) as { when?: unknown };

	await sql`
		UPDATE clinical_rules
		SET condition_tags = ${sql.json(tags)},
		    rule_dsl = ${sql.json(dsl)},
		    version = version + 1,
		    updated_at = now()
		WHERE code = ${r.code}`;

	console.log(`\n✓ ${r.code}`);
	console.log(`  tags: ${JSON.stringify(tagsAntes)} → ${JSON.stringify(tags)}`);
	console.log(`  dsl.when: ${JSON.stringify(dsl.when)}`);
}

console.log('\n━ DEPOIS — tags órfãs restantes');
const resto = await orfas();
for (const o of resto) console.log(`  ${o.tag} → ${o.codes.join(', ')}`);

const aindaPresas = await embrulhadas();
if (aindaPresas.length > 0) {
	console.error(
		`\nFALHOU: jsonb ainda como string em ${aindaPresas.map((p) => p.code).join(', ')}`
	);
	await sql.end();
	process.exit(1);
}

const inesperadas = resto.filter((o) => !ACEITAS.includes(o.tag));
if (inesperadas.length > 0) {
	console.error(
		`\nFALHOU: ainda há órfã não prevista: ${inesperadas.map((o) => o.tag).join(', ')}`
	);
	await sql.end();
	process.exit(1);
}

console.log('\nOK — as órfãs restantes são só as aceitas (pos_iam, pos_covid_longo).');
await sql.end();

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

// Plan 50dd4c43 (José Jonas, LCA pós-cirúrgico)
const [plan] = await sql<any[]>`SELECT plan_data, restrictions FROM training_plans WHERE id = '50dd4c43-45f5-42e4-aff8-f3e0b0d779d7'`;
const allEx: { name: string; load_guidance: string; execution_notes?: string; contraindications?: string[] }[] = [];
for (const s of plan.plan_data?.weekly_sessions ?? []) {
	for (const ex of [...(s.warmup ?? []), ...(s.main ?? []), ...(s.cooldown ?? [])]) {
		allEx.push({
			name: ex.name,
			load_guidance: ex.load_guidance ?? '',
			execution_notes: ex.execution_notes,
			contraindications: ex.contraindications
		});
	}
}
console.log(`Exercícios no plano LCA: ${allEx.length}\n`);
for (const e of allEx.slice(0, 8)) {
	console.log(`  ${e.name} · load: "${e.load_guidance}"`);
}

// Regras aplicáveis ao perfil LCA
const rules = await sql<any[]>`
	SELECT code, severity, title, condition_tags, rule_dsl
	FROM clinical_rules
	WHERE active = true
	  AND (
	    rule_dsl->'when'->'condition_tags_any' ? 'lca_pos_cirurgico'
	    OR condition_tags ? 'lca_pos_cirurgico'
	  )
`;
console.log(`\nRegras aplicáveis ao perfil "lca_pos_cirurgico": ${rules.length}`);
for (const r of rules) {
	console.log(`  [${r.severity}] ${r.code} · ${r.title}`);
	console.log(`    DSL: ${JSON.stringify(r.rule_dsl)}`);
}

// Mostra restrictions atuais do plano
console.log(`\nRestrições atuais no plano (após re-validate): ${plan.restrictions?.length ?? 0}`);
for (const r of plan.restrictions ?? []) {
	console.log(`  [${r.level}] ${r.title.slice(0, 70)} · src: ${r.source?.type}${r.source?.rule_code ? ' (' + r.source.rule_code + ')' : ''}`);
}

await sql.end();

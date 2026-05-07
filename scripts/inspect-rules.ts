import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const [count] = await sql<any[]>`SELECT count(*)::int n FROM clinical_rules WHERE active = true`;
console.log(`${count.n} regras ativas\n`);

const rows = await sql<any[]>`SELECT code, severity, title, condition_tags, rule_dsl FROM clinical_rules WHERE active = true ORDER BY code`;
console.log('━ amostra das regras ━\n');
for (const r of rows.slice(0, 5)) {
	console.log(`[${r.severity.toUpperCase()}] ${r.code} · ${r.title}`);
	console.log(`  tags: ${JSON.stringify(r.condition_tags)}`);
	console.log(`  dsl:  ${JSON.stringify(r.rule_dsl, null, 2).split('\n').slice(0, 12).join('\n  ')}`);
	console.log();
}

console.log(`\ntotal: ${rows.length}, primeiros 5 acima.`);
console.log('codes únicos:', rows.map(r => r.code).join(', '));

await sql.end();

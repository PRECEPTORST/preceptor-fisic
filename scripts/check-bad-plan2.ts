import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const PID = '92d7d968-c5fe-4931-b6e0-6565765ec072';

const [r] = await sql<any[]>`SELECT restrictions FROM training_plans WHERE id = ${PID}`;
const rules = (r?.restrictions ?? []).filter((x: any) => x.source?.type === 'rule');
console.log(`${rules.length} violações:\n`);
for (const x of rules) {
	console.log(`  [${x.level.toUpperCase()}] ${x.source.rule_code} · ${x.title}`);
	console.log(`    afetados: ${(x.affected_exercises ?? []).join(', ') || '(plano todo)'}`);
}
await sql`DELETE FROM training_plans WHERE id = ${PID}`;
console.log('\n✓ removido.');
await sql.end();

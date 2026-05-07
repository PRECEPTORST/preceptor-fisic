import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const [r] = await sql<any[]>`SELECT restrictions FROM training_plans WHERE id = '286647ee-1b4b-49af-93d7-db8f7e621603'`;
const rules = (r?.restrictions ?? []).filter((x: any) => x.source?.type === 'rule');
console.log(`${rules.length} violações detectadas:\n`);
for (const x of rules) {
	console.log(`  [${x.level.toUpperCase()}] ${x.source.rule_code} · ${x.title}`);
	if (x.affected_exercises?.length) console.log(`    afetados: ${x.affected_exercises.join(', ')}`);
}

await sql`DELETE FROM training_plans WHERE id = '286647ee-1b4b-49af-93d7-db8f7e621603'`;
console.log('\n✓ plano de teste removido.');
await sql.end();

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const [plan] = await sql<any[]>`SELECT plan_data, restrictions FROM training_plans WHERE id = 'ea5931e0-155d-4e26-a914-657d10a2c629'`;

console.log('━ regra HTA-001 ━');
const [rule] = await sql<any[]>`SELECT code, severity, rule_dsl, description FROM clinical_rules WHERE code = 'HTA-001'`;
console.log(JSON.stringify(rule, null, 2));

console.log('\n━ restrições atuais no plano de hipertensão ━');
for (const r of plan.restrictions ?? []) {
	console.log(`  [${r.level}] ${r.title}`);
	console.log(`    src: ${JSON.stringify(r.source)}`);
	if (r.affected_exercises?.length > 0) {
		console.log(`    afetados: ${r.affected_exercises.join(', ')}`);
	}
}

await sql.end();

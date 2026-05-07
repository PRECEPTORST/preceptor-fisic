import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import { writeFileSync } from 'node:fs';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const plans = await sql`SELECT id, plan_data FROM training_plans WHERE plan_data IS NOT NULL ORDER BY created_at DESC LIMIT 3`;
writeFileSync('./.tmp-plan-shape.json', JSON.stringify(plans, null, 2));

// Top-level keys
const sample = (plans[0] as any).plan_data;
console.log('top-level keys:', Object.keys(sample));
console.log('weekly_sessions length:', sample.weekly_sessions?.length);
if (sample.weekly_sessions?.[0]) {
	const s = sample.weekly_sessions[0];
	console.log('first session keys:', Object.keys(s));
	if (s.main?.[0]) {
		console.log('first exercise (main[0]) keys:', Object.keys(s.main[0]));
	}
}

await sql.end();
console.log('\nfull shape salvo em .tmp-plan-shape.json');

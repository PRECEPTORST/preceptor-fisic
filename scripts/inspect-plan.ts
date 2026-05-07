import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const [students] = await sql`SELECT json_agg(s) AS j FROM (SELECT id, name, birth_date, sex, weight_kg, height_cm, professional_id FROM students LIMIT 5) s`;
console.log('STUDENTS:', JSON.stringify((students as any).j, null, 2));

const [hp] = await sql`SELECT json_agg(h) AS j FROM (SELECT * FROM health_profiles LIMIT 2) h`;
console.log('\nHEALTH_PROFILES:', JSON.stringify((hp as any).j, null, 2));

const [tp] = await sql`SELECT json_agg(t) AS j FROM (SELECT * FROM training_preferences LIMIT 2) t`;
console.log('\nTRAINING_PREFERENCES:', JSON.stringify((tp as any).j, null, 2));

const [plans] = await sql`SELECT json_agg(p) AS j FROM (SELECT id, student_id, status, plan_summary, plan_data, generated_at, published_at, restrictions FROM training_plans WHERE plan_data IS NOT NULL ORDER BY created_at DESC LIMIT 1) p`;
console.log('\nONE PLAN (most recent):', JSON.stringify((plans as any).j, null, 2).slice(0, 4000));

const [profs] = await sql`SELECT json_agg(p) AS j FROM (SELECT id, name, email, cref, specialty, auth_user_id FROM professionals) p`;
console.log('\nPROFESSIONALS:', JSON.stringify((profs as any).j, null, 2));

await sql.end();

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const [s] = await sql<any[]>`
	SELECT s.id, s.name, s.birth_date, s.sex, s.weight_kg, s.height_cm, s.email, s.phone,
		hp.diagnoses, hp.medications, hp.cardiovascular_risk,
		tp.experience_level, tp.weekly_sessions, tp.minutes_per_session, tp.goals, tp.equipment_available
	FROM students s
	LEFT JOIN health_profiles hp ON hp.student_id = s.id
	LEFT JOIN training_preferences tp ON tp.student_id = s.id
	ORDER BY s.created_at DESC LIMIT 1
`;

console.log(JSON.stringify(s, null, 2));
await sql.end();

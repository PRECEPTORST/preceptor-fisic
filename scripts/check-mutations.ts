import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const PRO = 'e353b60c-42db-42d5-922e-b0dac8f2c8d2';
const STUDENT = '0b780963-a89d-4ea1-a57e-30346a5ea0bd';
const PLAN = 'ea5931e0-155d-4e26-a914-657d10a2c629';

const [s] = await sql<any[]>`
	SELECT s.name, s.weight_kg, s.height_cm, tp.weekly_sessions, tp.minutes_per_session, tp.equipment_available
	FROM students s LEFT JOIN training_preferences tp ON tp.student_id = s.id
	WHERE s.id = ${STUDENT}
`;
console.log('━ student após edit ━');
console.log(s);

const [p] = await sql<any[]>`SELECT status, published_at FROM training_plans WHERE id = ${PLAN}`;
console.log('\n━ plan após publish ━');
console.log(p);

const [pro] = await sql<any[]>`SELECT name, cref, specialty FROM professionals WHERE id = ${PRO}`;
console.log('\n━ professional após save profile ━');
console.log(pro);

await sql.end();

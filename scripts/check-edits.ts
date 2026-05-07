import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const APPT = 'd1f296a5-7056-4dcc-883d-eda09b7b3171';
const EX = '37279904-5756-442e-a0bd-b61e355e75f5';

const [a] = await sql<any[]>`SELECT label, type, duration_minutes, starts_at FROM appointments WHERE id = ${APPT}`;
const [e] = await sql<any[]>`SELECT name, level, equipment FROM exercise_library WHERE id = ${EX}`;
console.log('appointment:', a);
console.log('exercise:', e);
await sql.end();

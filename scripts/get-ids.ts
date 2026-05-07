import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const PRO = 'e353b60c-42db-42d5-922e-b0dac8f2c8d2';

const [appt] = await sql<any[]>`SELECT id, label, type FROM appointments WHERE professional_id = ${PRO} ORDER BY created_at DESC LIMIT 1`;
const [ex] = await sql<any[]>`SELECT id, name FROM exercise_library WHERE professional_id = ${PRO} ORDER BY created_at DESC LIMIT 1`;
const [plan] = await sql<any[]>`SELECT id FROM training_plans WHERE professional_id = ${PRO} AND status = 'published' LIMIT 1`;
console.log({ appointmentId: appt?.id, appointmentLabel: appt?.label, exerciseId: ex?.id, exerciseName: ex?.name, publishedPlanId: plan?.id });
await sql.end();

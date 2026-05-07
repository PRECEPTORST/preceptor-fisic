import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const PRO = 'e353b60c-42db-42d5-922e-b0dac8f2c8d2';

const [counts] = await sql<any[]>`
	SELECT
		(SELECT count(*)::int FROM students WHERE professional_id = ${PRO} AND deleted_at IS NULL) AS students,
		(SELECT count(*)::int FROM physical_assessments WHERE created_by = ${PRO}) AS assessments,
		(SELECT count(*)::int FROM appointments WHERE professional_id = ${PRO}) AS appointments,
		(SELECT count(*)::int FROM exercise_library WHERE professional_id = ${PRO}) AS exercises,
		(SELECT count(*)::int FROM progress_records WHERE student_id IN (SELECT id FROM students WHERE professional_id = ${PRO})) AS progress
`;
console.log('estado atual no banco:', counts);

console.log('\n━ últimas 3 entries de cada tipo ━');
const a = await sql<any[]>`SELECT id, name, created_at FROM students WHERE professional_id = ${PRO} ORDER BY created_at DESC LIMIT 3`;
console.log('students:', a.map((x) => `${x.name}`).join(', '));
const b = await sql<any[]>`SELECT s.name, pa.body_fat_pct, pa.bmi, pa.assessed_at FROM physical_assessments pa JOIN students s ON s.id = pa.student_id WHERE pa.created_by = ${PRO} ORDER BY pa.assessed_at DESC LIMIT 3`;
console.log('assessments:', b.map((x) => `${x.name} · BMI ${x.bmi} · BF ${x.body_fat_pct}%`).join(' | '));
const c = await sql<any[]>`SELECT label, type, starts_at FROM appointments WHERE professional_id = ${PRO} ORDER BY created_at DESC LIMIT 3`;
console.log('appointments:', c.map((x) => `[${x.type}] ${x.label} @ ${new Date(x.starts_at).toLocaleString('pt-BR')}`).join(' | '));
const d = await sql<any[]>`SELECT name, muscle_group, equipment FROM exercise_library WHERE professional_id = ${PRO} ORDER BY created_at DESC LIMIT 3`;
console.log('exercises:', d.map((x) => `${x.name} (${x.muscle_group} · ${x.equipment ?? '—'})`).join(' | '));

await sql.end();

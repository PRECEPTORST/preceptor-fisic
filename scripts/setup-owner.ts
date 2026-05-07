/**
 * Re-linka o professional "Admin FisioMentor" pro auth user matheus@studio.fit.
 * Idempotente — pode rodar várias vezes.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const TARGET_AUTH_ID = '92932fde-2697-4285-a60e-1269af324713'; // matheus@studio.fit
const TARGET_PRO_ID = 'e353b60c-42db-42d5-922e-b0dac8f2c8d2'; // Admin FisioMentor (com 2 alunos + 21 planos)

const before = await sql`SELECT id, name, email, auth_user_id FROM professionals WHERE id = ${TARGET_PRO_ID}`;
console.log('antes:', before[0]);

await sql`
	UPDATE professionals SET
		auth_user_id = ${TARGET_AUTH_ID},
		email = 'matheus@studio.fit',
		name = 'Matheus da Cunha Castro',
		cref = COALESCE(cref, 'CREF 123456-G'),
		updated_at = now()
	WHERE id = ${TARGET_PRO_ID}
`;

const after = await sql`SELECT id, name, email, auth_user_id FROM professionals WHERE id = ${TARGET_PRO_ID}`;
console.log('depois:', after[0]);

const stats = await sql`
	SELECT
		(SELECT count(*)::int FROM students WHERE professional_id = ${TARGET_PRO_ID} AND deleted_at IS NULL) AS students,
		(SELECT count(*)::int FROM training_plans WHERE professional_id = ${TARGET_PRO_ID}) AS plans,
		(SELECT count(*)::int FROM ai_runs WHERE professional_id = ${TARGET_PRO_ID}) AS ai_runs
`;
console.log('agora seu professional tem:', stats[0]);

await sql.end();

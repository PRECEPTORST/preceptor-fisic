import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const STUDENT = 'dc02543e-b69a-4a91-bed1-220698bf4b14';

const rows = await sql<any[]>`
	SELECT id, session_label, perceived_effort, observations, created_at,
		(SELECT count(*)::int FROM jsonb_array_elements(exercises_done) WHERE value->>'completed' = 'true') AS done
	FROM training_sessions
	WHERE student_id = ${STUDENT}
	ORDER BY created_at DESC
	LIMIT 3
`;
console.log(`${rows.length} sessões registradas:\n`);
for (const r of rows) {
	console.log(`  [${new Date(r.created_at).toLocaleString('pt-BR')}] ${r.session_label}`);
	console.log(`    PSE: ${r.perceived_effort ?? '—'} · ex_done: ${r.done}`);
	if (r.observations) console.log(`    notas: ${r.observations.slice(0, 80)}`);
}
await sql.end();

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const rows = await sql<any[]>`
	SELECT id, status, plan_summary, restrictions
	FROM training_plans
	WHERE status = 'generated'
	  AND professional_id = 'e353b60c-42db-42d5-922e-b0dac8f2c8d2'
	ORDER BY created_at DESC
	LIMIT 25
`;

console.log(`${rows.length} planos generated · contagem de RED restrictions:\n`);
for (const r of rows) {
	const reds = (r.restrictions ?? []).filter((x: any) => x.level === 'red' && !x.resolved_at).length;
	const ok = reds === 0;
	console.log(`  ${ok ? '✓' : '✗'} ${r.id.slice(0, 8)} · reds=${reds} · ${(r.plan_summary ?? '').slice(0, 60)}`);
}

await sql.end();

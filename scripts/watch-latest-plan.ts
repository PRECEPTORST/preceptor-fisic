import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

for (let i = 0; i < 60; i++) {
	const [latest] = await sql<{ id: string; status: string; progress: number; phase: string | null; ai_run_id: string | null; created_at: Date; error: string | null }[]>`
		SELECT id, status, progress_pct AS progress, progress_phase AS phase, ai_run_id, created_at, error_message AS error
		FROM training_plans ORDER BY created_at DESC LIMIT 1
	`;
	if (!latest) {
		console.log('(sem planos ainda)');
		break;
	}
	const elapsed = Math.round((Date.now() - new Date(latest.created_at).getTime()) / 1000);
	console.log(`[${String(elapsed).padStart(3)}s] ${latest.status.padEnd(11)} ${String(latest.progress).padStart(3)}% · ${latest.phase ?? '—'}${latest.error ? ' · ERR: ' + latest.error.slice(0, 80) : ''}`);
	if (latest.status === 'generated' || latest.status === 'failed') {
		if (latest.ai_run_id) {
			const [run] = await sql<{ input: any; output: any; tokens_input: number | null; tokens_output: number | null; latency_ms: number | null; status: string }[]>`
				SELECT input, output, tokens_input, tokens_output, latency_ms, status FROM ai_runs WHERE id = ${latest.ai_run_id}
			`;
			if (run) {
				const orgDist = (run.input as any)?.rag_org_distribution ?? {};
				console.log('\n━ AI RUN ━');
				console.log(`  status:    ${run.status}`);
				console.log(`  tokens:    in=${run.tokens_input} out=${run.tokens_output}`);
				console.log(`  latency:   ${run.latency_ms}ms`);
				console.log(`  RAG orgs:  ${JSON.stringify(orgDist)}`);
				if (run.output) {
					const out = run.output as any;
					console.log(`  sessions:  ${(out.weekly_sessions ?? []).length}`);
					console.log(`  monitor:   ${(out.monitoring_parameters ?? []).length}`);
					console.log(`  restrict:  ${(out.restrictions ?? []).length}`);
					// Conta source_refs por tipo
					const allSourceRefs: any[] = [];
					for (const s of out.weekly_sessions ?? []) {
						for (const ex of [...(s.warmup ?? []), ...(s.main ?? []), ...(s.cooldown ?? [])]) {
							for (const r of ex.source_refs ?? []) allSourceRefs.push(r);
						}
					}
					const ragChunkIds = new Set(allSourceRefs.filter((r) => r.type === 'rag_chunk' && r.chunk_id).map((r) => r.chunk_id));
					console.log(`  src_refs:  ${allSourceRefs.length} (rag=${allSourceRefs.filter((r) => r.type === 'rag_chunk').length}, inference=${allSourceRefs.filter((r) => r.type === 'inference').length})`);
					console.log(`  unique chunks cited: ${ragChunkIds.size}`);

					// Quais orgs foram efetivamente citadas?
					if (ragChunkIds.size > 0) {
						const ids = Array.from(ragChunkIds);
						const cited = await sql<{ org: string; n: number }[]>`
							SELECT ks.organization::text AS org, count(*)::int AS n
							FROM knowledge_chunks kc
							JOIN knowledge_sources ks ON ks.id = kc.source_id
							WHERE kc.id = ANY(${ids}::uuid[])
							GROUP BY ks.organization
						`;
						console.log('\n━ ORGS EFETIVAMENTE CITADAS NO PLANO ━');
						for (const o of cited) console.log(`  ${o.org.padEnd(20)} ${o.n}`);
					}
				}
			}
		}
		break;
	}
	await new Promise((r) => setTimeout(r, 2000));
}

await sql.end();

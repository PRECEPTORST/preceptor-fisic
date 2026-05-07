import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const [plan] = await sql<any[]>`
	SELECT tp.id, tp.plan_summary, tp.plan_data, tp.restrictions, tp.monitoring_notes, tp.ai_run_id, ar.input AS run_input, ar.model, ar.tokens_input, ar.tokens_output, ar.latency_ms
	FROM training_plans tp
	LEFT JOIN ai_runs ar ON ar.id = tp.ai_run_id
	ORDER BY tp.created_at DESC LIMIT 1
`;

console.log('━━━ ÚLTIMO PLANO GERADO ━━━\n');
console.log('plan_id:    ', plan.id);
console.log('model:      ', plan.model);
console.log('latência:   ', plan.latency_ms + 'ms');
console.log('tokens:     ', `in=${plan.tokens_input} out=${plan.tokens_output}`);
console.log();

const ragInput = plan.run_input;
console.log('━ RAG INPUT ━');
console.log('  condition_tags:    ', ragInput.condition_tags);
console.log('  rag_chunk_ids:     ', ragInput.rag_chunk_ids?.length, 'chunks');
console.log('  rag_org_distribution:', ragInput.rag_org_distribution);
console.log();

console.log('━ PLAN SUMMARY ━');
console.log(plan.plan_summary);
console.log();

const data = plan.plan_data;
console.log('━ RESTRICTIONS ━');
for (const r of data.restrictions ?? []) {
	console.log(`  [${r.level.toUpperCase().padEnd(6)}] ${r.title}`);
	console.log(`           src: ${r.source.type}${r.source.chunk_id ? ' chunk=' + r.source.chunk_id.slice(0, 8) : ''}${r.source.note ? ' "' + r.source.note.slice(0, 80) + '"' : ''}`);
}
console.log();

console.log('━ SESSÃO 1 — primeiros 3 exercícios + suas citações ━');
const s1 = data.weekly_sessions?.[0];
if (s1) {
	console.log(`  ${s1.label} (${s1.duration_minutes}min) · foco: ${s1.focus}`);
	for (const ex of (s1.main ?? []).slice(0, 3)) {
		console.log(`\n  • ${ex.name}  ${ex.sets}×${ex.reps}  ${ex.load_guidance}`);
		for (const r of ex.source_refs ?? []) {
			console.log(`      [${r.type}]${r.chunk_id ? ' chunk=' + r.chunk_id.slice(0, 8) : ''}${r.note ? ' — ' + r.note.slice(0, 100) : ''}`);
		}
	}
}

await sql.end();

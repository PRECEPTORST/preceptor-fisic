import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const PID = 'f911ca42-f2cb-46b5-8038-dd22021daca7';

const [r] = await sql<any[]>`SELECT restrictions FROM training_plans WHERE id = ${PID}`;
const rules = (r?.restrictions ?? []).filter((x: any) => x.source?.type === 'rule');
console.log(`${rules.length} violações encontradas:\n`);
for (const x of rules) {
	console.log(`  [${x.level.toUpperCase()}] ${x.source.rule_code} · ${x.title}`);
	console.log(`    afetados: ${(x.affected_exercises ?? []).join(', ') || '(plano todo)'}`);
}

// Bonus: testa o regex direto pra confirmar
console.log('\n━ teste direto do regex ━');
const patterns = ['\\bpivô\\b', '\\bpiv[oô]\\b', '\\bpliom[ée]tric', '\\bplyo\\b', '\\bsalto\\b', '\\bcorrida\\s+lateral\\b'];
const names = ['salto pliométrico vertical quadríceps', 'corrida com pivô lateral adutor', 'agachamento valsalva máxima quadríceps'];
for (const name of names) {
	const matched = patterns.filter((p) => {
		try { return new RegExp(p, 'iu').test(name); } catch { return name.includes(p.toLowerCase()); }
	});
	console.log(`  "${name}"`);
	console.log(`    match: ${matched.length > 0 ? matched.join(', ') : '(none)'}`);
}

await sql`DELETE FROM training_plans WHERE id = ${PID}`;
console.log('\n✓ removido.');
await sql.end();

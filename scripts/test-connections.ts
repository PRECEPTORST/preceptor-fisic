/**
 * Testa conectividade com BR e v2 + habilita pgvector no BR.
 * Roda antes da migração principal pra detectar problemas cedo.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import postgres from 'postgres';

async function test(name: string, url: string, doExtension = false) {
	console.log(`\n▸ ${name}`);
	console.log(`  ${url.replace(/:[^:@]+@/, ':****@')}`);
	const sql = postgres(url, { prepare: false, idle_timeout: 5, max: 1, connect_timeout: 10 });
	try {
		const [v] = await sql`SELECT version() as v, current_database() as db`;
		console.log(`  ✓ conectou`);
		console.log(`  db: ${(v as any).db}`);
		console.log(`  version: ${((v as any).v as string).split(',')[0]}`);
		if (doExtension) {
			await sql`CREATE EXTENSION IF NOT EXISTS vector`;
			console.log(`  ✓ pgvector habilitado (idempotente)`);
		}
		const [counts] = await sql`SELECT count(*)::int as n FROM information_schema.tables WHERE table_schema = 'public'`;
		console.log(`  tabelas em public: ${(counts as any).n}`);
	} catch (e) {
		console.log(`  ✗ falhou: ${(e as Error).message}`);
		throw e;
	} finally {
		await sql.end();
	}
}

await test('v2 (US · us-west-2)', process.env.DATABASE_URL_V2_DIRECT!);
await test('BR (sa-east-1)', process.env.DATABASE_URL_DIRECT!, true);
console.log('\n✓ tudo ok — pode rodar npm run db:migrate em seguida.');

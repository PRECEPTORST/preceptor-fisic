/**
 * Aplica SQL não-journaled no BR: drizzle/manual/*.sql (reconciliação de
 * drift — colunas/enums fora das migrations geradas) e depois
 * drizzle/post-migration/*.sql (RLS policies + FK pra auth.users).
 * Ordem alfabética dentro de cada pasta. Idempotente — pode rodar várias vezes.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BR = process.env.DATABASE_URL_DIRECT;
if (!BR) {
	console.error('❌ DATABASE_URL_DIRECT faltando');
	process.exit(1);
}

const sql = postgres(BR, { prepare: false });
const dir = join(process.cwd(), 'drizzle');

// manual/ primeiro (policies do post-migration/ dependem de tabelas/colunas
// que só existem após a reconciliação de drift).
const files = ['manual', 'post-migration'].flatMap((sub) =>
	readdirSync(join(dir, sub))
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => join(sub, f))
);
try {
	for (const f of files) {
		console.log(`▸ aplicando ${f}…`);
		const raw = readFileSync(join(dir, f), 'utf-8');
		const content = raw.replace(/^﻿/, ''); // strip BOM
		await sql.unsafe(content);
		console.log(`  ✓ ok`);
	}
	console.log('\n✅ post-migration aplicado.');
} finally {
	await sql.end();
}

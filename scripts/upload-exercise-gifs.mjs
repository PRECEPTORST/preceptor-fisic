/**
 * Upload em batch dos GIFs do ExerciseDB Pro pro Supabase Storage
 * + atualização do video_url no exercise_catalog pra apontar pro .gif.
 *
 * Idempotente (upsert=true). Concorrência limitada pra não estourar API.
 *
 * Roda: node scripts/upload-exercise-gifs.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
	console.error('✗ env faltando');
	process.exit(1);
}

const GIFS_DIR = 'data/gifs';
const BUCKET = 'exercise-videos';
const CONCURRENCY = 8;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const files = readdirSync(GIFS_DIR).filter((f) => f.endsWith('.gif'));
console.log(`▸ ${files.length} GIFs em ${GIFS_DIR}`);

let uploaded = 0;
let failed = 0;
let skipped = 0;
const startMs = Date.now();

async function uploadOne(file) {
	const externalId = file.replace('.gif', '');
	const buf = readFileSync(join(GIFS_DIR, file));
	const { error } = await sb.storage.from(BUCKET).upload(file, buf, {
		contentType: 'image/gif',
		cacheControl: '31536000',
		upsert: true
	});
	if (error) {
		failed++;
		if (!error.message.includes('already exists')) {
			console.error(`\n  ✗ ${file}: ${error.message.slice(0, 100)}`);
		} else {
			skipped++;
		}
		return;
	}
	uploaded++;
	if ((uploaded + failed) % 50 === 0) {
		const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
		const rate = (uploaded + failed) / Math.max(1, Date.now() - startMs) * 1000;
		const eta = Math.round((files.length - uploaded - failed) / Math.max(0.1, rate));
		process.stdout.write(`\r  ${uploaded + failed}/${files.length} · ↑${uploaded} skip${skipped} err${failed} · ${elapsed}s · eta ${eta}s   `);
	}
}

// Pool simples de concorrência
async function runPool(items, n, fn) {
	const queue = [...items];
	const workers = Array.from({ length: n }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			if (item === undefined) break;
			await fn(item);
		}
	});
	await Promise.all(workers);
}

await runPool(files, CONCURRENCY, uploadOne);
console.log(`\n\n✓ Storage: ${uploaded} novos, ${skipped} já existiam, ${failed} falhas (sem dup)`);

// SÓ atualiza o DB se a maioria dos uploads passou. Antes da correção do
// bucket isso aqui rodava cego e deixava o catálogo apontando pra GIFs
// inexistentes — quebrava UI inteira até rollback.
const successRate = (uploaded + skipped) / Math.max(1, files.length);
if (successRate < 0.95) {
	console.error(`✗ Aborta UPDATE no DB: só ${(successRate*100).toFixed(1)}% uploads ok. Rode de novo depois de resolver as falhas.`);
	process.exit(1);
}

console.log('\nAtualizando exercise_catalog.video_url → .gif…');
const postgres = (await import('postgres')).default;
const sql = postgres(process.env.DATABASE_URL_DIRECT, { prepare: false });
const result = await sql`
	UPDATE exercise_catalog
	SET video_url = REPLACE(video_url, '.mp4', '.gif')
	WHERE video_url LIKE '%.mp4'`;
console.log(`✓ ${result.count} linhas atualizadas`);
await sql.end();

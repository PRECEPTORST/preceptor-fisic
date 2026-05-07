/**
 * Backup off-site do Postgres do Supabase (BR sa-east-1).
 *
 * Estratégia:
 *   - pg_dump via tools/pg_dump.exe binário (Postgres 17 client)
 *   - Compressão em gzip
 *   - Salva localmente em ./backups/YYYY-MM-DD_HH-MM.sql.gz
 *   - Retém 7 dias de backups locais (deleta antigos)
 *
 * Pra rodar:
 *   - Localmente: npm run backup
 *   - Em CI/cron: GitHub Action mensal (ver .github/workflows/backup.yml)
 *
 * Pra setup off-site real (S3, R2, GDrive):
 *   - Adiciona rclone após o gzip: rclone copy backups/*.gz remote:preceptor-backups/
 *   - OU adiciona @aws-sdk/client-s3 e faz upload no fim do script
 *
 * Requisitos:
 *   - DATABASE_URL_DIRECT no .env.local (porta 5432 — pooler 6543 não funciona pra dump)
 *   - pg_dump disponível em PATH OU em ./tools/pg_dump
 */
import { execFile } from 'node:child_process';
import { mkdirSync, statSync, readdirSync, unlinkSync, createWriteStream, createReadStream } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BACKUP_DIR = join(ROOT, 'backups');
const RETAIN_DAYS = 7;

const DATABASE_URL = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('✗ DATABASE_URL_DIRECT (ou DATABASE_URL) não setado em .env.local');
	process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
const tmpFile = join(BACKUP_DIR, `${ts}.sql`);
const gzFile = join(BACKUP_DIR, `${ts}.sql.gz`);

function findPgDump(): string {
	// 1. PATH
	const candidates = ['pg_dump', 'pg_dump.exe'];
	for (const c of candidates) {
		try {
			execFile(c, ['--version'], { timeout: 2000 });
			return c;
		} catch {
			/* continue */
		}
	}
	// 2. ./tools
	const toolsBin = join(ROOT, 'tools', process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump');
	try {
		statSync(toolsBin);
		return toolsBin;
	} catch {
		/* not found */
	}
	console.error(
		'✗ pg_dump não encontrado.\n' +
			'  Instale Postgres client (https://www.postgresql.org/download/) ou coloque pg_dump em ./tools/'
	);
	process.exit(1);
}

async function dump(): Promise<void> {
	const pgDump = findPgDump();
	console.log(`▸ Dumping ${DATABASE_URL!.split('@')[1]?.slice(0, 50)}…`);
	const startMs = Date.now();

	await new Promise<void>((res, rej) => {
		const proc = execFile(
			pgDump,
			[
				'--no-owner',
				'--no-acl',
				'--clean',
				'--if-exists',
				'--quote-all-identifiers',
				`--file=${tmpFile}`,
				DATABASE_URL!
			],
			{ maxBuffer: 1024 * 1024 * 100 },
			(err) => (err ? rej(err) : res())
		);
		proc.stderr?.on('data', (d) => process.stderr.write(d));
	});

	const sizeBytes = statSync(tmpFile).size;
	const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
	console.log(`✓ SQL dump: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB em ${elapsed}s`);
}

async function gzip(): Promise<void> {
	console.log(`▸ Comprimindo…`);
	const startMs = Date.now();
	await pipeline(createReadStream(tmpFile), createGzip({ level: 9 }), createWriteStream(gzFile));
	unlinkSync(tmpFile);
	const sizeBytes = statSync(gzFile).size;
	const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
	console.log(`✓ ${gzFile} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB) em ${elapsed}s`);
}

function rotate(): void {
	const cutoff = Date.now() - RETAIN_DAYS * 86400 * 1000;
	const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql.gz'));
	let deleted = 0;
	for (const f of files) {
		const full = join(BACKUP_DIR, f);
		if (statSync(full).mtimeMs < cutoff) {
			unlinkSync(full);
			deleted++;
		}
	}
	if (deleted) console.log(`✓ Removidos ${deleted} backup(s) > ${RETAIN_DAYS} dias`);
}

await dump();
await gzip();
rotate();

console.log(`\n✓ Backup concluído.`);
console.log(`  Pra upload off-site, adicione comando rclone/aws-cli no fim deste script.`);

/**
 * Migração FisioMentor v2 (US) → Preceptor Fisic v3 (BR · sa-east-1).
 *
 * Não usa pg_dump — só `postgres` (já nas deps) + Supabase Auth Admin API.
 *
 * Pré-requisitos:
 *   1. .env.local com:
 *      - DATABASE_URL_DIRECT, DATABASE_URL_V2_DIRECT (porta 5432, com senha)
 *      - PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (BR)
 *      - V2_SUPABASE_URL, V2_SUPABASE_SERVICE_ROLE_KEY (US)
 *   2. Schema aplicado no BR: `npm run db:generate && npm run db:migrate`
 *   3. pgvector habilitado no BR (Supabase SQL Editor):
 *        create extension if not exists vector;
 *
 * Como rodar:
 *   npx tsx scripts/migrate-from-v2.ts
 *
 * O que faz, em ordem:
 *   1. auth.users via Admin API (preserva UUIDs; senha aleatória — usuários precisam resetar)
 *   2. tabelas public.* em ordem de dependência (ON CONFLICT DO NOTHING — idempotente)
 *   3. relatório de contagens
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import postgres from 'postgres';

const required = ['DATABASE_URL_DIRECT', 'DATABASE_URL_V2_DIRECT', 'PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'V2_SUPABASE_URL', 'V2_SUPABASE_SERVICE_ROLE_KEY'] as const;
for (const k of required) {
	const v = process.env[k];
	if (!v || v.includes('[') || v.includes('xxxxx')) {
		console.error(`❌ ${k} faltando ou com placeholder em .env.local`);
		process.exit(1);
	}
}

const V2_DB = process.env.DATABASE_URL_V2_DIRECT!;
const BR_DB = process.env.DATABASE_URL_DIRECT!;
const V2_URL = process.env.V2_SUPABASE_URL!.replace(/\/$/, '');
const V2_SVC = process.env.V2_SUPABASE_SERVICE_ROLE_KEY!;
const BR_URL = process.env.PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
const BR_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Ordem de dependência — tabelas referenciadas vêm primeiro
const TABLE_ORDER = [
	'condition_taxonomy',
	'clinical_rules',
	'knowledge_sources',
	'professionals', // FK → auth.users
	'students', // FK → professionals
	'health_profiles',
	'training_preferences',
	'physical_assessments',
	'training_plans',
	'training_plan_revisions',
	'training_sessions',
	'progress_records',
	'student_drafts',
	'knowledge_chunks', // tem coluna vector
	'ai_runs',
	'audit_log'
] as const;

const us = postgres(V2_DB, { prepare: false, idle_timeout: 20 });
const br = postgres(BR_DB, { prepare: false, idle_timeout: 20 });

type AuthUser = {
	id: string;
	email?: string | null;
	phone?: string | null;
	user_metadata?: Record<string, unknown>;
	app_metadata?: Record<string, unknown>;
	email_confirmed_at?: string | null;
	phone_confirmed_at?: string | null;
	banned_until?: string | null;
	created_at: string;
};

async function fetchAuthUsers(): Promise<AuthUser[]> {
	const all: AuthUser[] = [];
	let page = 1;
	const perPage = 200;
	while (true) {
		const res = await fetch(`${V2_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
			headers: { Authorization: `Bearer ${V2_SVC}`, apikey: V2_SVC }
		});
		if (!res.ok) throw new Error(`v2 auth list failed: ${res.status} ${await res.text()}`);
		const data = (await res.json()) as { users: AuthUser[] };
		all.push(...data.users);
		if (data.users.length < perPage) break;
		page++;
	}
	return all;
}

async function createAuthUserOnBR(u: AuthUser, tempPassword: string) {
	const res = await fetch(`${BR_URL}/auth/v1/admin/users`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${BR_SVC}`,
			apikey: BR_SVC,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			id: u.id,
			email: u.email ?? undefined,
			phone: u.phone ?? undefined,
			password: tempPassword,
			email_confirm: !!u.email_confirmed_at,
			phone_confirm: !!u.phone_confirmed_at,
			user_metadata: u.user_metadata ?? {},
			app_metadata: u.app_metadata ?? {}
		})
	});
	if (res.status === 422 || res.status === 409) return 'exists' as const;
	if (!res.ok) throw new Error(`br auth create ${u.email}: ${res.status} ${await res.text()}`);
	return 'created' as const;
}

function randomPassword() {
	return Math.random().toString(36).slice(2) + Math.random().toString(36).toUpperCase().slice(2) + '#1';
}

async function migrateAuth() {
	console.log('▸ 1/3 · auth.users (Admin API)…');
	const users = await fetchAuthUsers();
	console.log(`  encontrados ${users.length} no v2`);
	let created = 0,
		exists = 0;
	for (const u of users) {
		try {
			const r = await createAuthUserOnBR(u, randomPassword());
			if (r === 'created') created++;
			else exists++;
		} catch (e) {
			console.error(`  ✗ ${u.email}:`, (e as Error).message);
		}
	}
	console.log(`  ✓ ${created} criados, ${exists} já existiam`);
	console.log(
		`  ⚠ usuários precisam resetar senha (foi gerada aleatória) — mande "Esqueci minha senha" pra cada um, ou peça pra eles fazerem`
	);
}

async function migrateTables() {
	console.log('\n▸ 2/3 · tabelas public.*…');
	for (const table of TABLE_ORDER) {
		const rows = (await us`SELECT * FROM ${us(table)}`) as Record<string, unknown>[];
		if (!rows.length) {
			console.log(`  ${table.padEnd(28)} (vazia)`);
			continue;
		}
		const cols = Object.keys(rows[0]!);

		// Para vectors: o postgres lib retorna como string; passa direto que casta automaticamente
		// Inserir em batches pra evitar payload gigante
		const batchSize = 500;
		let migrated = 0;
		for (let i = 0; i < rows.length; i += batchSize) {
			const batch = rows.slice(i, i + batchSize);
			try {
				await br`INSERT INTO ${br(table)} ${br(batch, ...cols)} ON CONFLICT DO NOTHING`;
				migrated += batch.length;
			} catch (e) {
				console.error(`  ✗ ${table} batch ${i}-${i + batch.length}: ${(e as Error).message}`);
			}
		}
		console.log(`  ${table.padEnd(28)} ${String(migrated).padStart(5)}/${rows.length}`);
	}
}

async function verify() {
	console.log('\n▸ 3/3 · verificação…');
	console.log(`${'tabela'.padEnd(28)}${'v2'.padStart(8)}${'br'.padStart(8)}  status`);
	console.log('─'.repeat(54));
	let allOk = true;
	for (const t of TABLE_ORDER) {
		try {
			const [a] = await us`SELECT count(*)::int AS n FROM ${us(t)}`;
			const [b] = await br`SELECT count(*)::int AS n FROM ${br(t)}`;
			const ok = (a as { n: number }).n === (b as { n: number }).n;
			if (!ok) allOk = false;
			console.log(
				`${t.padEnd(28)}${String((a as { n: number }).n).padStart(8)}${String((b as { n: number }).n).padStart(8)}  ${ok ? '✓' : '✗ divergente'}`
			);
		} catch (e) {
			allOk = false;
			console.log(`${t.padEnd(28)}${'ERR'.padStart(8)}${'ERR'.padStart(8)}  ${(e as Error).message}`);
		}
	}
	console.log(allOk ? '\n✅ migração ok.' : '\n⚠️  divergências — ver erros acima.');
}

try {
	await migrateAuth();
	await migrateTables();
	await verify();
} finally {
	await us.end();
	await br.end();
}

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Varredura estática dos SQLs versionados (auditoria 2026-10-22): toda tabela
// criada precisa de RLS, e o profissional não pode escrever na própria linha.

const dir = join(process.cwd(), 'drizzle');
const ler = (sub: string) =>
	readdirSync(join(dir, sub))
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => readFileSync(join(dir, sub, f), 'utf-8').replace(/^﻿/, ''));

const todos = ['.', 'manual', 'post-migration'].flatMap(ler).join('\n');
const post = ler('post-migration').join('\n');

describe('RLS versionada', () => {
	const tabelas = [
		...todos.matchAll(/create table (?:if not exists )?(?:public\.)?"?([a-z_]+)"?/gi)
	].map((m) => m[1]!.toLowerCase());

	it('encontra as tabelas', () => {
		expect(tabelas).toContain('professionals');
		expect(tabelas).toContain('organizations');
		expect(tabelas).toContain('organization_invites');
	});

	it.each([...new Set(tabelas)])('%s tem RLS ativa', (t) => {
		const direto = new RegExp(
			`alter table (?:public\\.)?"?${t}"? enable row level security`,
			'i'
		).test(todos);
		const viaLoop = new RegExp(`unnest\\(array\\[[^\\]]*'${t}'`, 'i').test(todos);
		expect(direto || viaLoop).toBe(true);
	});

	it('a última policy own_row de professionals é só SELECT', () => {
		const policies = [
			...post.matchAll(/create policy "own_row" on public\.professionals\s+for (\w+)/gi)
		];
		expect(policies.length).toBeGreaterThan(0);
		expect(policies.at(-1)![1]!.toLowerCase()).toBe('select');
	});

	it('revoga escrita em professionals para anon/authenticated', () => {
		expect(post).toMatch(
			/revoke insert, update[^;]*on public\.professionals from anon, authenticated/i
		);
	});
});

import { createClient } from '@supabase/supabase-js';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Professional } from '$lib/server/db/schema';
import { getProfessionalByAuthId } from '$lib/server/queries';
import { hasAccess } from '$lib/server/organization';

export type AuthUser = { id: string; email: string | null };

export type Vars = {
	user: AuthUser;
	professional: Professional;
};

let supabase: ReturnType<typeof createClient> | null = null;
function client() {
	const url = process.env.PUBLIC_SUPABASE_URL;
	const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) throw new HTTPException(503, { message: 'Supabase não configurado' });
	supabase ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
	return supabase;
}

/** Valida o JWT do Supabase no header Authorization e expõe o usuário. */
export const requireUser = createMiddleware<{ Variables: Pick<Vars, 'user'> }>(async (c, next) => {
	const header = c.req.header('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : '';
	if (!token) throw new HTTPException(401, { message: 'Sessão ausente' });
	const { data, error } = await client().auth.getUser(token);
	if (error || !data.user) throw new HTTPException(401, { message: 'Sessão inválida ou expirada' });
	c.set('user', { id: data.user.id, email: data.user.email ?? null });
	await next();
});

/** Usuário com cadastro de profissional. Sem cadastro → 409 (front manda pro onboarding). */
export const requireProfessional = createMiddleware<{ Variables: Vars }>(async (c, next) => {
	const prof = await getProfessionalByAuthId(c.get('user').id);
	if (!prof) throw new HTTPException(409, { message: 'onboarding' });
	c.set('professional', prof);
	await next();
});

/** Profissional com acesso (assinatura própria, trial ou herdada da clínica). */
export const requireAccess = createMiddleware<{ Variables: Vars }>(async (c, next) => {
	if (!(await hasAccess(c.get('professional')))) throw new HTTPException(402, { message: 'sem-acesso' });
	await next();
});

/** Admin do CRM interno. Centraliza o requireAdmin que estava copiado nas actions. */
export const requireAdmin = createMiddleware<{ Variables: Vars }>(async (c, next) => {
	if (!c.get('professional').isAdmin) throw new HTTPException(403, { message: 'Só administradores' });
	await next();
});

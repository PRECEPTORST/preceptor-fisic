import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkAndAudit } from '$lib/server/rate-limit';
import { audit, clientFingerprint } from '$lib/server/audit';

/**
 * Entrar e cadastrar no servidor, com o mesmo rate limit, a mesma auditoria e
 * as mesmas mensagens do SvelteKit ((public)/login/+page.server.ts). Devolve os
 * tokens; o browser só chama supabase.auth.setSession.
 */
function anon() {
	return createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

const Entrar = z.object({ email: z.string().trim().min(1), password: z.string().min(1) });
const Cadastrar = z.object({
	name: z.string().trim().min(1),
	email: z.string().trim().email(),
	password: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres.'),
	acceptTerms: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' }) })
});

type Tokens = { access_token: string; refresh_token: string };

export const auth = new Hono()
	.post('/entrar', async (c) => {
		const rl = await checkAndAudit({ key: 'login', request: c.req.raw });
		if (!rl.allowed) return c.json({ error: rl.message ?? 'Muitas tentativas.' }, 429);
		const parsed = Entrar.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: 'Preencha email e senha.' }, 400);
		const { email, password } = parsed.data;

		const { data, error } = await anon().auth.signInWithPassword({ email, password });
		const fp = clientFingerprint(c.req.raw);
		if (error || !data.session) {
			audit({ action: 'auth.login', entityType: 'auth', payload: { ok: false, email: email.slice(0, 80), reason: error?.message }, ...fp });
			const msg = error?.message.includes('Invalid login credentials')
				? 'Email ou senha incorretos.'
				: 'Não foi possível entrar. Tente novamente.';
			return c.json({ error: msg }, 401);
		}
		audit({ action: 'auth.login', entityType: 'auth', entityId: data.user?.id ?? null, payload: { ok: true, email: email.slice(0, 80) }, ...fp });
		return c.json<Tokens>({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
	})
	.post('/cadastrar', async (c) => {
		const rl = await checkAndAudit({ key: 'signup', request: c.req.raw });
		if (!rl.allowed) return c.json({ error: rl.message ?? 'Muitas tentativas.' }, 429);
		const parsed = Cadastrar.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			const msg = first?.path[0] === 'password' || first?.path[0] === 'acceptTerms' ? first.message : 'Preencha nome, email e senha.';
			return c.json({ error: msg }, 400);
		}
		const { name, email, password } = parsed.data;
		const sb = anon();
		const { data, error } = await sb.auth.signUp({
			email,
			password,
			options: { data: { name, accepted_terms_at: new Date().toISOString() } }
		});
		const fp = clientFingerprint(c.req.raw);
		if (error) {
			audit({ action: 'auth.signup', entityType: 'auth', payload: { ok: false, email: email.slice(0, 80), reason: error.message }, ...fp });
			const msg = error.message.includes('already registered')
				? 'Este email já está cadastrado. Use "Entrar" ou recupere a senha.'
				: 'Não foi possível criar a conta. Tente novamente.';
			return c.json({ error: msg }, 400);
		}
		// E-mail já cadastrado volta como sucesso falso com identities vazio (anti-enumeração do Supabase).
		if (data.user && (data.user.identities?.length ?? 0) === 0) {
			audit({ action: 'auth.signup', entityType: 'auth', payload: { ok: false, email: email.slice(0, 80), reason: 'email_ja_cadastrado' }, ...fp });
			return c.json({ error: 'Este e-mail já tem conta. Entre com sua senha ou use "Esqueci minha senha".' }, 400);
		}
		audit({ action: 'auth.signup', entityType: 'auth', entityId: data.user?.id ?? null, payload: { ok: true, email: email.slice(0, 80), hasName: true }, ...fp });

		// O e-mail é auto-confirmado por trigger; se o signUp não devolveu sessão, entra na hora.
		let session = data.session;
		if (!session) {
			const r = await sb.auth.signInWithPassword({ email, password });
			session = r.data.session;
		}
		if (!session) return c.json({ ok: true, message: 'Conta criada! Faça login com seu email e senha.' });
		return c.json<Tokens>({ access_token: session.access_token, refresh_token: session.refresh_token });
	});

/**
 * Redefinir senha — destino do link enviado por email.
 *
 * O load consome o token da URL e cria a sessão de recovery via cookies
 * (createServerClient do hooks). Dois formatos aceitos:
 *   ?token_hash=...&type=recovery → verifyOtp (template customizado,
 *     funciona cross-device — preferido)
 *   ?code=...                     → exchangeCodeForSession (template default
 *     PKCE do Supabase; só funciona no mesmo navegador que pediu o reset)
 * Com a sessão criada, a action atualiza a senha via updateUser.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const TOKEN_ERROR = 'Link inválido ou expirado — solicite um novo em "Esqueci minha senha".';

export const load = (async ({ url, locals }) => {
	if (!locals.supabase) return { tokenError: 'Auth não configurado.' };

	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	const code = url.searchParams.get('code');

	if (tokenHash && type === 'recovery') {
		const { error } = await locals.supabase.auth.verifyOtp({
			type: 'recovery',
			token_hash: tokenHash
		});
		if (error) {
			// Token é single-use: num reload a sessão já pode existir — segue.
			const { session } = await locals.safeGetSession();
			if (!session) return { tokenError: TOKEN_ERROR };
		}
		return {};
	}

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (error) {
			const { session } = await locals.safeGetSession();
			if (!session) return { tokenError: TOKEN_ERROR };
		}
		return {};
	}

	// Sem token na URL: só é válido se já existe sessão (ex.: reload pós-verify).
	const { session } = await locals.safeGetSession();
	if (!session) return { tokenError: TOKEN_ERROR };
	return {};
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.supabase) {
			return fail(500, { error: 'Auth não configurado.' });
		}
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		if (password.length < 8) {
			return fail(400, { error: 'Senha precisa ter pelo menos 8 caracteres.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'As senhas não coincidem.' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) {
			return fail(400, {
				error: 'Não foi possível atualizar. O link pode ter expirado — solicite um novo.'
			});
		}

		// Encerra a sessão de recovery: o usuário entra com a senha nova e o
		// /login não redireciona pro dashboard (guard bounce em sessão ativa).
		await locals.supabase.auth.signOut();

		redirect(303, '/login?reset=ok');
	}
};

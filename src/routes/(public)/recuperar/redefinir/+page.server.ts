/**
 * Redefinir senha — destino do link enviado por e-mail ou WhatsApp.
 *
 * O token de recovery é de USO ÚNICO. Por isso o load NÃO o consome: ele só
 * lê o token da URL e entrega pro formulário. Se consumíssemos no load (GET),
 * qualquer pré-carregamento da URL queimaria o token antes de a pessoa clicar,
 * e é exatamente o que o robô de preview do WhatsApp (além de antivírus e
 * prefetch de navegador) faz. Resultado antigo: a pessoa clicava e via "link
 * inválido", porque o preview já tinha gasto o token.
 *
 * A validação do token acontece só no POST, quando a nova senha é enviada:
 *   ?token_hash=...&type=recovery → verifyOtp (cross-device, preferido)
 *   ?code=...                     → exchangeCodeForSession (PKCE, same-browser)
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const TOKEN_ERROR = 'Link inválido ou expirado — solicite um novo em "Esqueci minha senha".';

export const load = (async ({ url, locals }) => {
	if (!locals.supabase) return { tokenError: 'Auth não configurado.', tokenHash: '', code: '' };

	const tokenHash = url.searchParams.get('token_hash') ?? '';
	const type = url.searchParams.get('type');
	const code = url.searchParams.get('code') ?? '';

	// Tem token na URL: entrega pro form SEM consumir. A validação é no POST.
	if ((tokenHash && type === 'recovery') || code) {
		return { tokenHash, code };
	}

	// Sem token: só vale se já existe sessão de recovery ativa (ex.: a pessoa
	// recarregou a página depois de já ter enviado a senha uma vez).
	const { session } = await locals.safeGetSession();
	if (!session) return { tokenError: TOKEN_ERROR, tokenHash: '', code: '' };
	return { tokenHash: '', code: '' };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.supabase) {
			return fail(500, { error: 'Auth não configurado.' });
		}
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');
		const tokenHash = String(data.get('token_hash') ?? '');
		const code = String(data.get('code') ?? '');

		// Valida a senha ANTES de tocar no token: um erro de digitação não pode
		// queimar o link, senão a pessoa erra a confirmação e perde o acesso.
		if (password.length < 8) {
			return fail(400, { error: 'Senha precisa ter pelo menos 8 caracteres.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'As senhas não coincidem.' });
		}

		// Só agora consome o token e abre a sessão de recovery.
		let hasSession = false;
		if (tokenHash) {
			const { error } = await locals.supabase.auth.verifyOtp({
				type: 'recovery',
				token_hash: tokenHash
			});
			hasSession = !error;
		} else if (code) {
			const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
			hasSession = !error;
		}
		// Reenvio depois de um verify que já rodou: a sessão pode já existir.
		if (!hasSession) {
			const { session } = await locals.safeGetSession();
			hasSession = Boolean(session);
		}
		if (!hasSession) {
			return fail(400, { error: TOKEN_ERROR });
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

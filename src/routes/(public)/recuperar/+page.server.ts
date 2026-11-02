/**
 * Recuperar senha.
 *
 * O e-mail sai pelo Resend, não pelo SMTP do Supabase. Motivo: o SMTP padrão
 * limita a poucos envios por hora e só entrega pra endereços do time, então
 * e-mail de cliente (gmail, hotmail) nunca chegava e ninguém conseguia voltar
 * pra conta.
 *
 * Fluxo:
 *   1. Usuário digita o e-mail aqui
 *   2. generateLink (service_role) devolve o token SEM disparar e-mail
 *   3. Montamos a URL do nosso domínio com token_hash e enviamos pelo Resend
 *   4. /recuperar/redefinir consome o token_hash via verifyOtp
 *
 * Montar a URL aqui também contorna a allowlist de Redirect URLs do projeto
 * Supabase, que está apontando pra localhost e ignora o redirectTo enviado.
 */
import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import { env as privEnv } from '$env/dynamic/private';
import { checkAndAudit } from '$lib/server/rate-limit';
import { audit, clientFingerprint } from '$lib/server/audit';
import { sendPasswordResetLink } from '$lib/server/email';
import { logger } from '$lib/server/logger';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, getClientAddress }) => {
		// Rate limit: 3 tentativas / 10 min por IP (anti email-bomb)
		const rl = await checkAndAudit({ key: 'password_reset', request, getClientAddress });
		if (!rl.allowed) {
			return fail(429, { email: '', error: rl.message ?? 'Muitas tentativas.' });
		}

		const data = await request.formData();
		const email = String(data.get('email') ?? '')
			.trim()
			.toLowerCase();
		if (!email || !email.includes('@')) {
			return fail(400, { email, error: 'Informe um e-mail válido.' });
		}

		const supabaseUrl = env.PUBLIC_SUPABASE_URL;
		const serviceKey = privEnv.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceKey) {
			logger.error({}, 'reset.misconfigured (falta PUBLIC_SUPABASE_URL ou service role)');
			return fail(500, { email, error: 'Recuperação de senha indisponível no momento.' });
		}

		// Fallback = staging, o ambiente que os usuários reais usam. A produção
		// antiga está congelada; sem isso o link cairia num site morto.
		const base =
			env.PUBLIC_APP_URL?.replace(/\/$/, '') ||
			url.origin ||
			'https://preceptor-fisic-staging.vercel.app';

		const admin = createClient(supabaseUrl, serviceKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});

		const { data: link, error } = await admin.auth.admin.generateLink({
			type: 'recovery',
			email
		});

		const fp = clientFingerprint(request, getClientAddress);
		const hashedToken = link?.properties?.hashed_token;

		if (error || !hashedToken) {
			// 404 = e-mail sem conta. Não é falha do sistema e não pode aparecer
			// pro usuário, senão o formulário vira um verificador de quem tem conta.
			const semConta = error?.status === 404;
			if (!semConta) {
				logger.error({ err: error?.message }, 'reset.generate_link.failed');
			}
			audit({
				action: 'auth.password_reset_request',
				entityType: 'auth',
				payload: {
					email: email.slice(0, 80),
					delivered: false,
					reason: semConta ? 'no_account' : 'generate_link_error'
				},
				...fp
			});
			// Mesma resposta do caminho feliz: não revela existência da conta.
			return { success: true, email };
		}

		// URL do nosso domínio: /recuperar/redefinir já sabe consumir token_hash
		// via verifyOtp, e esse formato funciona em qualquer dispositivo (o fluxo
		// ?code= do Supabase só valia no mesmo navegador que pediu o reset).
		const resetUrl = `${base}/recuperar/redefinir?token_hash=${encodeURIComponent(
			hashedToken
		)}&type=recovery`;

		const sent = await sendPasswordResetLink({ to: email, resetUrl });
		if (!sent.sent) {
			// Sem RESEND_API_KEY o envio é pulado silenciosamente — precisa gritar
			// no log, senão o sintoma vira "o botão não faz nada" de novo.
			logger.error(
				{ skipped: sent.skipped, err: sent.error },
				'reset.email.not_sent (verifique RESEND_API_KEY)'
			);
		}

		audit({
			action: 'auth.password_reset_request',
			entityType: 'auth',
			payload: { email: email.slice(0, 80), delivered: sent.sent },
			...fp
		});

		return { success: true, email };
	}
};

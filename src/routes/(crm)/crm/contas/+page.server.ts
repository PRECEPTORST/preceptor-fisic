/**
 * Contas — suporte de acesso.
 *
 * Gera o link de redefinição de senha na hora, pro admin mandar pelo WhatsApp.
 * Existe porque o e-mail automático ainda não sai: o SMTP padrão do Supabase
 * só entrega pra endereços do time, então cliente com gmail/hotmail ficava sem
 * conseguir voltar pra conta. Enquanto o envio automático não é ligado, o
 * suporte resolve manualmente por aqui.
 *
 * Auth + admin já são garantidos pelo layout do grupo (crm).
 */
import { fail } from '@sveltejs/kit';
import { desc, sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { db } from '$lib/server/db';
import { professionals } from '$lib/server/db/schema';
import { env } from '$env/dynamic/public';
import { env as privEnv } from '$env/dynamic/private';
import { getProfessionalByAuthId } from '$lib/server/queries';
import { audit, clientFingerprint } from '$lib/server/audit';
import { logger } from '$lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

export const load = (async () => {
	const contas = await db
		.select({
			id: professionals.id,
			name: professionals.name,
			email: professionals.email,
			cref: professionals.cref,
			isAdmin: professionals.isAdmin,
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt,
			createdAt: professionals.createdAt
		})
		.from(professionals)
		.orderBy(desc(professionals.createdAt));

	return { contas };
}) satisfies PageServerLoad;

export const actions: Actions = {
	gerarLink: async ({ request, locals, url, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const admin = await getProfessionalByAuthId(locals.user.id);
		if (!admin?.isAdmin) return fail(403, { error: 'acesso restrito' });

		const fd = await request.formData();
		const email = String(fd.get('email') ?? '')
			.trim()
			.toLowerCase();
		if (!email || !email.includes('@')) {
			return fail(400, { error: 'e-mail inválido' });
		}

		const supabaseUrl = env.PUBLIC_SUPABASE_URL;
		const serviceKey = privEnv.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceKey) {
			logger.error({}, 'crm.contas.misconfigured');
			return fail(500, { error: 'Supabase não configurado neste ambiente.' });
		}

		// A origem da requisição vem PRIMEIRO, de propósito: o link tem que
		// apontar pro mesmo ambiente onde o admin está gerando. PUBLIC_APP_URL
		// ficou apontando pra produção antiga (congelada em 03/07), e confiar
		// nela mandaria o profissional redefinir a senha num site morto.
		const base = url.origin || env.PUBLIC_APP_URL?.replace(/\/$/, '') || '';
		if (!base) {
			logger.error({}, 'crm.contas.sem_base_url');
			return fail(500, { error: 'Não consegui montar o link neste ambiente.' });
		}

		const supa = createClient(supabaseUrl, serviceKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});

		const { data: link, error } = await supa.auth.admin.generateLink({
			type: 'recovery',
			email
		});

		const hashedToken = link?.properties?.hashed_token;
		if (error || !hashedToken) {
			const semConta = error?.status === 404;
			if (!semConta) logger.error({ err: error?.message }, 'crm.contas.generate_link.failed');
			return fail(semConta ? 404 : 500, {
				error: semConta
					? 'Não existe conta com esse e-mail.'
					: 'Não consegui gerar o link. Tente de novo.'
			});
		}

		const resetUrl = `${base}/recuperar/redefinir?token_hash=${encodeURIComponent(
			hashedToken
		)}&type=recovery`;

		// Ação sensível: dá acesso à conta de outra pessoa. Fica registrado quem
		// gerou, pra quem e quando.
		audit({
			action: 'admin.password_reset_link_generated',
			professionalId: admin.id,
			entityType: 'auth',
			payload: { target_email: email.slice(0, 120) },
			...clientFingerprint(request, getClientAddress)
		});

		return { success: true, email, resetUrl };
	}
};

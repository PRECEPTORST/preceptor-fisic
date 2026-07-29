/**
 * Aceite de convite para entrar numa clínica.
 *
 * Mora no grupo (app) porque exige estar logado como profissional. Fica na
 * lista de rotas livres do gate: quem foi convidado normalmente não tem
 * assinatura própria, então o muro engoliria o convite antes de ele valer.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { getProfessionalByAuthId } from '$lib/server/queries';
import { getOrganization, acceptInvite, hashInviteToken } from '$lib/server/organization';
import { db } from '$lib/server/db';
import { organizationInvites } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { audit, clientFingerprint } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, locals }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(`/convite/${params.token}`)}`);
	const professional = await getProfessionalByAuthId(locals.user.id);
	if (!professional)
		redirect(303, `/onboarding?next=${encodeURIComponent(`/convite/${params.token}`)}`);

	const [convite] = await db
		.select()
		.from(organizationInvites)
		.where(eq(organizationInvites.tokenHash, hashInviteToken(params.token)))
		.limit(1);

	if (!convite) error(404, 'convite não encontrado');
	const org = await getOrganization(convite.organizationId);
	if (!org) error(404, 'clínica não encontrada');

	// Estado do convite calculado no servidor: a tela só mostra.
	const situacao = convite.acceptedAt
		? 'usado'
		: convite.revokedAt
			? 'cancelado'
			: convite.expiresAt.getTime() < Date.now()
				? 'expirado'
				: professional.organizationId === org.id
					? 'ja_membro'
					: professional.organizationId
						? 'outra_clinica'
						: 'valido';

	return {
		situacao,
		clinica: org.name,
		convidado: convite.email,
		voce: { nome: professional.name, email: professional.email }
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	aceitar: async ({ params, locals, request, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		const r = await acceptInvite(params.token!, professional);
		if (!r.ok) return fail(400, { error: r.erro });

		audit({
			action: 'org.invite_accepted',
			professionalId: professional.id,
			entityType: 'organization',
			entityId: r.organizationId,
			...clientFingerprint(request, getClientAddress)
		});

		redirect(303, '/dashboard');
	}
};

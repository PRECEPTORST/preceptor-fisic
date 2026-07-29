/**
 * Equipe — painel de quem administra a clínica.
 *
 * Só o dono entra. Membro comum não tem o que fazer aqui e não deve ver a
 * lista de colegas nem os números deles.
 *
 * O que aparece: quantas vagas, quanto da franquia de IA já foi usada e o
 * consolidado por profissional (alunos, planos, gerações). NÃO aparece ficha
 * de aluno: dado de saúde continua restrito a quem atende.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { professionals } from '$lib/server/db/schema';
import { getProfessionalByAuthId } from '$lib/server/queries';
import { currentCycleStart } from '$lib/server/subscription';
import {
	getOrganization,
	listMembers,
	listPendingInvites,
	listOrganizationStudents,
	createInvite,
	removeMember
} from '$lib/server/organization';
import { audit, clientFingerprint } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

async function ownerContext(authUserId: string) {
	const professional = await getProfessionalByAuthId(authUserId);
	if (!professional) redirect(303, '/onboarding');
	if (!professional.organizationId) error(404, 'sua conta não faz parte de uma clínica');
	const org = await getOrganization(professional.organizationId);
	if (!org) error(404, 'clínica não encontrada');
	if (org.ownerProfessionalId !== professional.id)
		error(403, 'só quem administra a clínica acessa esta página');
	return { professional, org };
}

export const load = (async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const { org } = await ownerContext(locals.user.id);

	const membros = await listMembers(org.id);
	const convites = await listPendingInvites(org.id);
	const alunos = await listOrganizationStudents(org.id);

	// Gerações do ciclo corrente da clínica. O ciclo vem da assinatura do dono.
	const [dono] = await db
		.select({
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt,
			trialStartedAt: professionals.trialStartedAt
		})
		.from(professionals)
		.where(eq(professionals.id, org.ownerProfessionalId))
		.limit(1);
	const desde = dono ? currentCycleStart(dono) : new Date(0);

	const linhas = await db.execute<{ professional_id: string; n: number }>(sql`
		SELECT r.professional_id, COUNT(*)::int AS n
		FROM ai_runs r
		JOIN professionals p ON p.id = r.professional_id
		WHERE p.organization_id = ${org.id}
		  AND r.kind = 'plan_generation'
		  AND r.created_at >= ${desde.toISOString()}
		GROUP BY r.professional_id
	`);
	const list = (linhas as unknown as { rows?: typeof linhas }).rows ?? linhas;
	const porMembro = new Map(
		(list as unknown as Array<{ professional_id: string; n: number }>).map((r) => [
			r.professional_id,
			Number(r.n)
		])
	);
	const usadasNoCiclo = [...porMembro.values()].reduce((a, b) => a + b, 0);

	return {
		org: {
			id: org.id,
			name: org.name,
			seats: org.seats,
			generationsLimit: org.generationsLimit,
			perMemberGenerationCap: org.perMemberGenerationCap
		},
		membros: membros.map((m) => ({ ...m, noCiclo: porMembro.get(m.id) ?? 0 })),
		convites,
		alunos,
		usadasNoCiclo,
		cicloDesde: desde
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	convidar: async ({ request, locals, url, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const { professional, org } = await ownerContext(locals.user.id);

		const fd = await request.formData();
		const email = String(fd.get('email') ?? '');

		const r = await createInvite({ org, email, invitedBy: professional.id });
		if (!r.ok) return fail(400, { error: r.erro });

		audit({
			action: 'org.invite_created',
			professionalId: professional.id,
			entityType: 'organization',
			entityId: org.id,
			payload: { email: email.slice(0, 120) },
			...clientFingerprint(request, getClientAddress)
		});

		// A origem da requisição vem primeiro, pelo mesmo motivo do CRM: o link
		// tem que apontar pro ambiente onde a pessoa está de fato.
		const base = url.origin.replace(/\/$/, '');
		return {
			success: true,
			convite: { email: email.trim().toLowerCase(), url: `${base}/convite/${r.token}` }
		};
	},

	remover: async ({ request, locals, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const { professional, org } = await ownerContext(locals.user.id);

		const fd = await request.formData();
		const alvo = String(fd.get('professionalId') ?? '');
		const erro = await removeMember(org, alvo);
		if (erro) return fail(400, { error: erro });

		audit({
			action: 'org.member_removed',
			professionalId: professional.id,
			entityType: 'organization',
			entityId: org.id,
			payload: { removido: alvo },
			...clientFingerprint(request, getClientAddress)
		});
		return { success: true, acao: 'remover' };
	},

	limite: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const { org } = await ownerContext(locals.user.id);

		const fd = await request.formData();
		const bruto = String(fd.get('cap') ?? '').trim();
		// Vazio = sem teto individual, todo mundo puxa do pool livremente.
		const cap = bruto === '' ? null : Number(bruto);
		if (cap != null && (!Number.isInteger(cap) || cap < 1 || cap > org.generationsLimit)) {
			return fail(400, {
				error: `O teto por profissional deve ficar entre 1 e ${org.generationsLimit}, ou vazio para não ter teto.`
			});
		}

		const { organizations } = await import('$lib/server/db/schema');
		await db
			.update(organizations)
			.set({ perMemberGenerationCap: cap, updatedAt: new Date() })
			.where(eq(organizations.id, org.id));
		return { success: true, acao: 'limite' };
	}
};

/**
 * Payload da sessão do profissional (shell do app): identidade, acesso,
 * trial, dono de clínica e contadores da navegação. Compartilhado pelo
 * layout do SvelteKit e pela API do app React (web/server), para as duas
 * casas não divergirem.
 */
import { sql } from 'drizzle-orm';
import { db } from './db';
import type { Professional } from './db/schema';
import { isTrialing, trialDaysLeft, trialLabel } from './subscription';
import { getOrganization, hasAccess } from './organization';

/** Rotas que continuam abertas sem assinatura válida (o muro mora dentro do app). */
export const ROTAS_LIVRES = ['/upgrade', '/assinatura', '/configuracoes', '/guia', '/convite', '/logout'];

export function rotaLivre(pathname: string): boolean {
	return ROTAS_LIVRES.some((p) => pathname.startsWith(p));
}

export type Sessao = Awaited<ReturnType<typeof carregarSessao>>;

export async function carregarSessao(professional: Professional, authUser: { id: string; email?: string | null }) {
	let ehDonoDeClinica = false;
	if (professional.organizationId) {
		const org = await getOrganization(professional.organizationId);
		ehDonoDeClinica = org?.ownerProfessionalId === professional.id;
	}

	// Roda em toda página autenticada: soluço do banco degrada pra zeros em vez
	// de derrubar a navegação inteira.
	let counts: { students_count: number; unread_messages: number; new_leads: number } | undefined;
	try {
		const result = await db.execute<{ students_count: number; unread_messages: number; new_leads: number }>(sql`
			SELECT
				(SELECT COUNT(*) FROM students
					WHERE professional_id = ${professional.id} AND deleted_at IS NULL)::int AS students_count,
				(SELECT COUNT(*) FROM messages m
					JOIN conversations c ON c.id = m.conversation_id
					WHERE c.professional_id = ${professional.id}
					  AND m.from_role = 'student'
					  AND m.read_at IS NULL)::int AS unread_messages,
				(SELECT COUNT(*) FROM leads WHERE stage = 'cadastrou')::int AS new_leads
		`);
		const list = (result as unknown as { rows?: typeof result }).rows ?? result;
		counts = (list as Array<{ students_count: number; unread_messages: number; new_leads: number }>)[0];
	} catch (err) {
		console.error('sessao.sidebarCounts.failed', String(err).slice(0, 300));
	}

	return {
		professional: {
			id: professional.id,
			name: professional.name,
			email: professional.email,
			cref: professional.cref,
			specialty: professional.specialty,
			avatarUrl: professional.avatarUrl,
			isAdmin: professional.isAdmin,
			organizationId: professional.organizationId
		},
		user: { id: authUser.id, email: authUser.email ?? null },
		temAcesso: await hasAccess(professional),
		isOrgOwner: ehDonoDeClinica,
		trial: isTrialing(professional)
			? { diasRestantes: trialDaysLeft(professional), label: trialLabel(trialDaysLeft(professional)) }
			: null,
		sidebarCounts: {
			students: Number(counts?.students_count ?? 0),
			unreadMessages: Number(counts?.unread_messages ?? 0),
			newLeads: professional.isAdmin ? Number(counts?.new_leads ?? 0) : 0
		}
	};
}

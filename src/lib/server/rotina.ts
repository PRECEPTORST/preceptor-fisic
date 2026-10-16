/**
 * Regras de agenda e mensagens extraídas das form actions do SvelteKit
 * ((app)/agenda/* e (app)/mensagens) para o app React (web/server/routes/rotina.ts)
 * poder usar as mesmas consultas. As actions do SvelteKit seguem como estão.
 */
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { waitUntil } from '@vercel/functions';
import { db } from '$lib/server/db';
import { messages, students } from '$lib/server/db/schema';
import { sendAppointmentNotification } from '$lib/server/email';
import { logger } from '$lib/server/logger';
import { conversationBelongsTo } from '$lib/server/queries';

/** O aluno é deste profissional? Mesmo guard de agenda/nova e agenda/[id]/editar. */
export async function studentBelongsTo(studentId: string, professionalId: string): Promise<boolean> {
	const [owned] = await db
		.select({ professionalId: students.professionalId })
		.from(students)
		.where(eq(students.id, studentId))
		.limit(1);
	return owned?.professionalId === professionalId;
}

/**
 * Avisa o aluno por e-mail (se ele tem e-mail). Nunca lança: falha vira log.
 * Usa waitUntil para a Function não congelar antes do envio (C09).
 */
export async function notifyAppointment(input: {
	studentId: string;
	professionalName: string;
	startsAt: Date;
	durationMinutes: number;
	type: 'treino' | 'avaliacao' | 'reabilitacao' | 'consulta';
	label?: string | null;
	variant?: 'cancelada' | 'remarcada';
}): Promise<void> {
	try {
		const [student] = await db
			.select({ name: students.name, email: students.email, linkTokenVersion: students.linkTokenVersion })
			.from(students)
			.where(eq(students.id, input.studentId))
			.limit(1);
		if (!student?.email) return;
		const p = sendAppointmentNotification({
			to: student.email,
			studentName: student.name,
			professionalName: input.professionalName,
			startsAt: input.startsAt,
			durationMinutes: input.durationMinutes,
			type: input.type,
			label: input.label ?? undefined,
			studentId: input.studentId,
			linkTokenVersion: student.linkTokenVersion,
			...(input.variant ? { variant: input.variant } : {})
		}).catch((err) => logger.error({ err: String(err).slice(0, 200) }, 'appointment.notify.send_failed'));
		try {
			waitUntil(p);
		} catch {
			// Fora da Vercel waitUntil lança; a Promise segue rodando no Node.
		}
	} catch (err) {
		logger.error({ err: String(err).slice(0, 200) }, 'appointment.notify.lookup_failed');
	}
}

/** Não lidas por conversa, derivado de read_at (conversations.unread_count está morto). */
export async function unreadByConversation(conversationIds: string[]): Promise<Map<string, number>> {
	if (conversationIds.length === 0) return new Map();
	const rows = await db
		.select({ conversationId: messages.conversationId, n: count() })
		.from(messages)
		.where(
			and(
				inArray(messages.conversationId, conversationIds),
				eq(messages.fromRole, 'student'),
				isNull(messages.readAt)
			)
		)
		.groupBy(messages.conversationId);
	return new Map(rows.map((r) => [r.conversationId, r.n]));
}

/** Marca como lidas as mensagens do aluno numa conversa do profissional. false = conversa alheia. */
export async function markThreadRead(conversationId: string, professionalId: string): Promise<boolean> {
	if (!(await conversationBelongsTo(conversationId, professionalId))) return false;
	await db
		.update(messages)
		.set({ readAt: new Date() })
		.where(
			and(eq(messages.conversationId, conversationId), eq(messages.fromRole, 'student'), isNull(messages.readAt))
		);
	return true;
}

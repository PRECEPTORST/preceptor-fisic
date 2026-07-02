import { error, fail } from '@sveltejs/kit';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { messages } from '$lib/server/db/schema';
import {
	getConversationThreads,
	getMessagesForThread,
	postMessage,
	getProfessionalByAuthId
} from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ url, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const threads = await getConversationThreads(professional.id);
	const activeId = url.searchParams.get('t') ?? threads[0]?.id ?? null;
	// Abrir a thread marca as mensagens do aluno como lidas. `threads` já vem
	// filtrado por professional.id — thread alheia (ou o sentinel ?t=inbox)
	// não casa e a marcação vira no-op.
	const active = threads.find((t) => t.id === activeId);
	if (active) {
		await db
			.update(messages)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(messages.conversationId, active.id),
					eq(messages.fromRole, 'student'),
					isNull(messages.readAt)
				)
			);
	}
	// conversations.unread_count está morto (nunca é escrito) — deriva o
	// contador real de read_at, mesma fonte do badge do sidebar.
	const convIds = threads.map((t) => t.id);
	const unreadRows = convIds.length
		? await db
				.select({ conversationId: messages.conversationId, n: count() })
				.from(messages)
				.where(
					and(
						inArray(messages.conversationId, convIds),
						eq(messages.fromRole, 'student'),
						isNull(messages.readAt)
					)
				)
				.groupBy(messages.conversationId)
		: [];
	const unreadByConv = new Map(unreadRows.map((r) => [r.conversationId, r.n]));
	// getMessagesForThread valida ownership — thread de outro profissional
	// retorna lista vazia em vez de vazar mensagens.
	const activeMessages = activeId ? await getMessagesForThread(activeId, professional.id) : [];

	return {
		threads: threads.map((t) => ({ ...t, unread: unreadByConv.get(t.id) ?? 0 })),
		activeId,
		activeMessages
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	send: async ({ request, locals }) => {
		// Actions não têm parent(); resolve professional via locals.user.
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'não autenticado' });
		const data = await request.formData();
		const conversationId = String(data.get('conversationId') ?? '');
		const body = String(data.get('body') ?? '').trim();
		if (!conversationId || !body) return fail(400, { error: 'preencha mensagem' });
		try {
			await postMessage(conversationId, body, 'professional', professional.id);
		} catch {
			return fail(403, { error: 'conversa não encontrada' });
		}
		return { success: true };
	}
};

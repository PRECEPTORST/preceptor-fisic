import { error, fail } from '@sveltejs/kit';
import {
	getProfessionalByAuthId,
	createFeedback,
	getMyFeedback,
	FEEDBACK_CATEGORIES,
	type FeedbackCategory
} from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

const VALID_CATEGORIES = FEEDBACK_CATEGORIES.map((c) => c.id);

export const load = (async ({ parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	// Todo profissional (beta tester) escreve e vê os PRÓPRIOS feedbacks.
	// A visão consolidada de todos + resumo IA fica no CRM (admin).
	const mine = await getMyFeedback(professional.id);
	return { mine };
}) satisfies PageServerLoad;

export const actions: Actions = {
	submit: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const pro = await getProfessionalByAuthId(locals.user.id);
		if (!pro) return fail(401, { error: 'profissional não encontrado' });

		const fd = await request.formData();
		const category = String(fd.get('category') ?? 'outro') as FeedbackCategory;
		const message = String(fd.get('message') ?? '').trim();
		const page = String(fd.get('page') ?? '').trim() || null;

		if (!VALID_CATEGORIES.includes(category)) return fail(400, { error: 'categoria inválida' });
		if (message.length < 3)
			return fail(400, { error: 'Escreva um pouco mais no feedback.', values: { category, message } });
		if (message.length > 4000)
			return fail(400, { error: 'Feedback muito longo (máx 4000 caracteres).', values: { category, message } });

		await createFeedback({
			professionalId: pro.id,
			authorName: pro.name,
			authorEmail: pro.email,
			category,
			message,
			page
		});
		return { success: true };
	}
};

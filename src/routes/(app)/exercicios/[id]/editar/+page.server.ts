import { error, fail, redirect } from '@sveltejs/kit';
import {
	getExerciseById,
	getProfessionalByAuthId,
	updateExercise,
	deleteExercise
} from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const ex = await getExerciseById(params.id, professional.id);
	if (!ex) error(404, 'exercício não encontrado');

	return { exercise: ex };
}) satisfies PageServerLoad;

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const muscleGroup = String(fd.get('muscleGroup') ?? '').trim();
		if (!name || !muscleGroup)
			return fail(400, { error: 'nome e grupo muscular são obrigatórios' });

		const contraindications = String(fd.get('contraindications') ?? '')
			.split(/[,\n;]+/)
			.map((x) => x.trim())
			.filter(Boolean);

		await updateExercise({
			exerciseId: params.id!,
			professionalId: professional.id,
			// null (não undefined) permite LIMPAR o campo na edição — undefined
			// faz o Drizzle pular a coluna e o valor antigo nunca sai.
			code: String(fd.get('code') ?? '').trim() || null,
			name,
			muscleGroup,
			equipment: String(fd.get('equipment') ?? '').trim() || null,
			level: String(fd.get('level') ?? '').trim() || null,
			pattern: String(fd.get('pattern') ?? '').trim() || null,
			executionNotes: String(fd.get('executionNotes') ?? '').trim() || null,
			contraindications
		});

		redirect(303, '/exercicios/meus');
	},
	delete: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });
		await deleteExercise(params.id!, professional.id);
		redirect(303, '/exercicios/meus');
	}
};

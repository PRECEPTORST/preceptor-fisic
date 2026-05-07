import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getProfessionalByAuthId, createProfessional } from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const existing = await getProfessionalByAuthId(locals.user.id);
	if (existing) redirect(303, '/dashboard');
	return {
		email: locals.user.email ?? '',
		suggestedName: (locals.user as any).user_metadata?.name ?? ''
	};
};

const SpecialtyEnum = z.enum([
	'prescricao_clinica',
	'treinamento_funcional',
	'reabilitacao',
	'musculacao',
	'personal',
	'pilates',
	'outro'
]);

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const existing = await getProfessionalByAuthId(locals.user.id);
		if (existing) redirect(303, '/dashboard');

		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const cref = String(fd.get('cref') ?? '').trim() || null;
		const specialtyRaw = String(fd.get('specialty') ?? '');

		if (name.length < 2) return fail(400, { error: 'nome obrigatório (mínimo 2 caracteres)' });
		const specialty = SpecialtyEnum.safeParse(specialtyRaw);
		if (!specialty.success) return fail(400, { error: 'especialidade inválida' });

		try {
			await createProfessional({
				authUserId: locals.user.id,
				email: locals.user.email ?? '',
				name,
				cref,
				specialty: specialty.data
			});
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}

		redirect(303, '/dashboard');
	}
};

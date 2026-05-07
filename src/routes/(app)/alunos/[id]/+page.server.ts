import { error } from '@sveltejs/kit';
import { getStudentDetail } from '$lib/server/queries';
import { signStudentToken } from '$lib/server/aluno-token';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, url }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const detail = await getStudentDetail(params.id, professional.id);
	if (!detail) error(404, 'aluno não encontrado');

	const token = signStudentToken(params.id);
	const alunoUrl = `${url.origin}/a/${params.id}?t=${token}`;

	return { detail, alunoUrl };
};

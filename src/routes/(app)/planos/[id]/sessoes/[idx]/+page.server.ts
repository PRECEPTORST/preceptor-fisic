import { error } from '@sveltejs/kit';
import { getPlanDetail } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const plan = await getPlanDetail(params.id, professional.id);
	if (!plan) error(404, 'plano não encontrado');

	const idx = Number(params.idx);
	const session = plan.planData.weekly_sessions?.[idx];
	if (!session) error(404, 'sessão não encontrada');

	return { plan, session, idx };
};

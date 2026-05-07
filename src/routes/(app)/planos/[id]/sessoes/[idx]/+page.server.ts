import { error } from '@sveltejs/kit';
import { getPlanDetail, getRecentSessionLogs } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const plan = await getPlanDetail(params.id, professional.id);
	if (!plan) error(404, 'plano não encontrado');

	const idx = Number(params.idx);
	const session = plan.planData.weekly_sessions?.[idx];
	if (!session) error(404, 'sessão não encontrada');

	const sessionLabel = session.label ?? `Sessão ${idx + 1}`;
	const recentLogs = await getRecentSessionLogs(params.id, sessionLabel, 5);

	return { plan, session, idx, recentLogs };
};

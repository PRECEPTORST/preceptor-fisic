import { error } from '@sveltejs/kit';
import { getAppointmentsInRange } from '$lib/server/queries';
import { startOfLocalWeek } from '$lib/server/tz';
import type { PageServerLoad } from './$types';

export const load = (async ({ parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	// Semana atual: segunda 00:00 de Brasília → domingo 23:59. setHours no
	// server (Vercel = UTC) começaria a janela às 21:00 BRT do domingo.
	const start = startOfLocalWeek(new Date());
	const end = new Date(start.getTime() + 7 * 86_400_000);

	const appointments = await getAppointmentsInRange(professional.id, start, end);

	return {
		appointments: appointments.map((a) => ({
			...a,
			startsAt: a.startsAt.toISOString()
		})),
		weekStart: start.toISOString(),
		weekEnd: end.toISOString()
	};
}) satisfies PageServerLoad;

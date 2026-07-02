import { getStudentsByProfessional, getDashboardStats } from '$lib/server/queries';
import { buildAttentionQueue } from '$lib/attention';
import type { PageServerLoad } from './$types';

export const load = (async ({ parent }) => {
	const { professional } = await parent();
	if (!professional) {
		// Sem auth/professional — devolve mock pra UI continuar funcional em modo design
		return { students: [], stats: null, professional: null, attention: [] };
	}

	const [students, stats] = await Promise.all([
		getStudentsByProfessional(professional.id),
		getDashboardStats(professional.id)
	]);

	// Fila "Precisa de atenção" — deriva dos sinais já computados por aluno.
	// ACWR fica de fora aqui (exige uma query pesada por aluno); a faixa de
	// risco e seu CTA vivem na ficha. Ver src/lib/attention.ts.
	const attention = buildAttentionQueue(
		students.map((s) => ({
			studentId: s.id,
			name: s.name,
			planActive: s.planActive,
			adherence: s.adherence,
			weeklyTarget: s.weeklyTarget,
			daysSinceLast: s.daysSinceLast,
			maxRpe7d: s.maxRpe7,
			lastObservation: s.lastObs,
			acwrLevel: null
		}))
	);

	return { students, stats, professional, attention };
}) satisfies PageServerLoad;

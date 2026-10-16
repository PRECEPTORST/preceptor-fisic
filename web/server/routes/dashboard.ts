import { Hono } from 'hono';
import { requireAccess, requireProfessional, requireUser, type Vars } from '../auth';
import { getDashboardStats, getStudentsByProfessional } from '$lib/server/queries';
import { buildAttentionQueue } from '$lib/attention';

export const dashboard = new Hono<{ Variables: Vars }>().get(
	'/',
	requireUser,
	requireProfessional,
	requireAccess,
	async (c) => {
		const id = c.get('professional').id;
		const [students, stats] = await Promise.all([getStudentsByProfessional(id), getDashboardStats(id)]);
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
		return c.json({ students, stats, attention });
	}
);

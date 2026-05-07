/**
 * Polling endpoint pra UI acompanhar geração de plano em background.
 * Frontend chama a cada ~1.5s enquanto status != 'generated'/'failed'.
 */
import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { trainingPlans } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401);

	const [row] = await db
		.select({
			id: trainingPlans.id,
			status: trainingPlans.status,
			progressPct: trainingPlans.progressPct,
			progressPhase: trainingPlans.progressPhase,
			errorMessage: trainingPlans.errorMessage,
			generatedAt: trainingPlans.generatedAt
		})
		.from(trainingPlans)
		.where(eq(trainingPlans.id, params.id!))
		.limit(1);

	if (!row) error(404, 'plano não encontrado');

	return json({
		id: row.id,
		status: row.status,
		progress: row.progressPct,
		phase: row.progressPhase,
		error: row.errorMessage,
		generated: row.status === 'generated' || row.status === 'published',
		failed: row.status === 'failed'
	});
};

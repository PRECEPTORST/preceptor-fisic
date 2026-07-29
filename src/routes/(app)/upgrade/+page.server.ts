/**
 * Muro de assinatura, dentro da casca do app.
 *
 * Mora no grupo (app) de propósito: a pessoa continua vendo a barra lateral e
 * o que ela construiu enquanto testava. Mandar direto pra tela de preço tira
 * justamente o contexto que faz a assinatura valer a pena.
 *
 * Isento do gate (ver LIVRE no +layout.server.ts), senão redirecionaria pra
 * si mesmo em loop.
 */
import { redirect, error } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { getProfessionalByAuthId } from '$lib/server/queries';
import { hasAccess } from '$lib/server/organization';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const professional = await getProfessionalByAuthId(locals.user.id);
	if (!professional) redirect(303, '/onboarding');

	// Quem tem acesso não tem o que fazer aqui.
	// hasAccess: membro de clínica tem acesso sem assinatura própria e não
	// deveria ver o muro.
	if (await hasAccess(professional)) redirect(303, '/dashboard');

	// Sem trial_started_at a pessoa nunca teve período gratuito: ou a conta é
	// anterior ao trial, ou o CPF dela já tinha usado. Dizer "seu teste
	// acabou" nesse caso é mentira.
	const usouTrial = professional.trialStartedAt != null;

	// O que ela construiu. É o argumento da tela: esses números somem da vista
	// enquanto não assinar, mas continuam salvos.
	let acervo = { alunos: 0, planos: 0, publicados: 0 };
	try {
		const result = await db.execute<{ alunos: number; planos: number; publicados: number }>(sql`
			SELECT
				(SELECT COUNT(*) FROM students
					WHERE professional_id = ${professional.id} AND deleted_at IS NULL)::int AS alunos,
				(SELECT COUNT(*) FROM training_plans
					WHERE professional_id = ${professional.id})::int AS planos,
				(SELECT COUNT(*) FROM training_plans
					WHERE professional_id = ${professional.id} AND status = 'published')::int AS publicados
		`);
		const list = (result as unknown as { rows?: typeof result }).rows ?? result;
		const row = (list as Array<{ alunos: number; planos: number; publicados: number }>)[0];
		if (row)
			acervo = {
				alunos: Number(row.alunos),
				planos: Number(row.planos),
				publicados: Number(row.publicados)
			};
	} catch (err) {
		// Degrada pra zeros: o muro sem números ainda funciona, um 500 não.
		console.error('upgrade.acervo.failed', String(err).slice(0, 200));
	}

	if (!professional.name) error(500, 'perfil incompleto');

	return { usouTrial, acervo, nome: professional.name.split(' ')[0] ?? professional.name };
}) satisfies PageServerLoad;

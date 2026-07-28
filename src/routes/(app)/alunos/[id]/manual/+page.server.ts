/**
 * Montagem manual de plano.
 *
 * Cria o plano já em `generated`, com as molduras das sessões e os blocos
 * vazios: quem preenche é o profissional, no editor que já existe na revisão
 * do plano (trocar, adicionar, remover, reordenar e editar exercício).
 *
 * NÃO grava linha em `ai_runs`, e é isso que importa no custo: a franquia de
 * gerações do plano conta `ai_runs.kind = 'plan_generation'`, então montar na
 * mão não consome cota nenhuma. Antes disso, quem quisesse prescrever sozinho
 * precisava gastar uma geração só pra ter onde escrever.
 *
 * A validação clínica das 23 regras é determinística e roda igual aqui: o
 * `revalidate` da tela de revisão não sabe (nem precisa saber) se o plano
 * nasceu da IA ou da mão do profissional.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { getStudentDetail, getProfessionalByAuthId } from '$lib/server/queries';
import { db } from '$lib/server/db';
import { trainingPlans } from '$lib/server/db/schema';
import { buildManualPlanData } from '$lib/server/ai/plan-assembly';
import { hasActiveSubscription } from '$lib/server/subscription';
import { audit, clientFingerprint } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const detail = await getStudentDetail(params.id, professional.id);
	if (!detail) error(404, 'aluno não encontrado');

	return { detail };
}) satisfies PageServerLoad;

export const actions: Actions = {
	criar: async ({ params, request, locals, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		// Ownership + soft-delete: sem isso um POST direto criaria plano
		// apontando pra aluno de outro profissional.
		const detail = await getStudentDetail(params.id!, professional.id);
		if (!detail) return fail(404, { error: 'aluno não encontrado' });

		// Assinatura continua valendo: o que o plano manual não gasta é a
		// franquia de gerações, não o direito de usar a plataforma.
		if (!hasActiveSubscription(professional)) {
			redirect(303, '/assinatura?motivo=expirado');
		}

		const fd = await request.formData();
		const sessions = Number(fd.get('sessions'));
		const minutes = Number(fd.get('minutes'));
		if (!Number.isInteger(sessions) || sessions < 1 || sessions > 7) {
			return fail(400, { error: 'Escolha de 1 a 7 sessões por semana.' });
		}
		if (!Number.isInteger(minutes) || minutes < 20 || minutes > 180) {
			return fail(400, { error: 'A duração da sessão deve ficar entre 20 e 180 minutos.' });
		}
		const weeksRaw = Number(fd.get('weeks'));
		const weeks = Number.isInteger(weeksRaw) && weeksRaw >= 1 && weeksRaw <= 104 ? weeksRaw : 12;
		const objective = String(fd.get('objective') ?? '').trim();

		// Um foco por sessão, na ordem dos campos. Vazio é aceito: o rótulo cai
		// pro "Treino A" simples e o profissional nomeia depois.
		const focos = fd
			.getAll('focus')
			.map((f) => String(f).trim())
			.slice(0, sessions);

		const planData = buildManualPlanData({
			sessions,
			minutesPerSession: minutes,
			focos,
			objective,
			programWeeks: weeks
		});

		const [row] = await db
			.insert(trainingPlans)
			.values({
				studentId: params.id!,
				professionalId: professional.id,
				status: 'generated',
				planData,
				progressPct: 100,
				generatedAt: new Date()
			})
			.returning({ id: trainingPlans.id });
		if (!row) return fail(500, { error: 'Não consegui criar o plano. Tente de novo.' });

		audit({
			action: 'plan.create_manual',
			professionalId: professional.id,
			entityType: 'training_plan',
			entityId: row.id,
			payload: { sessions, minutes, weeks },
			...clientFingerprint(request, getClientAddress)
		});

		redirect(303, `/planos/${row.id}`);
	}
};

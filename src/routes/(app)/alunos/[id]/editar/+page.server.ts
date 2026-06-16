import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	getStudentDetail,
	getProfessionalByAuthId,
	updateStudentTx,
	softDeleteStudent
} from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const detail = await getStudentDetail(params.id, professional.id);
	if (!detail) error(404, 'aluno não encontrado');

	return { detail };
}) satisfies PageServerLoad;

const SexEnum = z.enum(['feminino', 'masculino', 'outro', 'nao_informado']);
const RiskEnum = z.enum(['baixo', 'moderado', 'alto', 'muito_alto']);
const ExpEnum = z.enum(['iniciante', 'intermediario', 'avancado']);
const DifficultyEnum = z.enum(['pequena', 'media', 'alta']);

function parseList(s: string): string[] {
	return s
		.split(/[,\n;]+/)
		.map((x) => x.trim())
		.filter(Boolean);
}

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		const fd = await request.formData();
		const raw = {
			name: String(fd.get('name') ?? '').trim(),
			birthDate: String(fd.get('birthDate') ?? '').trim() || null,
			sex: SexEnum.safeParse(String(fd.get('sex') ?? '')),
			weightKg: fd.get('weightKg') ? Number(fd.get('weightKg')) : null,
			heightCm: fd.get('heightCm') ? Number(fd.get('heightCm')) : null,
			phone: String(fd.get('phone') ?? '').trim() || null,
			email: String(fd.get('email') ?? '').trim() || null,
			cardiovascularRisk: RiskEnum.safeParse(String(fd.get('cardiovascularRisk') ?? '')),
			diagnoses: String(fd.get('diagnoses') ?? ''),
			medications: String(fd.get('medications') ?? ''),
			limitations: String(fd.get('limitations') ?? ''),
			goals: fd.getAll('goals').map(String),
			weeklySessions: Number(fd.get('weeklySessions') ?? 3),
			minutesPerSession: Number(fd.get('minutesPerSession') ?? 60),
			experienceLevel: ExpEnum.safeParse(String(fd.get('experienceLevel') ?? '')),
			prescribedDifficulty: DifficultyEnum.safeParse(String(fd.get('prescribedDifficulty') ?? 'media')),
			trainingSplit: z.enum(['auto', 'full_body', 'upper_lower', 'push_pull_legs']).safeParse(String(fd.get('trainingSplit') ?? 'auto'))
		};

		if (!raw.name || raw.name.length < 2) return fail(400, { error: 'nome inválido' });
		if (!raw.sex.success) return fail(400, { error: 'sexo inválido' });
		if (!raw.cardiovascularRisk.success) return fail(400, { error: 'risco CV inválido' });
		if (!raw.experienceLevel.success) return fail(400, { error: 'experiência inválida' });
		if (!raw.prescribedDifficulty.success) return fail(400, { error: 'dificuldade inválida' });
		if (!raw.trainingSplit.success) return fail(400, { error: 'estrutura de treino inválida' });
		// Sem isso, valores não-numéricos (NaN) ou data BR (dd/mm/aaaa) iam pro
		// DB e a transação falhava com um erro cru de Postgres.
		if (!Number.isFinite(raw.weeklySessions) || raw.weeklySessions < 1 || raw.weeklySessions > 7)
			return fail(400, { error: 'frequência semanal inválida (1 a 7)' });
		if (
			!Number.isFinite(raw.minutesPerSession) ||
			raw.minutesPerSession < 15 ||
			raw.minutesPerSession > 180
		)
			return fail(400, { error: 'minutos por sessão inválidos (15 a 180)' });
		if (raw.weightKg != null && !Number.isFinite(raw.weightKg))
			return fail(400, { error: 'peso inválido' });
		if (raw.heightCm != null && !Number.isFinite(raw.heightCm))
			return fail(400, { error: 'altura inválida' });
		if (raw.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(raw.birthDate))
			return fail(400, { error: 'data de nascimento inválida (use AAAA-MM-DD)' });

		try {
			await updateStudentTx({
				studentId: params.id!,
				professionalId: professional.id,
				name: raw.name,
				birthDate: raw.birthDate,
				sex: raw.sex.data,
				weightKg: raw.weightKg,
				heightCm: raw.heightCm,
				phone: raw.phone,
				email: raw.email || null,
				diagnoses: parseList(raw.diagnoses).map((label) => ({ label })),
				medications: parseList(raw.medications).map((name) => ({ name })),
				injuries: parseList(raw.limitations).map((region) => ({ region })),
				cardiovascularRisk: raw.cardiovascularRisk.data,
				experienceLevel: raw.experienceLevel.data,
				prescribedDifficulty: raw.prescribedDifficulty.data,
				trainingSplit: raw.trainingSplit.data,
				weeklySessions: raw.weeklySessions,
				minutesPerSession: raw.minutesPerSession,
				goals: raw.goals
			});
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}

		redirect(303, `/alunos/${params.id}`);
	},

	delete: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		await softDeleteStudent(params.id!, professional.id);
		redirect(303, '/alunos');
	}
};

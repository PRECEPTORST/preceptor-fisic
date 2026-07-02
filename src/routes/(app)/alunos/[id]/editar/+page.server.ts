import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	getStudentDetail,
	getProfessionalByAuthId,
	updateStudentTx,
	softDeleteStudent
} from '$lib/server/queries';
import { parseDateISO, parseDecimalBR } from '$lib/server/form-utils';
import { localDateKey } from '$lib/server/tz';
import { audit, clientFingerprint } from '$lib/server/audit';
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

/**
 * O form só edita a chave de identidade (label/name/region); campos ricos do
 * jsonb (severity, dose, frequency, notes, since…) vêm do perfil atual pra não
 * serem destruídos ao salvar. Item removido do textarea continua removido.
 */
function mergeByKey<T extends Record<string, unknown>>(
	incoming: T[],
	existing: unknown,
	key: string
): T[] {
	const norm = (s: unknown) =>
		String(s ?? '')
			.trim()
			.toLowerCase();
	const prevList = Array.isArray(existing) ? (existing as Record<string, unknown>[]) : [];
	return incoming.map((item) => {
		const prev = prevList.find((e) => norm(e[key]) === norm(item[key]));
		return prev ? ({ ...prev, ...item } as T) : item;
	});
}

export const actions: Actions = {
	save: async ({ params, request, locals, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		const fd = await request.formData();
		const raw = {
			name: String(fd.get('name') ?? '').trim(),
			birthDate: String(fd.get('birthDate') ?? '').trim() || null,
			sex: SexEnum.safeParse(String(fd.get('sex') ?? '')),
			weightKg: parseDecimalBR(fd.get('weightKg')),
			heightCm: parseDecimalBR(fd.get('heightCm')),
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
			prescribedDifficulty: DifficultyEnum.safeParse(
				String(fd.get('prescribedDifficulty') ?? 'media')
			),
			trainingSplit: z
				.enum(['auto', 'full_body', 'upper_lower', 'push_pull_legs'])
				.safeParse(String(fd.get('trainingSplit') ?? 'auto'))
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
		// parseDecimalBR devolve null pra texto não-parseável — distingue de vazio
		// pra não apagar um peso já salvo em silêncio.
		if (String(fd.get('weightKg') ?? '').trim() && raw.weightKg == null)
			return fail(400, { error: 'peso inválido — use apenas números (ex.: 72,5)' });
		if (String(fd.get('heightCm') ?? '').trim() && raw.heightCm == null)
			return fail(400, { error: 'altura inválida — use apenas números (ex.: 175)' });
		if (raw.weightKg != null && (raw.weightKg < 20 || raw.weightKg > 400))
			return fail(400, { error: 'peso inválido (20 a 400 kg)' });
		if (raw.heightCm != null && (raw.heightCm < 100 || raw.heightCm > 250))
			return fail(400, {
				error:
					raw.heightCm > 0 && raw.heightCm < 3
						? 'altura inválida — informe em centímetros (ex.: 175), não em metros'
						: 'altura inválida (100 a 250 cm)'
			});
		if (raw.birthDate) {
			const iso = parseDateISO(raw.birthDate);
			if (!iso)
				return fail(400, { error: 'data de nascimento inválida (use AAAA-MM-DD ou DD/MM/AAAA)' });
			if (iso > localDateKey(new Date()))
				return fail(400, { error: 'data de nascimento não pode ser no futuro' });
			raw.birthDate = iso;
		}

		// jsonb atual do perfil de saúde — base do merge que preserva os campos
		// ricos que o form não edita (ver mergeByKey).
		const detail = await getStudentDetail(params.id!, professional.id);
		if (!detail) return fail(404, { error: 'aluno não encontrado' });
		const hp = detail.healthProfile;

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
				diagnoses: mergeByKey(
					parseList(raw.diagnoses).map((label) => ({ label })),
					hp?.diagnoses,
					'label'
				),
				medications: mergeByKey(
					parseList(raw.medications).map((name) => ({ name })),
					hp?.medications,
					'name'
				),
				injuries: mergeByKey(
					parseList(raw.limitations).map((region) => ({ region })),
					hp?.injuries,
					'region'
				),
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

		audit({
			action: 'student.update',
			professionalId: professional.id,
			entityType: 'student',
			entityId: params.id,
			...clientFingerprint(request, getClientAddress)
		});

		redirect(303, `/alunos/${params.id}`);
	},

	delete: async ({ params, locals, request, getClientAddress }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		await softDeleteStudent(params.id!, professional.id);
		audit({
			action: 'student.delete',
			professionalId: professional.id,
			entityType: 'student',
			entityId: params.id,
			...clientFingerprint(request, getClientAddress)
		});
		redirect(303, '/alunos');
	}
};

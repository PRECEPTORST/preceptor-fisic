import { error, fail, redirect } from '@sveltejs/kit';
import { getStudentDetail, getProfessionalByAuthId, createAssessment } from '$lib/server/queries';
import { parseDecimalBR } from '$lib/server/form-utils';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const detail = await getStudentDetail(params.id, professional.id);
	if (!detail) error(404, 'aluno não encontrado');

	return { student: detail.student };
}) satisfies PageServerLoad;

// Faixas plausíveis por campo; int = coluna integer no Postgres (arredonda
// antes do insert — decimal em FC/PA estourava 22P02 cru).
const FIELDS = [
	{ key: 'weightKg', label: 'Peso', min: 20, max: 400 },
	{ key: 'heightCm', label: 'Altura', min: 100, max: 250 },
	{ key: 'bodyFatPct', label: '% Gordura', min: 1, max: 70 },
	{ key: 'leanMassKg', label: 'Massa magra', min: 10, max: 200 },
	{ key: 'restingHr', label: 'FC repouso', min: 30, max: 220, int: true },
	{ key: 'bpSys', label: 'PA sistólica', min: 70, max: 260, int: true },
	{ key: 'bpDia', label: 'PA diastólica', min: 40, max: 150, int: true }
] as const;

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const professional = await getProfessionalByAuthId(locals.user.id);
		if (!professional) return fail(401, { error: 'professional não encontrado' });

		// Ownership: a action não roda o load — sem isso qualquer profissional
		// logado gravava avaliação (e alterava peso) de aluno de outro.
		const detail = await getStudentDetail(params.id!, professional.id);
		if (!detail) return fail(404, { error: 'aluno não encontrado' });

		const fd = await request.formData();

		// Vazio → undefined; texto não-parseável → 400 apontando o campo (antes
		// "83kg" era descartado em silêncio e a avaliação salvava sem o peso).
		const vals = {} as Record<(typeof FIELDS)[number]['key'], number | undefined>;
		for (const f of FIELDS) {
			const rawV = String(fd.get(f.key) ?? '').trim();
			if (!rawV) {
				vals[f.key] = undefined;
				continue;
			}
			const n = parseDecimalBR(rawV);
			if (n == null)
				return fail(400, {
					error: `Valor inválido em ${f.label} — use apenas números (ex.: 83,5)`
				});
			const v = 'int' in f && f.int ? Math.round(n) : n;
			if (v < f.min || v > f.max)
				return fail(400, { error: `${f.label} fora da faixa plausível (${f.min} a ${f.max})` });
			vals[f.key] = v;
		}

		const notes = String(fd.get('notes') ?? '').trim() || undefined;
		if (!notes && FIELDS.every((f) => vals[f.key] === undefined))
			return fail(400, { error: 'Preencha ao menos uma métrica.' });

		const { weightKg, heightCm } = vals;
		const bmi =
			weightKg && heightCm
				? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10
				: undefined;

		try {
			await createAssessment({
				professionalId: professional.id,
				studentId: params.id!,
				weightKg,
				bodyFatPct: vals.bodyFatPct,
				leanMassKg: vals.leanMassKg,
				bmi,
				restingHr: vals.restingHr,
				bloodPressureSystolic: vals.bpSys,
				bloodPressureDiastolic: vals.bpDia,
				notes
			});
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}

		redirect(303, `/alunos/${params.id}`);
	}
};

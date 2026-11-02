/**
 * Regras do editor de treino (revisão do plano) e da criação de plano, sem
 * acoplamento a framework. Espelha as form actions de
 * `src/routes/(app)/planos/[id]`, `alunos/[id]/gerar` e `alunos/[id]/manual`
 * para a API do app React (`web/server/routes/treinos.ts`). O SvelteKit pode
 * passar a chamar estas funções também; por ora as actions dele seguem
 * intactas.
 *
 * Toda função recebe o `professionalId` e confere dono via getPlanDetail /
 * getStudentDetail antes de mexer em qualquer coisa.
 */
import { and, eq } from 'drizzle-orm';
import { deriveTagsFromDiagnosisLabels } from '$lib/clinical/condition-tags';
import {
	getPlanDetail,
	getStudentDetail,
	getCatalogExercise,
	countPlansGeneratedRecent,
	countGenerationsSince,
	type PlanData,
	type PlanExercise
} from '$lib/server/queries';
import { toIntInRange } from '$lib/server/validation';
import { db } from '$lib/server/db';
import {
	trainingPlans,
	students,
	healthProfiles,
	trainingPreferences,
	type Professional,
	type Restriction
} from '$lib/server/db/schema';
import {
	validatePlan,
	violationToRestriction,
	deriveStudentCtxFromHealth
} from '$lib/server/clinical/validator';
import { createPlanPlaceholder, generateTrainingPlanInBackground } from '$lib/server/ai/generator';
import { buildManualPlanData } from '$lib/server/ai/plan-assembly';
import { limitsFor, currentCycleStart, generationLimitMessage } from '$lib/server/subscription';
import { getOrganization, checkOrganizationQuota, quotaMessage } from '$lib/server/organization';

export type Falha = { ok: false; status: 400 | 402 | 404 | 409 | 429 | 500; error: string };
export type Ok<T = object> = { ok: true } & T;
export type Resultado<T = object> = Ok<T> | Falha;

const falha = (status: Falha['status'], error: string): Falha => ({ ok: false, status, error });

export type ValidationSummary = {
	violations: number;
	bySeverity: Record<string, number>;
	rules: string[];
};

export const BLOCOS = ['warmup', 'main', 'cooldown'] as const;
export type Bloco = (typeof BLOCOS)[number];

export const MUSCLE_ACTIONS = ['isotonica', 'isometrica', 'auxotonico', 'isocinetica'] as const;

/** Equipamentos aceitos na geração: mesmos termos EN do exercise_catalog. */
export const EQUIPMENT_VALUES = [
	'body weight',
	'dumbbell',
	'barbell',
	'band',
	'kettlebell',
	'cable',
	'leverage machine',
	'smith machine',
	'stability ball',
	'bench'
];

/** Rate limit da geração: 5 planos a cada 5 minutos por profissional. */
export const RATE_LIMIT_PLANS = 5;
export const RATE_LIMIT_WINDOW_MIN = 5;

/**
 * Re-roda a validação clínica e persiste o merge (restrições da IA
 * preservadas, as de regra substituídas) nas duas colunas. Null se o aluno
 * não existe mais.
 */
export async function revalidateAndPersist(
	planId: string,
	studentId: string,
	planData: PlanData
): Promise<ValidationSummary | null> {
	const [s] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
	if (!s) return null;
	const [hp] = await db
		.select()
		.from(healthProfiles)
		.where(eq(healthProfiles.studentId, studentId))
		.limit(1);

	const diagnosisLabels = ((hp?.diagnoses ?? []) as { label: string }[]).map((d) => d.label);
	const conditionTags = deriveTagsFromDiagnosisLabels(diagnosisLabels);
	const age = s.birthDate
		? Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
		: null;
	// Nível de experiência: a VOL-001 só vale pra iniciante, então a
	// revalidação precisa dele igual a geração.
	const [prefs] = await db
		.select({ experienceLevel: trainingPreferences.experienceLevel })
		.from(trainingPreferences)
		.where(eq(trainingPreferences.studentId, studentId))
		.limit(1);

	const ctx = deriveStudentCtxFromHealth(
		conditionTags.length > 0 ? conditionTags : ['populacao_geral'],
		age,
		hp ?? null,
		prefs?.experienceLevel ?? null
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const violations = await validatePlan(planData as any, ctx);
	const ruleRestrictions: Restriction[] = violations.map(violationToRestriction);
	const existing = (planData.restrictions ?? []) as Restriction[];
	const merged = [...existing.filter((r) => r.source?.type !== 'rule'), ...ruleRestrictions];

	await db
		.update(trainingPlans)
		.set({
			restrictions: merged,
			planData: { ...planData, restrictions: merged },
			updatedAt: new Date()
		})
		.where(eq(trainingPlans.id, planId));

	return {
		violations: violations.length,
		bySeverity: violations.reduce<Record<string, number>>((a, v) => {
			a[v.severity] = (a[v.severity] ?? 0) + 1;
			return a;
		}, {}),
		rules: violations.map((v) => v.ruleCode)
	};
}

/** Persiste a edição e revalida; se o aluno sumiu, só persiste. */
async function salvarERevalidar(planId: string, studentId: string, planData: PlanData) {
	const validation = await revalidateAndPersist(planId, studentId, planData);
	if (!validation) {
		await db
			.update(trainingPlans)
			.set({ planData, updatedAt: new Date() })
			.where(eq(trainingPlans.id, planId));
	}
	return validation;
}

async function planoDoDono(planId: string, professionalId: string) {
	return getPlanDetail(planId, professionalId);
}

export async function revalidarPlano(
	planId: string,
	professionalId: string
): Promise<Resultado<{ validation: ValidationSummary }>> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const validation = await revalidateAndPersist(planId, plan.studentId, plan.planData);
	if (!validation) return falha(404, 'Aluno não encontrado.');
	return { ok: true, validation };
}

export type Posicao = { sessionIdx: number; block: Bloco; exerciseIdx: number };

export type EdicaoExercicio = Posicao & {
	name: string;
	sets?: number | null;
	reps?: string;
	rest_seconds?: number | null;
	load_guidance?: string;
	intensity?: string;
	execution_notes?: string;
	cadence?: string;
	range_of_motion?: string;
	muscle_action?: string;
};

export async function editarExercicio(
	planId: string,
	professionalId: string,
	e: EdicaoExercicio
): Promise<Resultado<{ validation: ValidationSummary | null }>> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const planData = structuredClone(plan.planData);
	const ex = planData.weekly_sessions?.[e.sessionIdx]?.[e.block]?.[e.exerciseIdx];
	if (!ex) return falha(404, 'Exercício não encontrado.');

	const name = e.name.trim();
	if (name.length < 2) return falha(400, 'Nome do exercício inválido.');
	ex.name = name;
	const reps = e.reps?.trim();
	if (reps) ex.reps = reps;
	if (e.sets != null) ex.sets = toIntInRange(e.sets, { min: 1, max: 20, fallback: ex.sets ?? 3 });
	if (e.rest_seconds != null)
		ex.rest_seconds = toIntInRange(e.rest_seconds, {
			min: 0,
			max: 900,
			fallback: ex.rest_seconds ?? 60
		});
	// String vazia limpa o campo.
	ex.load_guidance = e.load_guidance?.trim() || undefined;
	ex.intensity = e.intensity?.trim() || undefined;
	ex.execution_notes = e.execution_notes?.trim() || undefined;
	ex.cadence = e.cadence?.trim() || undefined;
	ex.range_of_motion = e.range_of_motion?.trim() || undefined;
	const ma = e.muscle_action?.trim() ?? '';
	ex.muscle_action = (MUSCLE_ACTIONS as readonly string[]).includes(ma)
		? (ma as PlanExercise['muscle_action'])
		: undefined;

	return { ok: true, validation: await salvarERevalidar(planId, plan.studentId, planData) };
}

function identidadeDoCatalogo(cat: NonNullable<Awaited<ReturnType<typeof getCatalogExercise>>>) {
	return {
		name: cat.name,
		catalog_id: /^\d{4,5}$/.test(cat.externalId) ? cat.externalId : undefined,
		muscle_groups: Array.from(
			new Set([cat.targetMuscle, ...(cat.secondaryMuscles ?? [])].filter(Boolean))
		)
	};
}

/** Troca o movimento por outro do catálogo; por padrão mantém a dose. */
export async function trocarExercicio(
	planId: string,
	professionalId: string,
	p: Posicao & { catalogId: string; keepPrescription: boolean }
): Promise<Resultado<{ newName: string; validation: ValidationSummary | null }>> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const cat = await getCatalogExercise(p.catalogId);
	if (!cat) return falha(400, 'Exercício do catálogo não encontrado.');
	const planData = structuredClone(plan.planData);
	const ex = planData.weekly_sessions?.[p.sessionIdx]?.[p.block]?.[p.exerciseIdx];
	if (!ex) return falha(404, 'Exercício não encontrado.');

	Object.assign(ex, identidadeDoCatalogo(cat));
	// As cues clínicas eram do movimento antigo.
	ex.execution_notes = undefined;
	if (!p.keepPrescription) {
		ex.sets = 3;
		ex.reps = '8-12';
		ex.rest_seconds = 60;
		ex.load_guidance = undefined;
		ex.intensity = undefined;
	}
	return {
		ok: true,
		newName: cat.name,
		validation: await salvarERevalidar(planId, plan.studentId, planData)
	};
}

export async function adicionarExercicio(
	planId: string,
	professionalId: string,
	p: { sessionIdx: number; block: Bloco; catalogId: string }
): Promise<Resultado<{ newName: string; validation: ValidationSummary | null }>> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const cat = await getCatalogExercise(p.catalogId);
	if (!cat) return falha(400, 'Exercício do catálogo não encontrado.');
	const planData = structuredClone(plan.planData);
	const session = planData.weekly_sessions?.[p.sessionIdx];
	if (!session) return falha(404, 'Sessão não encontrada.');
	const lista = (session[p.block] ??= []);
	lista.push({
		...identidadeDoCatalogo(cat),
		sets: 3,
		reps: '8-12',
		rest_seconds: 60,
		source_refs: []
	});
	return {
		ok: true,
		newName: cat.name,
		validation: await salvarERevalidar(planId, plan.studentId, planData)
	};
}

/** Remove um exercício. O bloco principal não pode ficar vazio. */
export async function removerExercicio(
	planId: string,
	professionalId: string,
	p: Posicao
): Promise<Resultado<{ validation: ValidationSummary | null }>> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const planData = structuredClone(plan.planData);
	const lista = planData.weekly_sessions?.[p.sessionIdx]?.[p.block];
	if (!lista || !lista[p.exerciseIdx]) return falha(404, 'Exercício não encontrado.');
	if (p.block === 'main' && lista.length <= 1)
		return falha(400, 'A sessão precisa de ao menos 1 exercício principal.');
	lista.splice(p.exerciseIdx, 1);
	return { ok: true, validation: await salvarERevalidar(planId, plan.studentId, planData) };
}

/**
 * Move um exercício uma posição dentro do próprio bloco. Não revalida:
 * mudar a ordem não cria nem remove contraindicação.
 */
export async function moverExercicio(
	planId: string,
	professionalId: string,
	p: Posicao & { direction: 'up' | 'down' }
): Promise<Resultado> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const planData = structuredClone(plan.planData);
	const lista = planData.weekly_sessions?.[p.sessionIdx]?.[p.block];
	if (!lista || !lista[p.exerciseIdx]) return falha(404, 'Exercício não encontrado.');
	const alvo = p.direction === 'up' ? p.exerciseIdx - 1 : p.exerciseIdx + 1;
	if (alvo < 0 || alvo >= lista.length) return falha(400, 'Movimento fora do bloco.');
	[lista[p.exerciseIdx], lista[alvo]] = [lista[alvo]!, lista[p.exerciseIdx]!];
	await db
		.update(trainingPlans)
		.set({ planData, updatedAt: new Date() })
		.where(eq(trainingPlans.id, planId));
	return { ok: true };
}

/** Override clínico: o profissional assume uma restrição e libera a publicação. */
export async function resolverRestricao(
	planId: string,
	professionalId: string,
	index: number,
	resolution: 'overridden' | 'dismissed'
): Promise<Resultado<{ restriction: Restriction }>> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	const planData = structuredClone(plan.planData);
	const lista = (planData.restrictions ?? []) as Restriction[];
	if (!Number.isInteger(index) || index < 0 || index >= lista.length)
		return falha(400, 'Restrição não encontrada.');
	const target = lista[index]!;
	if (target.resolved_at) return falha(409, 'Esta restrição já foi resolvida.');

	const resolvedAt = new Date().toISOString();
	target.resolved_at = resolvedAt;
	target.resolved_by = professionalId;
	target.resolution = resolution;

	// A coluna restrictions pode divergir do planData: sincroniza por título.
	const [row] = await db
		.select({ restrictions: trainingPlans.restrictions })
		.from(trainingPlans)
		.where(eq(trainingPlans.id, planId))
		.limit(1);
	const col = ((row?.restrictions ?? []) as Restriction[]).map((r) =>
		r.title === target.title && !r.resolved_at
			? { ...r, resolved_at: resolvedAt, resolved_by: professionalId, resolution }
			: r
	);
	await db
		.update(trainingPlans)
		.set({ restrictions: col, planData, updatedAt: new Date() })
		.where(eq(trainingPlans.id, planId));
	return { ok: true, restriction: target };
}

/** Reativa plano arquivado (mantém publishedAt). */
export async function reativarPlano(planId: string, professionalId: string): Promise<Resultado> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	if (plan.status !== 'archived') return falha(409, 'Só planos arquivados podem ser reativados.');
	await db
		.update(trainingPlans)
		.set({ status: 'published', archivedAt: null, updatedAt: new Date() })
		.where(
			and(
				eq(trainingPlans.id, planId),
				eq(trainingPlans.professionalId, professionalId),
				eq(trainingPlans.status, 'archived')
			)
		);
	return { ok: true };
}

/** Exclui em qualquer estado, menos enquanto gera (o job ainda escreve no registro). */
export async function excluirPlano(planId: string, professionalId: string): Promise<Resultado> {
	const plan = await planoDoDono(planId, professionalId);
	if (!plan) return falha(404, 'Plano não encontrado.');
	if (plan.status === 'pending' || plan.status === 'generating')
		return falha(409, 'Aguarde a geração terminar antes de excluir.');
	const res = await db
		.delete(trainingPlans)
		.where(and(eq(trainingPlans.id, planId), eq(trainingPlans.professionalId, professionalId)))
		.returning({ id: trainingPlans.id });
	if (res.length === 0) return falha(400, 'Não foi possível excluir o plano.');
	return { ok: true };
}

/**
 * Dispara a geração por IA: confere dono, franquia (pool da clínica ou plano
 * individual) e rate limit antes de qualquer custo; persiste o equipamento,
 * cria o placeholder e roda a geração em background (waitUntil). O cliente
 * faz polling de /status.
 */
export async function iniciarGeracao(
	professional: Professional,
	studentId: string,
	input: { notes?: string; equipment: string[]; requestStartMs: number }
): Promise<Resultado<{ planId: string }>> {
	const detail = await getStudentDetail(studentId, professional.id);
	if (!detail) return falha(404, 'Aluno não encontrado.');

	if (professional.organizationId) {
		const org = await getOrganization(professional.organizationId);
		if (org) {
			const cota = await checkOrganizationQuota(org, professional.id);
			if (!cota.ok) return falha(402, quotaMessage(cota));
		}
	} else {
		const genLimit = limitsFor(professional).generations;
		if (genLimit != null) {
			const used = await countGenerationsSince(professional.id, currentCycleStart(professional));
			if (used >= genLimit) return falha(402, generationLimitMessage(genLimit));
		}
	}

	const recent = await countPlansGeneratedRecent(professional.id, RATE_LIMIT_WINDOW_MIN);
	if (recent >= RATE_LIMIT_PLANS)
		return falha(
			429,
			`Limite de ${RATE_LIMIT_PLANS} planos a cada ${RATE_LIMIT_WINDOW_MIN} minutos atingido. Aguarde alguns minutos e tente de novo.`
		);

	const notes = input.notes?.trim();
	// Sem truncamento silencioso: o fim das notas costuma ter a restrição.
	if (notes && notes.length > 2000)
		return falha(
			400,
			'Observações muito longas (máximo 2000 caracteres). Resuma o texto antes de gerar.'
		);

	const equipment = input.equipment.filter((v) => EQUIPMENT_VALUES.includes(v));
	if (detail.preferences) {
		await db
			.update(trainingPreferences)
			.set({ equipmentAvailable: equipment, updatedAt: new Date() })
			.where(eq(trainingPreferences.studentId, studentId));
	} else {
		await db.insert(trainingPreferences).values({ studentId, equipmentAvailable: equipment });
	}

	const planId = await createPlanPlaceholder(studentId, professional.id);
	generateTrainingPlanInBackground({
		professionalId: professional.id,
		studentId,
		planId,
		notes: notes || undefined,
		requestStartMs: input.requestStartMs
	});
	return { ok: true, planId };
}

/** Plano montado na mão: nasce `generated`, sem ai_runs (não gasta franquia). */
export async function criarPlanoManual(
	professionalId: string,
	studentId: string,
	input: { sessions: number; minutes: number; weeks?: number; objective?: string; focos: string[] }
): Promise<Resultado<{ planId: string }>> {
	const detail = await getStudentDetail(studentId, professionalId);
	if (!detail) return falha(404, 'Aluno não encontrado.');
	const planData = buildManualPlanData({
		sessions: input.sessions,
		minutesPerSession: input.minutes,
		focos: input.focos.map((f) => f.trim()).slice(0, input.sessions),
		objective: input.objective?.trim() ?? '',
		programWeeks: input.weeks ?? 12
	});
	const [row] = await db
		.insert(trainingPlans)
		.values({
			studentId,
			professionalId,
			status: 'generated',
			planData,
			progressPct: 100,
			generatedAt: new Date()
		})
		.returning({ id: trainingPlans.id });
	if (!row) return falha(500, 'Não consegui criar o plano. Tente de novo.');
	return { ok: true, planId: row.id };
}

/**
 * Franquia de gerações por IA do ciclo, para mostrar antes de gerar.
 * Conta individual: usado/limite do plano (limite null = ilimitado). Membro de
 * clínica: o pool só informa quando estoura, então devolve null se ainda há cota.
 */
export async function cotaGeracoes(
	professional: Professional
): Promise<{ usado: number; limite: number | null } | null> {
	if (professional.organizationId) {
		const org = await getOrganization(professional.organizationId);
		if (!org) return null;
		const c = await checkOrganizationQuota(org, professional.id);
		return c.ok ? null : { usado: c.usado, limite: c.limite };
	}
	const limite = limitsFor(professional).generations;
	const usado = await countGenerationsSince(professional.id, currentCycleStart(professional));
	return { usado, limite: limite ?? null };
}

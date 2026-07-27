/**
 * Gerador de plano de treino — orquestra RAG + Claude + persistência + auditoria.
 *
 * Pipeline:
 *   1. Carrega contexto do aluno (student + health + preferences)
 *   2. Deriva tags de condição
 *   3. RAG retrieval com ACSM > AHA preference (embeddings continuam Gemini)
 *   4. Geração faseada (divisão da semana → metadados + sessões em paralelo),
 *      cada chamada validada por schema Zod. Fallback single-shot no Opus.
 *   5. Persiste em training_plans + ai_runs com auditoria completa
 */
import { and, eq, inArray, desc } from 'drizzle-orm';
import { generateObject, NoObjectGeneratedError } from 'ai';
import type { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { dev as isDev } from '$app/environment';
import { anthropic } from './provider';
import { db } from '$lib/server/db';
import { sendPlanReady } from '$lib/server/email';
import {
	students,
	professionals,
	healthProfiles,
	trainingPreferences,
	trainingPlans,
	physicalAssessments,
	aiRuns,
	exerciseCatalog,
	type Student,
	type HealthProfile,
	type Restriction,
	type MonitoringNote,
	type AssessmentProtocol,
	type ExerciseCatalogItem
} from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { buildOutlines, suggestedDaysFor } from './outlines';
import { unwrapParametersEnvelope } from './structured';
import {
	trainingPlanSchema,
	weeklySplitSchema,
	programMetadataSchema,
	sessionExercisesSchema,
	assemblePlan,
	type TrainingPlanOutput,
	type SessionOutline,
	type SessionExercises
} from '$lib/schemas/training-plan';
import { retrieveRelevantChunks, formatContextForPrompt, type RetrievedChunk } from './rag';
import { deriveTagsFromDiagnosisLabels } from '$lib/clinical/condition-tags';
import { SYSTEM_PROMPT_PT_BR, SYSTEM_PROMPT_VERSION } from './system-prompt';
import {
	validatePlan,
	violationToRestriction,
	deriveStudentCtxFromHealth
} from '$lib/server/clinical/validator';

// Geração agora é Claude (Anthropic). Aliases sem sufixo de data: a Anthropic
// mantém `claude-sonnet-5` etc. apontando pro snapshot estável atual.
// Embeddings do RAG continuam no Gemini (ver provider.ts).
// Caminho primário (as chamadas em fases) é o Sonnet 5: bem mais rápido que o
// Opus e ótima qualidade clínica. Override por env se preciso
// (ex: AI_MODEL_FAST=claude-haiku-4-5 pra baratear, ou =claude-opus-4-8 pra
// máxima profundidade). Fallback fica no Opus como rede de segurança de qualidade.
const PRIMARY_MODEL = env.AI_MODEL_FAST ?? 'claude-sonnet-5';
const FALLBACK_MODEL = env.AI_MODEL_PRIMARY ?? 'claude-opus-4-8';

/** Teto da FUNÇÃO (ms) — precisa casar com o maxDuration do adapter em
 * svelte.config.js (300s no plano Pro; 60s no Hobby, aí use
 * AI_GEN_FUNCTION_BUDGET_MS=60000). Em dev local (Node persistente) o teto
 * é nosso, 120s basta. */
/** Env mal digitada não pode virar NaN e derrubar TODA geração: um
 *  AbortSignal.timeout(NaN) aborta na hora. Valor inválido cai no default. */
function envMs(raw: string | undefined, fallback: number): number {
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const FUNCTION_BUDGET_MS = envMs(
	env.AI_GEN_FUNCTION_BUDGET_MS ?? env.AI_GEN_TIMEOUT_MS,
	isDev ? 120_000 : 300_000
);

/** Reserva descontada do orçamento pra VALIDAR + PERSISTIR o plano (ou marcar
 * failed / salvar o partial) depois que a IA devolve. Sem essa folga o runtime
 * mata a função no meio do catch e o plano fica em 'generating' pra sempre. */
const POST_GEN_RESERVE_MS = envMs(env.AI_GEN_POST_RESERVE_MS, 25_000);

/**
 * Quanto tempo a chamada de IA ainda pode gastar, contado do início da REQUEST
 * (não do início da chamada de IA). Carregar contexto + RAG consome dezenas de
 * segundos antes da IA começar — um timeout fixo de 280s somado a esse preparo
 * estourava os 300s da função, então o abort nunca chegava a disparar.
 * Piso de 15s pra a chamada não nascer abortada quando o preparo já queimou
 * quase tudo (aí ela falha rápido e o erro é persistido, que é o certo).
 */
function remainingGenBudgetMs(startMs: number): number {
	return Math.max(15_000, FUNCTION_BUDGET_MS - POST_GEN_RESERVE_MS - (Date.now() - startMs));
}

/**
 * Opções de provider comuns a TODAS as chamadas de geração.
 *
 * `structuredOutputMode: 'jsonTool'` é OBRIGATÓRIO aqui, não preferência. No
 * modo 'auto' o AI SDK usa structured outputs nativos e a API rejeita nossos
 * schemas com 400: "Schemas contains too many optional parameters (limit: 24)"
 * — a ficha de prescrição sozinha tem ~10 campos opcionais por exercício
 * (medido: 81 opcionais no plano inteiro, 51 numa sessão, 31 no esqueleto).
 * O modo jsonTool passa o schema como tool e não tem esse teto. A alternativa
 * seria amputar campos clínicos do schema, o que não vale.
 *
 * `thinking: disabled` porque Sonnet 5 liga thinking adaptativo por DEFAULT
 * quando o campo é omitido (mudança em relação ao Opus 4.8). Medindo a mesma
 * sessão: com thinking, 1 de 2 tentativas voltou "response did not match
 * schema"; sem thinking, 2 de 2 passaram, ~30s cada e ~15% mais rápido. O
 * plano já vem estruturado por schema, então o raciocínio livre só atrapalha —
 * e dividia o teto de max_tokens com o JSON.
 */
const GEN_PROVIDER_OPTIONS = {
	anthropic: {
		structuredOutputMode: 'jsonTool' as const,
		thinking: { type: 'disabled' as const }
	}
};

function isQuotaError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return /quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(msg);
}

/** Abort do nosso orçamento de tempo — retentar só queimaria o que resta. */
function isAbortError(err: unknown): boolean {
	if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError'))
		return true;
	return /abort|timed?.?out/i.test(err instanceof Error ? err.message : String(err));
}

export type GenerateOptions = {
	professionalId: string;
	studentId: string;
	planId: string;
	notes?: string;
};

export async function createPlanPlaceholder(
	studentId: string,
	professionalId: string
): Promise<string> {
	const [row] = await db
		.insert(trainingPlans)
		.values({
			studentId,
			professionalId,
			status: 'pending',
			progressPct: 5,
			progressPhase: 'enfileirado'
		})
		.returning({ id: trainingPlans.id });
	if (!row) throw new Error('Falha ao criar registro do plano.');
	return row.id;
}

/** Item compacto do catálogo passado pro prompt da IA. */
export type CatalogPromptItem = Pick<
	ExerciseCatalogItem,
	'externalId' | 'name' | 'nameEn' | 'equipment' | 'bodyPart' | 'targetMuscle' | 'difficulty'
>;

type StudentContext = {
	student: Student;
	health: HealthProfile | null;
	preferences: typeof trainingPreferences.$inferSelect | null;
	/** Avaliação física mais recente (PA, FC, composição, testes). null = sem avaliação. */
	assessment: typeof physicalAssessments.$inferSelect | null;
	conditionTags: string[];
	/** Subset do exercise_catalog filtrado pelo equipamento do aluno. */
	catalog: CatalogPromptItem[];
};

/** Cap de itens enviados pro prompt — mantém o contexto enxuto. 150
 * itens ≈ 12KB de prompt, ~3k tokens. Mais que isso acelera o LLM mas
 * sobrecarrega o budget de 60s da função serverless (Hobby). */
const CATALOG_PROMPT_CAP = 100;
/** Defaults quando o aluno não tem equipamento registrado (cenário home). */
const DEFAULT_EQUIPMENT_FALLBACK = ['body weight', 'dumbbell', 'band'];

/**
 * Mapeia o nível de experiência do aluno (PT-BR, do schema da app) pras
 * difficulties do catálogo ExerciseDB Pro (EN). Iniciante NÃO vê nada
 * advanced; intermediário vê até intermediate; avançado pega todos.
 */
const EXPERIENCE_TO_DIFFICULTY: Record<string, Set<string>> = {
	iniciante: new Set(['beginner']),
	intermediario: new Set(['beginner', 'intermediate']),
	avancado: new Set(['beginner', 'intermediate', 'advanced'])
};

/**
 * Dificuldade-alvo prescrita pelo profissional → difficulties do catálogo.
 * Knob independente da experiência: deixa o treinador limitar a complexidade
 * técnica dos exercícios (ex: aluno novo na academia recebe só exercícios
 * simples, mesmo que seja experiente em treino).
 */
const PRESCRIBED_TO_DIFFICULTY: Record<string, Set<string>> = {
	pequena: new Set(['beginner']),
	media: new Set(['beginner', 'intermediate']),
	alta: new Set(['beginner', 'intermediate', 'advanced'])
};

/**
 * Filtra o catálogo por (1) equipamento disponível e (2) dificuldade
 * permitida. Sempre inclui body weight (universal). Casamento por substring
 * pra tolerar variações ("dumbbell" matchando "dumbbell (used as handles for
 * deeper range)"). Cap em CATALOG_PROMPT_CAP.
 *
 * Difficulty: aplica o MAIS restritivo entre o nível de experiência e a
 * dificuldade-alvo prescrita pelo treinador — filtra ANTES de enviar pro LLM,
 * então a IA nem vê exercícios acima do permitido.
 */
function filterCatalog(
	catalog: CatalogPromptItem[],
	studentEquipment: string[] | null | undefined,
	experienceLevel: string | null | undefined,
	prescribedDifficulty: string | null | undefined
): CatalogPromptItem[] {
	const studentEq = (studentEquipment ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
	const targetEq = studentEq.length > 0 ? studentEq : DEFAULT_EQUIPMENT_FALLBACK;

	// Interseção (mais restritivo) entre experiência e dificuldade prescrita.
	const byExperience = experienceLevel ? EXPERIENCE_TO_DIFFICULTY[experienceLevel] : null;
	const byPrescribed = prescribedDifficulty ? PRESCRIBED_TO_DIFFICULTY[prescribedDifficulty] : null;
	let allowedDiff: Set<string> | null = null;
	if (byExperience && byPrescribed) {
		allowedDiff = new Set([...byExperience].filter((d) => byPrescribed.has(d)));
	} else {
		allowedDiff = byExperience ?? byPrescribed ?? null;
	}
	const passesDifficulty = (d: string | null) =>
		!allowedDiff || !d || allowedDiff.has(d.toLowerCase());

	const exact: CatalogPromptItem[] = [];
	const bodyweight: CatalogPromptItem[] = [];
	for (const item of catalog) {
		if (!passesDifficulty(item.difficulty)) continue;
		const itemEq = (item.equipment ?? '').toLowerCase();
		if (!itemEq) continue;
		if (itemEq === 'body weight') {
			bodyweight.push(item);
			continue;
		}
		if (targetEq.some((s) => itemEq.includes(s) || s.includes(itemEq))) {
			exact.push(item);
		}
	}
	const out = [...exact, ...bodyweight];
	if (out.length <= CATALOG_PROMPT_CAP) return out;

	// Cap estourou: estratifica por bodyPart em round-robin em vez de slice
	// cego — o slice concentrava poucos grupos musculares e cortava os body
	// weight (sempre apendados por último) justamente no cenário home.
	const roundRobin = (items: CatalogPromptItem[], cap: number): CatalogPromptItem[] => {
		const groups = new Map<string, CatalogPromptItem[]>();
		for (const item of items) {
			const key = item.bodyPart ?? 'outro';
			const g = groups.get(key);
			if (g) g.push(item);
			else groups.set(key, [item]);
		}
		const lists = Array.from(groups.values());
		const result: CatalogPromptItem[] = [];
		for (let idx = 0; result.length < cap; idx++) {
			let took = false;
			for (const list of lists) {
				const item = list[idx];
				if (!item) continue;
				result.push(item);
				took = true;
				if (result.length >= cap) break;
			}
			if (!took) break;
		}
		return result;
	};

	// Cota mínima reservada pro body weight (universal — cenário home).
	const bwQuota = Math.min(20, bodyweight.length);
	const picked = roundRobin(exact, CATALOG_PROMPT_CAP - bwQuota);
	picked.push(...roundRobin(bodyweight, CATALOG_PROMPT_CAP - picked.length));
	if (picked.length < CATALOG_PROMPT_CAP) {
		// body weight não encheu a cota — completa com o restante do exact.
		const chosen = new Set(picked.map((i) => i.externalId));
		for (const item of exact) {
			if (picked.length >= CATALOG_PROMPT_CAP) break;
			if (!chosen.has(item.externalId)) picked.push(item);
		}
	}
	return picked;
}

async function fetchCatalogSubset(
	studentEquipment: string[] | null | undefined,
	experienceLevel: string | null | undefined,
	prescribedDifficulty: string | null | undefined
): Promise<CatalogPromptItem[]> {
	const all = await db
		.select({
			externalId: exerciseCatalog.externalId,
			name: exerciseCatalog.name,
			nameEn: exerciseCatalog.nameEn,
			equipment: exerciseCatalog.equipment,
			bodyPart: exerciseCatalog.bodyPart,
			targetMuscle: exerciseCatalog.targetMuscle,
			difficulty: exerciseCatalog.difficulty
		})
		.from(exerciseCatalog)
		// Sem orderBy a ordem era a de heap do Postgres — catálogo diferente a
		// cada geração. Ordena por grupo/nível pra estratificação determinística.
		.orderBy(exerciseCatalog.bodyPart, exerciseCatalog.difficulty);
	return filterCatalog(all, studentEquipment, experienceLevel, prescribedDifficulty);
}

function formatCatalogForPrompt(items: CatalogPromptItem[]): string {
	if (items.length === 0) {
		return '(catálogo indisponível — gerar com exercícios livres, sem catalog_id)';
	}
	// Formato compacto: [id] nome (equip · grupo · nível)
	// O modelo precisa do nome PT pra raciocinar e do external_id pra
	// preencher catalog_id. Mantém uma única linha por item.
	return items
		.map((c) => {
			const meta = [c.equipment, c.bodyPart, c.difficulty].filter(Boolean).join(' · ');
			return `${c.externalId} — ${c.name}${meta ? ` (${meta})` : ''}`;
		})
		.join('\n');
}

/**
 * Wrapper sobre o módulo compartilhado condition-tags — extrai os labels dos
 * diagnósticos (severidade embutida, pro "grave" virar estágio 2) e delega os
 * regexes pra deriveTagsFromDiagnosisLabels. Fonte única: qualquer ajuste de
 * derivação vai em condition-tags.ts (revalidação de planos usa o mesmo).
 */
function deriveConditionTags(health: HealthProfile | null): string[] {
	if (!health || (health.diagnoses ?? []).length === 0) return ['populacao_geral'];

	const tags = new Set<string>();
	if (Array.isArray(health.conditionTags)) {
		for (const t of health.conditionTags) tags.add(t);
	}
	const labels = health.diagnoses.map(
		(d) => `${d.label ?? ''}${d.severity ? ` (${d.severity})` : ''}`
	);
	for (const t of deriveTagsFromDiagnosisLabels(labels)) tags.add(t);
	if (tags.size === 0) tags.add('populacao_geral');
	return Array.from(tags);
}

/**
 * Padrões pra detectar, em texto livre da IA, menção a uma condição clínica.
 * Espelha os regex de deriveConditionTags. `family` é um substring estável da(s)
 * tag(s) correspondente(s) — usado pra checar se o aluno realmente tem a condição.
 *
 * Guard anti-alucinação (bug PreceptorFISIC): a IA gerava restrições de
 * cardiomiopatia isquêmica pra alunos sem essa condição. Aqui, qualquer
 * restriction/monitoring que cite uma condição cuja tag NÃO está no perfil é
 * descartada antes de persistir.
 */
const CONDITION_TEXT_PATTERNS: { re: RegExp; family: string }[] = [
	{ re: /hipertens|press[aã]o alta|\bhas\b/i, family: 'hipertensao' },
	{ re: /diabet|\bdm\b|\bdm[12]\b/i, family: 'diabetes' },
	{
		re: /cardiopat|cardiomiopat|coronar|\biam\b|infarto|isqu[eê]mi|angina|arritmia|\bdac\b/i,
		family: 'cardiopatia'
	},
	{ re: /insufici[eê]ncia card|\bicc\b/i, family: 'ic_' },
	{ re: /dpoc|enfisema|bronquite|pulmonar|asma|broncoespasmo|respirat[óo]ri/i, family: 'dpoc' },
	{ re: /\bavc\b|acidente vascular/i, family: 'avc' },
	{ re: /parkinson/i, family: 'parkinson' },
	{ re: /esclerose m[uú]ltipla/i, family: 'esclerose' },
	{ re: /gestante|gr[aá]vida|gravidez/i, family: 'gestante' },
	{ re: /osteoartr|artrose/i, family: 'osteoartrite' },
	{ re: /dor lombar|lombalgia/i, family: 'lombar' },
	{ re: /obesidade/i, family: 'obesidade' },
	{ re: /c[aâ]ncer|oncolog|quimioterap/i, family: 'cancer' },
	{ re: /dislipidemia|colesterol/i, family: 'dislipidemia' },
	{ re: /sarcopenia|fr[aá]gil/i, family: 'fragil' },
	{ re: /\blca\b|ligamento cruzado/i, family: 'lca' }
];

/**
 * Métricas que implicam patologia — monitorings alucinados costumam vir
 * fraseados pela MÉTRICA ("Glicemia capilar pré-treino") em vez do nome da
 * doença, escapando de CONDITION_TEXT_PATTERNS. Usada SÓ no filtro de
 * monitoring_parameters: em restrição, "saturação" pode aparecer em contexto
 * não-patológico; em monitoring, a métrica implica a patologia.
 */
const METRIC_TEXT_PATTERNS: { re: RegExp; family: string }[] = [
	{ re: /glicemia|glicose capilar/i, family: 'diabetes' },
	{ re: /\bspo2\b|oximetr|satura[çc][ãa]o de ox/i, family: 'dpoc' },
	{ re: /\bderrame\b/i, family: 'avc' }
];

/**
 * Texto livre do perfil (labels/notas de diagnósticos + lesões), lowercased.
 * Segunda fonte de verdade do guard: condição real registrada no perfil mas
 * SEM tag mapeada (ex.: asma, fibromialgia) NÃO pode ser tratada como
 * alucinação — dropar o aviso seria remover camada de segurança legítima.
 */
function buildProfileFreeText(health: HealthProfile | null): string {
	if (!health) return '';
	const parts: string[] = [];
	for (const d of health.diagnoses ?? []) parts.push(d.label ?? '', d.notes ?? '');
	const inj = (health.injuries as Array<{ region?: string; notes?: string }> | null) ?? [];
	for (const i of inj) parts.push(i.region ?? '', i.notes ?? '');
	return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Retorna o nome da primeira condição "órfã" citada no texto (presente no texto
 * mas SEM tag correspondente no perfil E sem menção no texto livre do perfil),
 * ou null se tudo confere.
 */
function mentionsAbsentCondition(
	text: string,
	conditionTags: string[],
	profileFreeText: string
): string | null {
	if (!text) return null;
	for (const { re, family } of CONDITION_TEXT_PATTERNS) {
		if (re.test(text)) {
			const present = conditionTags.some((t) => t.includes(family));
			if (present) continue;
			// Condição sem tag mapeada mas registrada no perfil não é alucinação.
			if (profileFreeText && re.test(profileFreeText)) continue;
			return family;
		}
	}
	return null;
}

/**
 * mentionsAbsentCondition + métricas de patologia (glicemia→diabetes,
 * SpO2→dpoc, derrame→avc). Mesmo critério: só é órfã se a família não está
 * nas tags NEM aparece (por nome ou métrica) no texto livre do perfil.
 */
function mentionsAbsentConditionOrMetric(
	text: string,
	conditionTags: string[],
	profileFreeText: string
): string | null {
	const byName = mentionsAbsentCondition(text, conditionTags, profileFreeText);
	if (byName) return byName;
	if (!text) return null;
	for (const { re, family } of METRIC_TEXT_PATTERNS) {
		if (!re.test(text)) continue;
		const present = conditionTags.some((t) => t.includes(family));
		if (present) continue;
		const condRe = CONDITION_TEXT_PATTERNS.find((p) => p.family === family)?.re;
		if (profileFreeText && (re.test(profileFreeText) || condRe?.test(profileFreeText))) continue;
		return family;
	}
	return null;
}

async function loadStudentContext(
	studentId: string,
	professionalId: string
): Promise<StudentContext> {
	const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
	if (!student || student.professionalId !== professionalId) {
		throw new Error('Aluno não encontrado ou não pertence a este profissional.');
	}
	const [health] = await db
		.select()
		.from(healthProfiles)
		.where(eq(healthProfiles.studentId, studentId))
		.limit(1);
	const [preferences] = await db
		.select()
		.from(trainingPreferences)
		.where(eq(trainingPreferences.studentId, studentId))
		.limit(1);
	const [assessment] = await db
		.select()
		.from(physicalAssessments)
		.where(eq(physicalAssessments.studentId, studentId))
		.orderBy(desc(physicalAssessments.assessedAt))
		.limit(1);

	const catalog = await fetchCatalogSubset(
		(preferences?.equipmentAvailable as string[] | null) ?? null,
		preferences?.experienceLevel ?? null,
		preferences?.prescribedDifficulty ?? null
	);

	return {
		student,
		health: health ?? null,
		preferences: preferences ?? null,
		assessment: assessment ?? null,
		conditionTags: deriveConditionTags(health ?? null),
		catalog
	};
}

/**
 * Bloco de dados do aluno + RAG + catálogo. Não contém a TAREFA de propósito:
 * é IDÊNTICO nas duas fases da geração e em todas as chamadas paralelas de
 * sessão, então leva cache_control e é cobrado a ~0.1x depois da 1ª chamada
 * (ver buildPhasedMessages). A tarefa, que varia, vem depois do breakpoint.
 */
function buildUserPromptBase(ctx: StudentContext, ragContext: string, notes?: string): string {
	const s = ctx.student;
	const h = ctx.health;
	const p = ctx.preferences;
	const age = s.birthDate
		? Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
		: null;
	const bmi =
		s.weightKg && s.heightCm
			? Math.round((s.weightKg / Math.pow(s.heightCm / 100, 2)) * 10) / 10
			: null;

	const lines: string[] = [];
	lines.push('## DADOS DO ALUNO');
	lines.push(`- Nome: ${s.name}`);
	if (age !== null) lines.push(`- Idade: ${age} anos`);
	lines.push(`- Sexo: ${s.sex}`);
	if (s.weightKg) lines.push(`- Peso: ${s.weightKg} kg`);
	if (s.heightCm) lines.push(`- Altura: ${s.heightCm} cm`);
	if (bmi !== null) lines.push(`- IMC: ${bmi}`);
	lines.push('');

	// AVALIAÇÃO FÍSICA — dados objetivos medidos (PA, FC, composição, testes).
	// Antes ausentes no prompt: a IA prescrevia sem ver PA/FC/gordura. Guiam
	// intensidade e monitoramento junto do risco CV.
	const a = ctx.assessment;
	if (a) {
		const assessedAt = a.assessedAt ? new Date(a.assessedAt).toISOString().slice(0, 10) : null;
		lines.push(`## AVALIAÇÃO FÍSICA${assessedAt ? ` (medida em ${assessedAt})` : ''}`);
		if (a.bloodPressureSystolic != null && a.bloodPressureDiastolic != null)
			lines.push(
				`- Pressão arterial de repouso: ${a.bloodPressureSystolic}/${a.bloodPressureDiastolic} mmHg`
			);
		if (a.restingHr != null) lines.push(`- FC de repouso: ${a.restingHr} bpm`);
		if (a.bmi != null) lines.push(`- IMC (avaliação): ${a.bmi}`);
		if (a.bodyFatPct != null) lines.push(`- % de gordura: ${a.bodyFatPct}%`);
		if (a.leanMassKg != null) lines.push(`- Massa magra: ${a.leanMassKg} kg`);
		const tests =
			(a.fitnessTests as Array<{ name: string; value: number; unit: string }> | null) ?? [];
		for (const t of tests) lines.push(`- ${t.name}: ${t.value} ${t.unit}`);
		if (a.notes) lines.push(`- Observações da avaliação: ${a.notes}`);
		lines.push('');
	} else {
		lines.push('## AVALIAÇÃO FÍSICA');
		lines.push('- (nenhuma avaliação física registrada — prescreva de forma conservadora)');
		lines.push('');
	}

	lines.push('## DIAGNÓSTICOS');
	if (h && h.diagnoses && h.diagnoses.length > 0) {
		for (const d of h.diagnoses) {
			lines.push(
				`- ${d.label}${d.severity ? ` (${d.severity})` : ''}${d.since ? ` desde ${d.since}` : ''}${d.notes ? ` — ${d.notes}` : ''}`
			);
		}
	} else {
		lines.push('- (nenhum diagnóstico registrado)');
	}
	lines.push('');
	lines.push('## MEDICAMENTOS');
	if (h && h.medications && h.medications.length > 0) {
		for (const m of h.medications) {
			lines.push(
				`- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` · ${m.frequency}` : ''}`
			);
		}
	} else {
		lines.push('- (sem medicamentos em uso)');
	}
	lines.push('');
	// Limitações físicas / lesões (campo "limitations" do form → injuries jsonb).
	// Crítico pra IA evitar movimentos que afetam regiões comprometidas.
	const inj = (h?.injuries as Array<{ region: string; notes?: string }> | null) ?? [];
	lines.push('## LIMITAÇÕES FÍSICAS / LESÕES (EVITAR exercícios que estressem essas regiões)');
	if (inj.length > 0) {
		for (const i of inj) {
			lines.push(`- ${i.region}${i.notes ? ` — ${i.notes}` : ''}`);
		}
	} else {
		lines.push('- (nenhuma limitação reportada)');
	}
	lines.push('');
	// Risco CV definido no cadastro (calculadora SBC — Escore de Risco Global) e
	// gravado no perfil. É entrada OBRIGATÓRIA da prescrição.
	const cvRisk = h?.cardiovascularRisk ?? 'baixo';
	lines.push(`## RISCO CARDIOVASCULAR (SBC): ${cvRisk}`);
	lines.push(
		'- Module a prescrição por este risco: quanto maior, mais conservadora a intensidade inicial, progressão mais gradual, e mais parâmetros de monitoramento/necessidade de liberação médica. Muito alto exige cautela máxima.'
	);
	lines.push('');
	lines.push('## TAGS DE CONDIÇÃO (canônicas, derivadas dos diagnósticos)');
	lines.push(`- ${ctx.conditionTags.join(', ')}`);
	lines.push('');
	lines.push('## PREFERÊNCIAS DE TREINO');
	if (p) {
		lines.push(`- Experiência: ${p.experienceLevel}`);
		// Lembrete de volume semanal por grupamento — amarra o nível do aluno à
		// faixa definida em "== VOLUME SEMANAL POR GRUPAMENTO MUSCULAR ==" do
		// system prompt, somando as séries de todas as sessões da semana.
		const volumeGuide: Record<string, string> = {
			iniciante:
				'INICIANTE → volume semanal por grupamento (somando todas as sessões): GRANDES 6–10 séries, PEQUENOS 4–8 séries. Comece no piso da faixa.',
			intermediario:
				'INTERMEDIÁRIO → volume semanal por grupamento (somando todas as sessões): GRANDES 10–16 séries, PEQUENOS 8–12 séries.',
			avancado:
				'AVANÇADO → volume semanal por grupamento (somando todas as sessões): GRANDES 14–24 séries, PEQUENOS 10–18 séries.'
		};
		const lvl = p.experienceLevel ?? 'iniciante';
		lines.push(
			`- Volume-alvo: ${volumeGuide[lvl] ?? volumeGuide.iniciante} Distribua em 2–3 estímulos semanais por grupamento; não exceda o teto da faixa.`
		);
		const difficultyGuide: Record<string, string> = {
			pequena:
				'PEQUENA — priorizar exercícios de baixa complexidade técnica (máquinas guiadas, peso do corpo, movimentos uni-articulares simples), baixo risco de lesão e fácil execução. Evitar exercícios técnicos como agachamento livre, levantamento terra, arranco, ou movimentos olímpicos.',
			media:
				'MÉDIA — mix equilibrado: incluir alguns exercícios livres e multi-articulares com progressão moderada, mas sem variações muito avançadas.',
			alta: 'ALTA — pode prescrever exercícios complexos e desafiadores (peso livre, multi-articulares, variações avançadas, unilaterais instáveis) compatíveis com as restrições clínicas.'
		};
		const diff = p.prescribedDifficulty ?? 'media';
		lines.push(
			`- Dificuldade-alvo dos exercícios: ${difficultyGuide[diff] ?? difficultyGuide.media}`
		);
		// Estrutura semanal — knob do profissional pra forçar divisão. "auto"
		// deixa a IA decidir com base em frequência (regra abaixo).
		const splitGuide: Record<string, string> = {
			auto: `AUTOMÁTICA — escolha a divisão pela frequência: 1-3x/sem → FULL-BODY (todos os grupos em toda sessão); 4x → UPPER/LOWER (alterna superior e inferior); 5-6x → PUSH/PULL/LEGS.`,
			full_body:
				'FULL-BODY — cada sessão deve cobrir todos os grandes grupos (peito, costas, pernas, ombros, core). Não criar sessões "só de braço" ou "só de perna".',
			upper_lower:
				'UPPER/LOWER — alternar estritamente: sessões ímpares (1ª, 3ª…) = upper (peito, costas, ombros, braços, core superior); pares = lower (quadríceps, posteriores, glúteos, panturrilha, core inferior).',
			push_pull_legs:
				'PUSH/PULL/LEGS — sessão 1 = push (peito, ombros, tríceps); sessão 2 = pull (costas, bíceps, posteriores de braço); sessão 3 = legs (todas as pernas + glúteos). Pra 4+ sessões, repetir o ciclo.'
		};
		const split = p.trainingSplit ?? 'auto';
		lines.push(`- Estrutura do treino: ${splitGuide[split] ?? splitGuide.auto}`);
		lines.push(`- Frequência: ${p.weeklySessions}x/semana, ${p.minutesPerSession} min/sessão`);
		lines.push(`- Objetivos: ${(p.goals ?? []).join(', ')}`);
		if ((p.preferredModalities ?? []).length > 0)
			lines.push(`- Modalidades preferidas: ${p.preferredModalities.join(', ')}`);
		if ((p.equipmentAvailable ?? []).length > 0)
			lines.push(`- Equipamento disponível: ${p.equipmentAvailable.join(', ')}`);
		if (p.notes) lines.push(`- Notas: ${p.notes}`);
	} else {
		lines.push('- (preferências não registradas — assumir iniciante, 3x/sem, 60min)');
	}
	lines.push('');
	if (notes) {
		lines.push('## OBSERVAÇÕES DO PROFISSIONAL');
		lines.push(notes);
		lines.push('');
	}
	lines.push('## CONTEXTO CLÍNICO (chunks recuperados via RAG)');
	lines.push('NOTA: Chunks marcados com ★ ALTA PREFERÊNCIA são ACSM e devem ter PRIORIDADE.');
	lines.push('Chunks marcados com ○ baixa são AHA — usar apenas se ACSM não cobrir o ponto.');
	lines.push('');
	lines.push(ragContext);
	lines.push('');
	lines.push(`## CATÁLOGO DE EXERCÍCIOS DISPONÍVEIS (${ctx.catalog.length} itens)`);
	lines.push(
		'Cada linha: `external_id — nome (equipamento · grupo muscular · nível)`. Esses exercícios têm vídeo demonstrativo e instruções traduzidas no app do aluno.'
	);
	lines.push('');
	lines.push(formatCatalogForPrompt(ctx.catalog));

	return lines.join('\n');
}

/**
 * Prévia pra UI durante a geração: as molduras viradas em `weekly_sessions`,
 * com os exercícios das sessões que já fecharam e blocos vazios nas que ainda
 * estão rodando. É o que faz o plano se materializar na tela sessão por sessão
 * — a prévia usa optional chaining em warmup/main/cooldown, então bloco vazio
 * renderiza sem quebrar.
 */
function sessionsPreview(
	outlines: SessionOutline[],
	filled: Array<SessionExercises | null> = []
): unknown {
	return {
		weekly_sessions: outlines.map((o, i) => ({
			label: o.label,
			day_of_week: o.day_of_week,
			focus: o.focus,
			duration_minutes: o.duration_minutes,
			warmup: filled[i]?.warmup ?? [],
			main: filled[i]?.main ?? [],
			cooldown: filled[i]?.cooldown ?? []
		}))
	};
}

/** Nº de sessões pedido pelo aluno, com o mesmo clamp usado no prompt e na UI. */
function targetSessionCount(ctx: StudentContext): number {
	return Math.max(1, Math.min(7, ctx.preferences?.weeklySessions ?? 3));
}

/**
 * FASE 1a — só a divisão da semana. Schema mínimo e tarefa curta: é a chamada
 * mais barata do fluxo (~6s) e a única que precisa acertar de primeira, porque
 * tudo depois depende dela.
 */
function buildSplitTask(ctx: StudentContext): string {
	const N = targetSessionCount(ctx);
	return [
		'## TAREFA — DIVISÃO DA SEMANA',
		`Defina a divisão semanal deste aluno: EXATAMENTE ${N} strings em \`session_focus\`, uma por sessão, na ordem dos dias (${suggestedDaysFor(N)}).`,
		'Cada string = o foco daquela sessão + os grupamentos musculares que ela treina. Ex: "Full body A — peitoral, dorsal, quadríceps, core".',
		'Respeite a Estrutura do treino e o volume-alvo definidos nas PREFERÊNCIAS, e distribua os grupamentos entre os dias sem sobreposição desnecessária.',
		'NÃO gere exercícios, nem resumo, nem mais nenhum campo — só a divisão.'
	].join('\n');
}

/**
 * FASE 1b — metadados do programa. Roda em PARALELO com as sessões: o perfil
 * clínico completo (diagnósticos, limitações, risco CV, RAG) já está no prompt
 * base que as sessões também recebem, então elas não precisam esperar por isto.
 */
function buildMetadataTask(focos: string[]): string {
	return [
		'## TAREFA — PROGRAMA (SEM EXERCÍCIOS)',
		'A divisão semanal já foi definida (abaixo) e os exercícios de cada dia estão sendo prescritos em outra chamada. Aqui você descreve o PROGRAMA.',
		'',
		'### DIVISÃO JÁ DEFINIDA',
		...focos.map((f, i) => `- Sessão ${i + 1}: ${f}`),
		'',
		'Preencha `summary`, `objective`, `program_weeks`, `progression_strategy`, `aerobic_prescriptions`, `monitoring_parameters`, `assessment_protocols` e `restrictions`, com as citações (`source_refs`) exigidas pelas REGRAS DA TAREFA. Restrições e monitoramento valem pro programa todo.',
		'NÃO gere exercícios nem sessões.'
	].join('\n');
}

/**
 * FASE 2 — tarefa de UMA sessão. Recebe também as outras molduras: as N
 * chamadas rodam em paralelo e nenhuma vê o output da outra, então cada uma
 * precisa saber o que os outros dias cobrem pra não repetir o estímulo.
 */
function buildSessionTask(outlines: SessionOutline[], index: number): string {
	const outline = outlines[index]!;
	const others = outlines
		.map((o, i) => (i === index ? null : `- ${o.day_of_week}: ${o.focus}`))
		.filter((l) => l !== null);

	const lines = [
		'## TAREFA — EXERCÍCIOS DE UMA SESSÃO',
		`O programa já foi definido. Gere APENAS os exercícios da sessão de ${outline.day_of_week}, seguindo as REGRAS DA TAREFA do system prompt (ficha de prescrição completa em cada exercício de força).`,
		'',
		'### SESSÃO A GERAR',
		`- Dia: ${outline.day_of_week}`,
		`- Foco e grupamentos: ${outline.focus}`,
		`- Duração: ${outline.duration_minutes} min`,
		`- Bloco principal: gere EXATAMENTE ${outline.main_exercise_count} exercícios em \`main\`.`,
		'- `warmup`: no máximo 2 exercícios. `cooldown`: no máximo 1.',
		'- `observations`: orientação geral da sessão, se houver.',
		// A regra 6 do system já pede a ficha completa, mas esta chamada vê só
		// uma sessão: sem o lembrete, `cadence` vinha vazio em parte dos
		// exercícios e a ficha impressa saía furada.
		'- FICHA COMPLETA em CADA exercício de força: `intensity` (% 1RM), `load_guidance` (PSE x-y), `cadence` (obrigatório, default "2/2"), `muscle_action`, `range_of_motion`, `rest_label`, além de `sets`/`reps`/`rest_seconds`.',
		''
	];

	if (others.length > 0) {
		lines.push('### OUTRAS SESSÕES DA SEMANA (NÃO gere estas — só evite duplicar o estímulo)');
		lines.push(...others);
	}

	return lines.join('\n');
}

/**
 * Bloco "## TAREFA" da geração em UMA chamada (usado pelo fallback de quota).
 * Sai depois do breakpoint de cache porque interpola dados do aluno.
 */
function buildSingleShotTask(ctx: StudentContext): string {
	const lines: string[] = [];
	lines.push('## TAREFA');
	lines.push(
		'Gere um plano de treino semanal estruturado conforme o schema, seguindo as REGRAS DA TAREFA definidas no system prompt. Regra adicional específica deste aluno:'
	);
	// Antes o cap era 5: quem pedia 6–7 recebia só 5 sessões e a aderência
	// (sessions7 / weeklySessions) ficava distorcida.
	const N = targetSessionCount(ctx);
	lines.push(
		`SESSÕES SEMANAIS: gere EXATAMENTE ${N} sessões — esse é o número que o aluno definiu na frequência alvo dele. Distribua os treinos pela semana com descanso entre eles — sugestão de distribuição pra ${N} sessões: ${suggestedDaysFor(N)}.`
	);

	return lines.join('\n');
}

/**
 * Regras estáticas da tarefa — idênticas em TODA geração. Ficam no bloco de
 * sistema CACHEADO (prompt caching Anthropic): junto do SYSTEM_PROMPT elas
 * passam do mínimo cacheável do Opus 4.8 (4096 tokens) e são cobradas a
 * ~0.1x nas gerações seguintes, em vez de preço cheio a cada plano.
 * NÃO interpolar nada dinâmico aqui — um byte diferente invalida o cache.
 */
const STATIC_TASK_RULES = [
	'## REGRAS DA TAREFA',
	'1. PREFERIR exercícios do CATÁLOGO fornecido na mensagem sempre que possível — quando usar um, preencha `catalog_id` da exercise com o external_id (formato 4-5 dígitos, ex: "0001"). Mira em ≥80% dos exercícios do bloco principal vindos do catálogo. Para aquecimento/desaquecimento, pode usar exercícios livres se necessário.',
	'2. Para cada recomendação crítica, cite chunk_id do CONTEXTO CLÍNICO fornecido na mensagem — preferindo chunks ACSM quando disponíveis. Se não estiver coberto, marque source.type = "inference".',
	'3. Quando escolher do catálogo, use o nome EXATO do catálogo no campo `name` (não invente variações), e copie o external_id PRECISO em `catalog_id`.',
	'4. OBRIGATÓRIO preencher `day_of_week` de CADA sessão (valores válidos: "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom"). CONCISÃO (o tempo de geração é limitado): `execution_notes` curto conforme o formato definido acima (1-2 frases, 40-120 chars); `summary` = 2-3 frases; `progression_strategy` = 3-4 frases; monitoring_parameters: no máximo 3 itens; assessment_protocols: no máximo 2; restrictions: red/yellow só com red flag real — greens de alinhamento com diretriz continuam permitidas (1-2 num plano baixo-risco); warmup: no máximo 2 exercícios; cooldown: no máximo 1.',
	'5. RESPEITE a Dificuldade-alvo dos exercícios definida nas PREFERÊNCIAS da mensagem. A escolha dos exercícios deve refletir esse nível de complexidade técnica, independente do nível de experiência informado.',
	'6. FICHA DE PRESCRIÇÃO — para CADA exercício de força (warmup e main), preencha SEMPRE estes campos curtos, no padrão de prescrição brasileiro: `intensity` = % de 1RM no formato "% 1RM" (ex: "80% 1RM", "60-80% 1RM"; em peso corporal/isometria pode omitir); `load_guidance` = PSE (Percepção Subjetiva de Esforço) no formato "PSE x-y" (ex: "PSE 6-7") — NUNCA escreva "RPE". `intensity` (% 1RM) e `load_guidance` (PSE) são complementares e aparecem lado a lado na ficha. `muscle_action` = um de "isotonica" | "isometrica" | "auxotonico" | "isocinetica" (isométrica p/ pranchas/isometrias); `cadence` = OBRIGATÓRIO em TODO exercício de força — tempo de execução excêntrica/concêntrica (ex: "2/2", "3/1"); use o campo `cadence` (NÃO `tempo`); default "2/2" quando não houver motivo pra outro. `range_of_motion` = amplitude (ex: "90°", "Full", "90° de flexão do cotovelo"); `rest_label` = pausa em texto (ex: "1min", "40s", "40s/1min"). Mantenha também `sets`, `reps`, `rest_seconds` numéricos. Use `series_label` SÓ quando as séries forem um esquema (ex: "2/2").',
	'7. AERÓBIO — se o aluno tiver objetivo cardiovascular/emagrecimento ou modalidade aeróbia, gere `aerobic_prescriptions` (1 a 3 itens) no formato do modelo: `means` (ex: "Esteira", "Corrida na Rua"), `weekly_frequency` (ex: "2x semana"), `method` (ex: "Contínuo"), `pause` (ex: "-"), `intensity` (ex: "60-70%Fcmáx (150-167bpm)"), `volume` (ex: "50min"). Caso contrário, deixe a lista vazia.',
	'8. CAPA — preencha `objective` com o objetivo do programa em 1-2 frases (ex: recomposição corporal, hipertrofia, condicionamento), e `program_weeks` com a duração total estimada do programa em semanas (tipicamente 8 a 16). Para cada sessão de força, preencha `observations` quando houver orientação geral (ex: "Executar os movimentos até 1-2 repetições de reserva.").'
].join('\n');

/** Bloco de sistema completo (estável, byte-idêntico entre gerações). */
const CACHED_SYSTEM = `${SYSTEM_PROMPT_PT_BR}\n\n${STATIC_TASK_RULES}`;

/**
 * Mensagens com prompt caching: o system (prompt clínico + regras estáticas,
 * ~4.5k tokens) leva cache_control ephemeral — 1ª geração paga 1.25x nele,
 * as seguintes (mesmo profissional gerando vários planos, retry, fallback)
 * pagam ~0.1x. O conteúdo por aluno (catálogo, RAG, dados) fica na mensagem
 * de usuário, DEPOIS do breakpoint, onde variação não invalida nada.
 */
function buildMessages(userPrompt: string) {
	return [
		{
			role: 'system' as const,
			content: CACHED_SYSTEM,
			providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
		},
		{ role: 'user' as const, content: userPrompt }
	];
}

/**
 * Mensagens da geração em 2 fases. DOIS breakpoints de cache (o limite da API
 * é 4): o system e o bloco de dados do aluno — ambos byte-idênticos entre a
 * fase 1 e as N chamadas de sessão. A tarefa, que muda por chamada, vai numa
 * terceira mensagem DEPOIS dos breakpoints.
 *
 * A ordem importa pro cache valer algo: a fase 1 roda primeiro e ESCREVE o
 * prefixo; as chamadas paralelas da fase 2 então o LEEM a ~0.1x. Se a fase 2
 * rodasse primeiro (ou junto), as N chamadas concorrentes pagariam preço cheio
 * — cache só fica legível depois que a primeira resposta começa a chegar.
 */
function buildPhasedMessages(promptBase: string, task: string) {
	return [
		{
			role: 'system' as const,
			content: CACHED_SYSTEM,
			providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
		},
		{
			role: 'user' as const,
			content: promptBase,
			providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
		},
		{ role: 'user' as const, content: task }
	];
}

export type GenerateResult = {
	planId: string;
	aiRunId: string;
	durationMs: number;
	chunkIds: string[];
};

export async function generateTrainingPlan(opts: GenerateOptions): Promise<GenerateResult> {
	const correlationId = randomUUID();
	const planId = opts.planId;
	const log = logger.child({ correlationId, studentId: opts.studentId, planId });
	const startMs = Date.now();
	let modelUsed = PRIMARY_MODEL;

	log.info({ professionalId: opts.professionalId }, 'plan.generate.start');

	try {
		await db
			.update(trainingPlans)
			.set({
				status: 'generating',
				progressPct: 15,
				progressPhase: 'carregando contexto clínico',
				updatedAt: new Date()
			})
			.where(eq(trainingPlans.id, planId));

		const ctx = await loadStudentContext(opts.studentId, opts.professionalId);
		// Texto livre do perfil pro guard anti-alucinação (condições sem tag mapeada).
		const profileFreeText = buildProfileFreeText(ctx.health);

		await db
			.update(trainingPlans)
			.set({ progressPct: 35, progressPhase: 'recuperando RAG (preferência ACSM)' })
			.where(eq(trainingPlans.id, planId));

		// RAG é subsistema OPCIONAL: falha transitória (429/timeout do embedding)
		// não pode derrubar a geração — formatContextForPrompt([]) já instrui a
		// gerar com source:inference.
		let chunks: RetrievedChunk[] = [];
		let ragFailed = false;
		try {
			chunks = await retrieveRelevantChunks({
				conditionTags: ctx.conditionTags,
				goals: (ctx.preferences?.goals ?? []) as string[],
				freeText: opts.notes,
				topK: 8
			});
		} catch (ragErr) {
			ragFailed = true;
			log.warn(
				{ err: String(ragErr).slice(0, 200) },
				'rag.retrieve.failed_continuing_without_context'
			);
		}
		const ragContext = formatContextForPrompt(chunks);
		const chunkIds = chunks.map((c) => c.chunk_id);
		const orgDistribution = chunks.reduce<Record<string, number>>((acc, c) => {
			acc[c.source_organization] = (acc[c.source_organization] ?? 0) + 1;
			return acc;
		}, {});

		log.info({ chunks: chunkIds.length, orgDistribution }, 'rag.context.ready');

		await db
			.update(trainingPlans)
			.set({
				progressPct: 55,
				progressPhase: 'gerando plano com PreceptorFISIC'
			})
			.where(eq(trainingPlans.id, planId));

		// Base compartilhada por TODAS as chamadas (fase 1, fase 2, fallback):
		// dados do aluno + RAG + catálogo. Fica antes do breakpoint de cache.
		const promptBase = buildUserPromptBase(ctx, ragContext, opts.notes);
		const genStartMs = Date.now();

		let plan: TrainingPlanOutput;
		let usage: { inputTokens?: number; outputTokens?: number } | undefined;
		/** Preenchido quando alguma sessão falhou e o plano saiu parcial. */
		let salvaged: { kept: number; of: number } | undefined;

		// Timer de progresso — as chamadas não são streamadas, então sem ele a
		// barra ficaria congelada durante cada fase. Aproxima de 88 de forma
		// assintótica (ease-out): avança rápido no começo e vai diminuindo o
		// passo, então nunca parece travada. Cap em 88 pra os passos
		// pós-geração (91/95/100) sempre irem pra frente. Compartilhado entre a
		// fase das sessões e o fallback single-shot (que leva minutos).
		const startProgressTimer = (startPct: number) => {
			let pct = startPct;
			return setInterval(() => {
				const step = Math.max(1, Math.round((88 - pct) / 10));
				pct = Math.min(88, pct + step);
				db.update(trainingPlans)
					.set({ progressPct: pct, updatedAt: new Date() })
					.where(eq(trainingPlans.id, planId))
					.catch(() => {});
			}, 4000);
		};

		/** Soma o usage de todas as chamadas (fase 1 + N sessões). */
		const accumulateUsage = (u?: { inputTokens?: number; outputTokens?: number }) => {
			if (!u) return;
			usage = {
				inputTokens: (usage?.inputTokens ?? 0) + (u.inputTokens ?? 0),
				outputTokens: (usage?.outputTokens ?? 0) + (u.outputTokens ?? 0)
			};
		};

		/**
		 * Uma chamada estruturada, resiliente aos dois modos de falha que
		 * medimos no Sonnet 5 + @ai-sdk/anthropic 3.0.100:
		 *
		 * 1) A tool call às vezes chega embrulhada — `{"parameters": {...}}` ou
		 *    `{"parameters": "<json string>"}` — e o SDK desiste com "response
		 *    did not match schema" mesmo com o conteúdo perfeito (~25% das
		 *    chamadas na medição). Aqui a gente desembrulha e valida na mão.
		 * 2) Uma reprovação genuína de schema (campo faltando, string longa
		 *    demais) normalmente passa na segunda tentativa.
		 *
		 * Erro de quota e abort do orçamento sobem direto: o primeiro tem
		 * fallback próprio, o segundo não tem tempo pra retentar.
		 */
		const generateStructured = async <T>(
			label: string,
			schema: z.ZodType<T, z.ZodTypeDef, unknown>,
			schemaName: string,
			task: string,
			maxOutputTokens: number,
			model: string
		): Promise<T> => {
			const call = async (): Promise<T> => {
				const gen = await generateObject({
					model: anthropic(model),
					schema,
					schemaName,
					// Mesmo prefixo (system + base do aluno) em todas as chamadas →
					// as que vêm depois da primeira leem o cache a ~0.1x.
					messages: buildPhasedMessages(promptBase, task),
					// System vai em messages DE PROPÓSITO (cache_control do Anthropic
					// só se aplica message-level). Conteúdo é estático do código.
					allowSystemInMessages: true,
					maxOutputTokens,
					maxRetries: 1,
					providerOptions: GEN_PROVIDER_OPTIONS,
					abortSignal: AbortSignal.timeout(remainingGenBudgetMs(startMs))
				});
				accumulateUsage(gen.usage);
				return gen.object;
			};

			/** Resgata o objeto quando o provider embrulha a tool call. */
			const unwrap = (err: unknown): T | null => {
				if (!NoObjectGeneratedError.isInstance(err)) return null;
				const rescued = unwrapParametersEnvelope(err.text, schema);
				if (rescued) log.warn({ label }, 'plan.generate.unwrapped_parameters_envelope');
				return rescued;
			};

			try {
				return await call();
			} catch (err) {
				if (isQuotaError(err) || isAbortError(err)) throw err;
				const rescued = unwrap(err);
				if (rescued) return rescued;
				log.warn(
					{ label, err: String(err).slice(0, 200) },
					'plan.generate.structured_retrying_once'
				);
				try {
					return await call();
				} catch (retryErr) {
					if (isQuotaError(retryErr) || isAbortError(retryErr)) throw retryErr;
					const rescuedRetry = unwrap(retryErr);
					if (rescuedRetry) return rescuedRetry;
					throw retryErr;
				}
			}
		};

		/**
		 * Orquestra as três chamadas. A divisão da semana vem primeiro porque
		 * tudo depende dela; depois os metadados do programa e as N sessões
		 * disparam JUNTOS, então o tempo de parede é o da chamada mais lenta e
		 * não a soma — foi a serialização de tudo numa chamada só que estourava
		 * o teto da função. Sessão que falha vira `null` e é descartada na
		 * remontagem (plano parcial), em vez de derrubar o plano todo.
		 */
		const runPhasedGeneration = async (model: string) => {
			const split = await generateStructured(
				'split',
				weeklySplitSchema,
				'WeeklySplit',
				buildSplitTask(ctx),
				2_000,
				model
			);
			const outlines = buildOutlines(
				targetSessionCount(ctx),
				ctx.preferences?.minutesPerSession ?? 60,
				split.session_focus
			);
			const total = outlines.length;
			log.info({ sessions: total, model }, 'plan.generate.split.ready');

			await db
				.update(trainingPlans)
				.set({
					progressPct: 62,
					progressPhase: `compondo ${total} sessões em paralelo`,
					planData: sessionsPreview(outlines) as TrainingPlanOutput,
					updatedAt: new Date()
				})
				.where(eq(trainingPlans.id, planId));

			const progressTimer = startProgressTimer(65);
			const filled: Array<SessionExercises | null> = new Array(total).fill(null);
			let done = 0;

			try {
				const [metadata] = await Promise.all([
					generateStructured(
						'metadata',
						programMetadataSchema,
						'ProgramMetadata',
						buildMetadataTask(split.session_focus),
						6_000,
						model
					),
					...outlines.map(async (outline, i) => {
						try {
							filled[i] = await generateStructured(
								`session:${outline.day_of_week}`,
								sessionExercisesSchema,
								'SessionExercises',
								buildSessionTask(outlines, i),
								8_000,
								model
							);
						} catch (sessionErr) {
							// Quota tem que subir: o fallback single-shot gera o plano
							// inteiro no Opus, o que é melhor que um plano furado.
							if (isQuotaError(sessionErr)) throw sessionErr;
							log.warn(
								{ day: outline.day_of_week, err: String(sessionErr).slice(0, 200) },
								'plan.generate.session.failed'
							);
							return;
						}
						done++;
						// Cada sessão que fecha aparece na prévia na hora, com os
						// exercícios — sem isso a tela ficaria com as molduras vazias
						// do começo até o fim da geração.
						await db
							.update(trainingPlans)
							.set({
								progressPhase: `sessões prontas: ${done} de ${total}`,
								planData: sessionsPreview(outlines, filled) as TrainingPlanOutput,
								updatedAt: new Date()
							})
							.where(eq(trainingPlans.id, planId))
							.catch(() => {});
					})
				]);

				const ok = filled.filter((s) => s !== null).length;
				if (ok === 0) throw new Error('Nenhuma sessão do plano pôde ser gerada.');

				const parsed = trainingPlanSchema.safeParse(assemblePlan(metadata, outlines, filled));
				if (!parsed.success) {
					// Remontagem inválida é bug nosso ou violação que os schemas das
					// partes não pegaram — loga o motivo real em vez de deixar
					// "Geração falhou" sem rastro.
					throw new Error(
						`Plano remontado não validou: ${parsed.error.issues
							.slice(0, 3)
							.map((i) => `${i.path.join('.')}: ${i.message}`)
							.join('; ')}`
					);
				}
				return {
					object: parsed.data,
					salvaged: ok < total ? { kept: ok, of: total } : undefined
				};
			} finally {
				clearInterval(progressTimer);
			}
		};

		try {
			const r = await runPhasedGeneration(PRIMARY_MODEL);
			plan = r.object;
			salvaged = r.salvaged;
		} catch (primaryErr) {
			if (!isQuotaError(primaryErr)) throw primaryErr;
			log.warn({ err: String(primaryErr).slice(0, 200) }, 'plan.generate.primary_quota_fallback');
			// Limpa o streamText de tentativas anteriores — sem isso a prévia
			// exibe texto morto enquanto o fallback gera.
			await db
				.update(trainingPlans)
				.set({
					progressPhase: 'PreceptorFISIC saturado — tentando rota alternativa',
					streamText: null,
					updatedAt: new Date()
				})
				.where(eq(trainingPlans.id, planId));
			// Fallback: plano INTEIRO numa chamada só (sem o fatiamento em fases)
			// — o Opus é raramente tocado e aqui o que importa é não voltar de
			// mãos vazias, mesmo que a chamada seja longa.
			// O teto vem do MESMO orçamento da função: o erro de quota costuma
			// vir cedo, então sobra tempo pro Opus gerar e ainda validar — mas
			// se vier tarde, o abort dispara antes do runtime matar a função.
			// Timer próprio: sem ele a barra congelava por até 2 min no Pro.
			const fbTimer = startProgressTimer(58);
			try {
				const fallbackGen = await generateObject({
					model: anthropic(FALLBACK_MODEL),
					schema: trainingPlanSchema,
					schemaName: 'TrainingPlan',
					schemaDescription:
						'Plano de treino clínico com sessões semanais, monitoramento, restrições e citações',
					// Mesmo system cacheado da tentativa primária: o fallback LÊ o
					// cache que ela escreveu.
					messages: buildMessages(`${promptBase}\n\n${buildSingleShotTask(ctx)}`),
					allowSystemInMessages: true,
					maxOutputTokens: 32_000,
					maxRetries: 1,
					providerOptions: GEN_PROVIDER_OPTIONS,
					abortSignal: AbortSignal.timeout(remainingGenBudgetMs(startMs))
				});
				plan = fallbackGen.object;
				accumulateUsage(fallbackGen.usage);
			} finally {
				clearInterval(fbTimer);
			}
			modelUsed = FALLBACK_MODEL;
		}
		const genElapsed = Date.now() - genStartMs;

		// Plano salvo parcialmente: avisa o profissional na revisão — sem isso o
		// plano truncado fica idêntico a um completo (status 'generated').
		if (salvaged) {
			const targetN = Math.max(1, Math.min(7, ctx.preferences?.weeklySessions ?? 3));
			if (plan.weekly_sessions.length < targetN) {
				plan = {
					...plan,
					summary: `⚠ Geração parcial: ${plan.weekly_sessions.length} de ${targetN} sessões geradas. Revise e gere novamente se necessário. ${plan.summary}`
				};
			}
		}

		await db
			.update(trainingPlans)
			.set({ progressPct: 91, progressPhase: 'validando e persistindo' })
			.where(eq(trainingPlans.id, planId));

		// Citações rag_chunk precisam apontar pra chunks REALMENTE recuperados
		// nesta geração — UUID fabricado/truncado vira inference com note
		// automática, em vez de renderizar autoridade falsa (ou citação órfã).
		const validChunkIds = new Set(chunkIds);
		let invalidCitations = 0;
		type PlanSourceRef = TrainingPlanOutput['restrictions'][number]['source'];
		const sanitizeRef = (ref: PlanSourceRef): PlanSourceRef => {
			if (ref.type !== 'rag_chunk') return ref;
			if (ref.chunk_id && validChunkIds.has(ref.chunk_id)) return ref;
			invalidCitations++;
			return {
				...ref,
				type: 'inference',
				chunk_id: undefined,
				note: `Citação não verificada nesta geração (chunk ${ref.chunk_id?.slice(0, 8) ?? '?'} não recuperado)`
			};
		};
		for (const r of plan.restrictions) r.source = sanitizeRef(r.source);
		for (const m of plan.monitoring_parameters) m.source_refs = m.source_refs.map(sanitizeRef);
		for (const a of plan.assessment_protocols) a.source_refs = a.source_refs.map(sanitizeRef);
		for (const s of plan.weekly_sessions) {
			for (const ex of [...s.warmup, ...s.main, ...s.cooldown]) {
				ex.source_refs = ex.source_refs.map(sanitizeRef);
			}
		}
		if (invalidCitations > 0) {
			log.warn(
				{ invalid_citations: invalidCitations },
				'plan.guard.downgraded_unverified_citations'
			);
		}

		// Guard anti-alucinação clínica. Dois filtros sobre as restrições da IA:
		//   1) source.type='rule' é reservado ao engine de validação — a IA não
		//      pode emitir; quando emite, está forjando autoridade (vetor do bug).
		//   2) restrição que cita uma condição cuja tag NÃO está no perfil do aluno
		//      é alucinação (ex.: cardiomiopatia isquêmica num aluno sem cardiopatia).
		//      Greens (alinhamento com diretriz) passam — não imputam doença.
		const droppedRestrictions: string[] = [];
		const aiRestrictions: Restriction[] = plan.restrictions
			.filter((r) => {
				if (r.source.type === 'rule') {
					droppedRestrictions.push(`${r.title} [source.type=rule forjado]`);
					return false;
				}
				if (r.level !== 'green') {
					const orphan = mentionsAbsentCondition(
						`${r.title} ${r.description}`,
						ctx.conditionTags,
						profileFreeText
					);
					if (orphan) {
						droppedRestrictions.push(`${r.title} [condição ausente: ${orphan}]`);
						return false;
					}
				}
				return true;
			})
			.map((r) => ({
				level: r.level,
				title: r.title,
				description: r.description,
				affected_exercises: r.affected_exercises,
				suggestion: r.suggestion,
				source: {
					type: r.source.type,
					ref: r.source.note,
					rule_code: r.source.rule_code,
					chunk_id: r.source.chunk_id,
					source_id: r.source.source_id
				}
			}));
		if (droppedRestrictions.length > 0) {
			// Só o count no log — títulos/tags citam condição clínica e iriam pros
			// logs da Vercel (fora do controle LGPD). Detalhe fica em ai_runs.input.
			log.warn(
				{ dropped_count: droppedRestrictions.length },
				'plan.guard.dropped_hallucinated_restrictions'
			);
		}

		// Validação clínica via clinical_rules engine
		await db
			.update(trainingPlans)
			.set({ progressPct: 95, progressPhase: 'validando contra clinical_rules' })
			.where(eq(trainingPlans.id, planId));

		const age = ctx.student.birthDate
			? Math.floor(
					(Date.now() - new Date(ctx.student.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
				)
			: null;
		const studentCtx = deriveStudentCtxFromHealth(ctx.conditionTags, age, ctx.health);
		const violations = await validatePlan(plan, studentCtx);
		const ruleRestrictions: Restriction[] = violations.map(violationToRestriction);

		// Merge — IA primeiro, regras automáticas depois (com source.type='rule' fica claro)
		const restrictions: Restriction[] = [...aiRestrictions, ...ruleRestrictions];

		log.info(
			{ ai_restrictions: aiRestrictions.length, rule_violations: violations.length },
			'plan.validate.done'
		);
		// Mesmo guard nos monitoring_parameters — descarta monitoramento de
		// patologia que o aluno não tem (ex.: "FC contínua por cardiopatia"),
		// incluindo os fraseados pela métrica (glicemia/SpO2/derrame).
		const droppedMonitoring: string[] = [];
		const monitoringNotes: MonitoringNote[] = plan.monitoring_parameters
			.filter((m) => {
				const orphan = mentionsAbsentConditionOrMetric(
					`${m.parameter} ${m.frequency} ${m.alert_threshold ?? ''}`,
					ctx.conditionTags,
					profileFreeText
				);
				if (orphan) {
					droppedMonitoring.push(`${m.parameter} [condição ausente: ${orphan}]`);
					return false;
				}
				return true;
			})
			.map((m) => ({
				parameter: m.parameter,
				frequency: m.frequency,
				alert_threshold: m.alert_threshold,
				source_refs: m.source_refs
					.map((s) => s.chunk_id ?? s.source_id ?? s.note ?? '')
					.filter(Boolean)
			}));
		if (droppedMonitoring.length > 0) {
			// Count-only pelo mesmo motivo LGPD do log de restrições.
			log.warn(
				{ dropped_count: droppedMonitoring.length },
				'plan.guard.dropped_hallucinated_monitoring'
			);
		}
		const assessmentProtocols: AssessmentProtocol[] = plan.assessment_protocols.map((a) => ({
			test_name: a.test_name,
			when: a.when,
			source_refs: a.source_refs
				.map((s) => s.chunk_id ?? s.source_id ?? s.note ?? '')
				.filter(Boolean)
		}));

		const [aiRunRow] = await db
			.insert(aiRuns)
			.values({
				professionalId: opts.professionalId,
				studentId: opts.studentId,
				planId,
				kind: 'plan_generation',
				model: modelUsed,
				provider: 'google',
				input: {
					system_prompt_version: SYSTEM_PROMPT_VERSION,
					// Base do prompt (dados do aluno + RAG + catálogo). As tarefas de
					// cada fase são derivadas dela + do esqueleto, e ficam de fora pra
					// não multiplicar o row por N sessões.
					user_prompt: promptBase,
					generation_strategy: 'two_phase',
					rag_chunk_ids: chunkIds,
					rag_org_distribution: orgDistribution,
					rag_failed: ragFailed,
					condition_tags: ctx.conditionTags,
					notes: opts.notes ?? null,
					// Detalhe dos drops do guard fica AQUI (banco, sob controle LGPD)
					// — os logs de plataforma só recebem counts.
					guard_dropped: {
						restrictions: droppedRestrictions,
						monitoring: droppedMonitoring,
						invalid_citations: invalidCitations
					}
				},
				output: plan,
				tokensInput: usage?.inputTokens ?? null,
				tokensOutput: usage?.outputTokens ?? null,
				latencyMs: genElapsed,
				status: 'success',
				correlationId
			})
			.returning({ id: aiRuns.id });
		if (!aiRunRow) throw new Error('Falha ao registrar ai_run.');

		await db
			.update(trainingPlans)
			.set({
				status: 'generated',
				progressPct: 100,
				progressPhase: 'concluído',
				planData: plan,
				planSummary: plan.summary,
				restrictions,
				monitoringNotes,
				assessmentProtocols,
				aiRunId: aiRunRow.id,
				generatedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(trainingPlans.id, planId));

		const totalElapsed = Date.now() - startMs;
		log.info(
			{
				planId,
				aiRunId: aiRunRow.id,
				model: modelUsed,
				chunks: chunkIds.length,
				orgDistribution,
				restrictions: restrictions.length,
				monitoring: monitoringNotes.length,
				gen_ms: genElapsed,
				total_ms: totalElapsed,
				input_tokens: usage?.inputTokens,
				output_tokens: usage?.outputTokens
			},
			'plan.generate.success'
		);

		// Email pro profissional avisando que o plano tá pronto.
		// Fire-and-forget — falha de email não impacta o flow.
		try {
			const [prof] = await db
				.select({ name: professionals.name, email: professionals.email })
				.from(professionals)
				.where(eq(professionals.id, opts.professionalId))
				.limit(1);
			if (prof?.email) {
				sendPlanReady({
					to: prof.email,
					professionalName: prof.name,
					studentName: ctx.student.name,
					planId
				}).catch((err) => log.error({ err: String(err).slice(0, 200) }, 'plan.ready.email.failed'));
			}
		} catch (err) {
			log.error({ err: String(err).slice(0, 200) }, 'plan.ready.email.lookup_failed');
		}

		return { planId, aiRunId: aiRunRow.id, durationMs: totalElapsed, chunkIds };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error({ err, planId }, 'plan.generate.failed');

		await db
			.insert(aiRuns)
			.values({
				professionalId: opts.professionalId,
				studentId: opts.studentId,
				planId,
				kind: 'plan_generation',
				model: modelUsed,
				provider: 'google',
				input: {
					system_prompt_version: SYSTEM_PROMPT_VERSION,
					user_prompt: '(suprimido em falha)',
					notes: opts.notes ?? null
				},
				output: null,
				status: 'error',
				error: message.slice(0, 1000),
				correlationId
			})
			.catch(() => {});

		await db
			.update(trainingPlans)
			.set({
				status: 'failed',
				progressPct: 0,
				progressPhase: 'erro',
				errorMessage: message.slice(0, 500),
				updatedAt: new Date()
			})
			.where(eq(trainingPlans.id, planId));

		throw err;
	}
}

/**
 * "Background" no Vercel = waitUntil() do @vercel/functions.
 * Sem isso, a serverless function morre assim que a action retorna o redirect,
 * matando a Promise órfã e deixando o plano em status 'pending' pra sempre.
 *
 * waitUntil estende o lifetime da invocação até a Promise resolver,
 * limitado pelo maxDuration do route (60s no Hobby, 300s no Pro).
 *
 * Em local dev (não-Vercel), waitUntil é no-op e o microtask roda normal —
 * Node fica vivo segurando a Promise.
 */
/**
 * Janela após a qual um plano ainda em pending/generating é considerado
 * "preso" — a função serverless morreu (timeout, deploy, OOM) antes de
 * persistir o estado terminal. Com maxDuration=60s, qualquer plano nesse
 * estado por mais de 3 min é defesa-em-profundidade contra spinner
 * infinito.
 */
const STALE_PLAN_MS = 3 * 60 * 1000;

export type StalePlanInput = {
	id: string;
	status: string;
	updatedAt: Date | string | null;
};

/**
 * Watchdog: idempotente. Se o plano está pending/generating mas parado
 * há mais de STALE_PLAN_MS, marca como failed. O WHERE só atualiza se o
 * status ainda for pending/generating — evita corrida com uma geração
 * que acabou de concluir e o cliente leu cache antigo. Retorna o novo
 * estado se reconciliou, senão null.
 */
export async function failIfStale(
	plan: StalePlanInput
): Promise<{ status: 'failed'; errorMessage: string } | null> {
	if (plan.status !== 'pending' && plan.status !== 'generating') return null;
	const updatedMs = plan.updatedAt ? new Date(plan.updatedAt).getTime() : 0;
	if (Date.now() - updatedMs < STALE_PLAN_MS) return null;

	const errorMessage = 'Geração interrompida — tempo limite excedido. Tente gerar novamente.';
	await db
		.update(trainingPlans)
		.set({
			status: 'failed',
			progressPct: 0,
			progressPhase: 'erro',
			errorMessage,
			updatedAt: new Date()
		})
		.where(
			and(eq(trainingPlans.id, plan.id), inArray(trainingPlans.status, ['pending', 'generating']))
		);
	logger.warn({ planId: plan.id }, 'plan.stale.reconciled');
	return { status: 'failed', errorMessage };
}

export function generateTrainingPlanInBackground(opts: GenerateOptions): void {
	const promise = generateTrainingPlan(opts).catch((err) => {
		logger.error(
			{ err, planId: opts.planId, studentId: opts.studentId },
			'plan.generate.background.failed'
		);
	});
	try {
		waitUntil(promise);
	} catch {
		// Fora do contexto Vercel (ex: dev local): waitUntil lança.
		// Promise continua rodando normalmente porque Node não termina.
	}
}

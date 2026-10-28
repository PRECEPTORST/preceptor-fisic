/**
 * Engine de validação clínica do PreceptorFISIC.
 *
 * Roda APÓS a IA gerar o plano. Passa cada exercício/sessão pela bateria de
 * regras em `clinical_rules` e produz uma lista de violations que viram
 * `restrictions` no plano (com source.type === 'rule', distinguindo das
 * restrições que a própria IA inferiu).
 *
 * Algoritmo:
 *   1. Filtra regras aplicáveis ao perfil do aluno (condition_tags, age, cv_risk)
 *   2. Pra cada regra:
 *      a) forbid.exercise_patterns → regex contra exercise.name + execution_notes
 *      b) forbid.intensity_above   → parse load_guidance, compara contra threshold
 *      c) forbid.volume_above      → count sessions / max minutes
 *      d) require.monitoring       → check se plan.monitoring_parameters cobre
 *      e) require.medical_clearance → flag (já bloqueia publicação se red)
 *   3. Cada violation vira uma Restriction com source.rule_code + source.type='rule'
 */
import { eq, and, sql as sqlOp } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { clinicalRules, type Restriction, type RuleDSL } from '$lib/server/db/schema';
import type { TrainingPlanOutput, Exercise } from '$lib/schemas/training-plan';
import type { HealthProfile } from '$lib/server/db/schema';
import { logger } from '$lib/server/logger';

const CV_RISK_ORDER = ['baixo', 'moderado', 'alto', 'muito_alto'] as const;
type CvRisk = (typeof CV_RISK_ORDER)[number];

export type StudentCtx = {
	conditionTags: string[];
	age: number | null;
	cvRisk: CvRisk;
	/** Nomes dos medicamentos em uso. Ver `medications_any`. */
	medications: string[];
	/** Cirurgias do aluno com quantos meses fazem. Ver `months_since_surgery`. */
	surgeries: Array<{ procedure: string; monthsAgo: number }>;
};

export type ClinicalRuleRow = {
	code: string;
	title: string;
	description: string;
	severity: 'red' | 'yellow' | 'green';
	conditionTags: string[];
	ruleDsl: RuleDSL;
};

/* ────────── Filtro: regra aplicável a este aluno? ────────── */

/** Exportada pra teste: `validatePlan` precisa de DB, o filtro é puro. */
export function appliesTo(rule: ClinicalRuleRow, ctx: StudentCtx): boolean {
	const w = rule.ruleDsl.when ?? {};

	// As condition_tags da regra (coluna) definem A QUE condição ela se refere.
	// Isso escopa a regra SEMPRE — os filtros `when` (idade, risco CV) são
	// restrições ADICIONAIS, não substitutas. Antes, uma regra com tags +
	// um `when.age_gte` aplicava só pela idade, ignorando as tags → marcava
	// restrição de uma condição que o aluno nem tinha (falso positivo que
	// podia bloquear a publicação indevidamente).
	if (rule.conditionTags && rule.conditionTags.length > 0) {
		if (!rule.conditionTags.some((t) => ctx.conditionTags.includes(t))) return false;
	}

	// condition_tags_any → student tem AO MENOS uma
	if (w.condition_tags_any && w.condition_tags_any.length > 0) {
		if (!w.condition_tags_any.some((t) => ctx.conditionTags.includes(t))) return false;
	}

	// condition_tags_all → student tem TODAS
	if (w.condition_tags_all && w.condition_tags_all.length > 0) {
		if (!w.condition_tags_all.every((t) => ctx.conditionTags.includes(t))) return false;
	}

	// age range
	if (w.age_gte != null && (ctx.age == null || ctx.age < w.age_gte)) return false;
	if (w.age_lte != null && (ctx.age == null || ctx.age > w.age_lte)) return false;

	// medications_any → aluno usa AO MENOS um dos medicamentos
	if (w.medications_any && w.medications_any.length > 0) {
		const usa = w.medications_any.some((p) => {
			let re: RegExp;
			try {
				re = new RegExp(p, 'i');
			} catch {
				logger.warn({ rule: rule.code, pattern: p }, 'rule.medication_regex_invalid');
				return false;
			}
			return ctx.medications.some((m) => re.test(m));
		});
		if (!usa) return false;
	}

	// Fase pós-operatória. Sem data registrada, a regra vale só se NÃO exigir
	// tempo mínimo: aluno sem data fica na fase inicial, que é a mais
	// restritiva e também o comportamento anterior a esta regra existir.
	if (w.months_since_surgery) {
		const { procedure_matches, gte, lt } = w.months_since_surgery;
		let re: RegExp;
		try {
			re = new RegExp(procedure_matches, 'i');
		} catch {
			// Regex inválido na regra não pode derrubar a validação INTEIRA do
			// plano: trata como "não casou" e segue.
			logger.warn({ rule: rule.code, procedure_matches }, 'rule.surgery_regex_invalid');
			return false;
		}
		const meses = ctx.surgeries
			.filter((s) => re.test(s.procedure))
			.map((s) => s.monthsAgo)
			.sort((a, b) => a - b)[0];

		if (meses == null) {
			if (gte != null && gte > 0) return false;
		} else {
			if (gte != null && meses < gte) return false;
			if (lt != null && meses >= lt) return false;
		}
	}

	// cv_risk_min: student.cvRisk >= rule.cv_risk_min
	if (w.cv_risk_min) {
		const studentIdx = CV_RISK_ORDER.indexOf(ctx.cvRisk);
		const minIdx = CV_RISK_ORDER.indexOf(w.cv_risk_min);
		if (studentIdx < minIdx) return false;
	}

	return true;
}

/* ────────── Helpers de parsing de load_guidance ────────── */

function parseRpe(s: string | undefined): number | null {
	if (!s) return null;
	// "PSE 6-7" → 7 (max), "PSE 8" → 8. Aceita RPE também (planos legados antes
	// da troca de nomenclatura RPE→PSE e backfill).
	const m = s.match(/(?:RPE|PSE)\s*(\d+(?:[.,]\d+)?)\s*(?:[-–a]\s*(\d+(?:[.,]\d+)?))?/i);
	if (!m) return null;
	const high = m[2] ?? m[1];
	if (!high) return null;
	return Number(high.replace(',', '.'));
}

function parsePercent1RM(s: string | undefined): number | null {
	if (!s) return null;
	const m = s.match(/(\d+)\s*%\s*1RM/i);
	return m ? Number(m[1]) : null;
}

function parseHrPercentMax(s: string | undefined): number | null {
	if (!s) return null;
	// "FC 110-120 bpm" or "FC 60-70% máx" or "70% FC máx"
	const pct = s.match(/(\d+)\s*%/);
	if (pct && /FC|HR/i.test(s)) return Number(pct[1]);
	return null;
}

/**
 * A intensidade foi PRESCRITA por frequência cardíaca?
 *
 * Procura os marcadores que aparecem numa zona-alvo: bpm, batimentos, %FCmáx,
 * %FCR, FC de reserva, Karvonen. "FC" sozinho não conta, senão "monitorar FC"
 * num campo de intensidade viraria violação — e monitorar é justamente o que
 * continua permitido.
 */
const HR_PRESCRICAO =
	/\b\d+\s*(?:a|-|–|até)?\s*\d*\s*bpm\b|\bbatimentos?\b|\bkarvonen\b|\d\s*%\s*(?:d[ao]\s*)?fc|%\s*fc\s*(?:m[aá]x|r\b)|\bfc\s*(?:m[aá]x|de\s+reserva|reserva)\b|\bfc\s*[-–]?\s*alvo\b|\bzona\s+de\s+fc\b/i;

export function prescribedByHr(texto: string | undefined | null): boolean {
	return !!texto && HR_PRESCRICAO.test(texto);
}

/* ────────── Helpers de scan no plano ────────── */

function allExercises(plan: TrainingPlanOutput): { ex: Exercise; sessionLabel: string }[] {
	const out: { ex: Exercise; sessionLabel: string }[] = [];
	for (const s of plan.weekly_sessions ?? []) {
		const label = s.label ?? '?';
		for (const ex of s.warmup ?? []) out.push({ ex, sessionLabel: label });
		for (const ex of s.main ?? []) out.push({ ex, sessionLabel: label });
		for (const ex of s.cooldown ?? []) out.push({ ex, sessionLabel: label });
	}
	return out;
}

/**
 * Strip de acentos. Em JS regex, `\b` usa definição ASCII de `\w` mesmo
 * com flag `u`. Então "pivô" + " " não é word boundary porque `ô` não
 * é \w. Normalizando NFD + removendo combining marks, "pivô" vira
 * "pivo" e `\bpiv[oô]\b` (que vira `\bpivo\b` após strip) matcheia.
 */
function stripAccents(s: string): string {
	return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function matchesPatterns(ex: Exercise, patterns: string[]): boolean {
	// Match SÓ no nome + muscle_groups — evita false positive quando
	// a IA escreve "evitar Valsalva" em execution_notes como advisory.
	const haystackRaw = [ex.name, (ex.muscle_groups ?? []).join(' ')].join(' ').toLowerCase();
	const haystack = stripAccents(haystackRaw);
	return patterns.some((p) => {
		const pNorm = stripAccents(p);
		try {
			return new RegExp(pNorm, 'i').test(haystack);
		} catch {
			return haystack.includes(pNorm.toLowerCase());
		}
	});
}

/* ────────── Validador principal ────────── */

export type Violation = {
	ruleCode: string;
	ruleTitle: string;
	severity: 'red' | 'yellow' | 'green';
	description: string;
	affectedExercises: string[];
	violationType:
		| 'forbid_pattern'
		| 'forbid_intensity'
		| 'forbid_volume'
		| 'forbid_hr_prescription'
		| 'require_monitoring'
		| 'require_clearance';
	details?: string;
};

export async function validatePlan(
	plan: TrainingPlanOutput,
	ctx: StudentCtx
): Promise<Violation[]> {
	const rules = (await db
		.select({
			code: clinicalRules.code,
			title: clinicalRules.title,
			description: clinicalRules.description,
			severity: clinicalRules.severity,
			conditionTags: clinicalRules.conditionTags,
			ruleDsl: clinicalRules.ruleDsl
		})
		.from(clinicalRules)
		.where(eq(clinicalRules.active, true))) as ClinicalRuleRow[];

	const applicable = rules.filter((r) => appliesTo(r, ctx));
	const violations: Violation[] = [];

	const exercises = allExercises(plan);
	const monitoringText = (plan.monitoring_parameters ?? [])
		.map((m) => `${m.parameter ?? ''} ${m.frequency ?? ''} ${m.alert_threshold ?? ''}`)
		.join(' ')
		.toLowerCase();

	for (const rule of applicable) {
		const dsl = rule.ruleDsl;

		// 1) forbid.exercise_patterns
		if (dsl.forbid?.exercise_patterns?.length) {
			const matched = exercises.filter((row) =>
				matchesPatterns(row.ex, dsl.forbid!.exercise_patterns!)
			);
			if (matched.length > 0) {
				violations.push({
					ruleCode: rule.code,
					ruleTitle: rule.title,
					severity: rule.severity,
					description: rule.description,
					affectedExercises: Array.from(new Set(matched.map((m) => m.ex.name))),
					violationType: 'forbid_pattern',
					details: `${matched.length} exercício(s) violam padrões proibidos`
				});
			}
		}

		// 2) forbid.intensity_above
		if (dsl.forbid?.intensity_above) {
			const { metric, value } = dsl.forbid.intensity_above;
			const offenders: { ex: Exercise; observed: number }[] = [];
			for (const { ex } of exercises) {
				// A intensidade pode estar em load_guidance OU nos campos da ficha
				// (intensity/series_label). Os parsers exigem marcadores explícitos
				// (RPE, "% 1RM", "FC %"), então combinar os campos só amplia onde
				// procurar — sem risco de falso positivo.
				const intensityText = [ex.load_guidance, ex.intensity, ex.series_label]
					.filter(Boolean)
					.join(' ');
				const observed =
					metric === 'rpe'
						? parseRpe(intensityText)
						: metric === 'percent_1rm'
							? parsePercent1RM(intensityText)
							: parseHrPercentMax(intensityText);
				if (observed != null && observed > value) {
					offenders.push({ ex, observed });
				}
			}
			if (offenders.length > 0) {
				violations.push({
					ruleCode: rule.code,
					ruleTitle: rule.title,
					severity: rule.severity,
					description: rule.description,
					affectedExercises: Array.from(new Set(offenders.map((o) => o.ex.name))),
					violationType: 'forbid_intensity',
					details: `${metric} acima de ${value} em ${offenders.length} exercício(s)`
				});
			}
		}

		// 2b) forbid.intensity_prescribed_by_hr
		if (dsl.forbid?.intensity_prescribed_by_hr) {
			const culpados = exercises
				.filter(({ ex }) => [ex.load_guidance, ex.intensity].some((t) => prescribedByHr(t)))
				.map(({ ex }) => ex.name);

			// O aeróbio é onde a zona por FC mais aparece: a tabela do modelo tem
			// uma coluna "Intensidade" que costuma sair como "60-70%FCmáx (150-167bpm)".
			const aerobios = (plan.aerobic_prescriptions ?? [])
				.filter((a) => prescribedByHr(a.intensity))
				.map((a) => `Aeróbio: ${a.means}`);

			const todos = Array.from(new Set([...culpados, ...aerobios]));
			if (todos.length > 0) {
				violations.push({
					ruleCode: rule.code,
					ruleTitle: rule.title,
					severity: rule.severity,
					description: rule.description,
					affectedExercises: todos,
					violationType: 'forbid_hr_prescription',
					details: `${todos.length} item(ns) com intensidade prescrita por FC — reescrever em PSE ou teste da fala`
				});
			}
		}

		// 3) forbid.volume_above
		if (dsl.forbid?.volume_above) {
			const { metric, value } = dsl.forbid.volume_above;
			let observed = 0;
			if (metric === 'sessions_per_week') {
				observed = plan.weekly_sessions?.length ?? 0;
			} else if (metric === 'minutes_per_session') {
				observed = Math.max(0, ...(plan.weekly_sessions ?? []).map((s) => s.duration_minutes ?? 0));
			}
			if (observed > value) {
				violations.push({
					ruleCode: rule.code,
					ruleTitle: rule.title,
					severity: rule.severity,
					description: rule.description,
					affectedExercises: [],
					violationType: 'forbid_volume',
					details: `${metric} = ${observed} (máximo permitido: ${value})`
				});
			}
		}

		// 4) require.monitoring
		if (dsl.require?.monitoring?.length) {
			const missing = dsl.require.monitoring.filter(
				(m) => !monitoringText.includes(m.toLowerCase())
			);
			if (missing.length > 0) {
				violations.push({
					ruleCode: rule.code,
					ruleTitle: rule.title,
					severity: rule.severity,
					description: rule.description,
					affectedExercises: [],
					violationType: 'require_monitoring',
					details: `monitoramento ausente: ${missing.join(', ')}`
				});
			}
		}

		// 5) require.medical_clearance
		if (dsl.require?.medical_clearance) {
			// Não temos um flag "medical_clearance_obtained" no DB ainda — sempre flagga
			// como pendente quando a regra exige.
			violations.push({
				ruleCode: rule.code,
				ruleTitle: rule.title,
				severity: rule.severity,
				description: rule.description,
				affectedExercises: [],
				violationType: 'require_clearance',
				details: 'liberação médica obrigatória — registrar antes de publicar'
			});
		}
	}

	logger.info(
		{
			rules_total: rules.length,
			rules_applicable: applicable.length,
			violations: violations.length,
			by_severity: violations.reduce<Record<string, number>>((acc, v) => {
				acc[v.severity] = (acc[v.severity] ?? 0) + 1;
				return acc;
			}, {})
		},
		'clinical.validate.done'
	);

	return violations;
}

/* ────────── Convertendo violation → Restriction ────────── */

export function violationToRestriction(v: Violation): Restriction {
	const typeLabel: Record<Violation['violationType'], string> = {
		forbid_pattern: 'Exercício contraindicado',
		forbid_intensity: 'Intensidade acima do permitido',
		forbid_volume: 'Volume acima do permitido',
		forbid_hr_prescription: 'Intensidade prescrita por frequência cardíaca',
		require_monitoring: 'Monitoramento obrigatório ausente',
		require_clearance: 'Liberação médica obrigatória'
	};
	return {
		level: v.severity,
		title: `${v.ruleTitle} · ${typeLabel[v.violationType]}`,
		description: `${v.description}${v.details ? ` · ${v.details}` : ''}`,
		affected_exercises: v.affectedExercises,
		source: {
			type: 'rule',
			rule_code: v.ruleCode
		}
	};
}

/* ────────── Convenience: deriva ctx do health_profile + age ────────── */

export type DeriveCtxArgs = {
	conditionTags: string[];
	age: number | null;
	cvRisk: CvRisk;
};

const MES_MS = 30.44 * 24 * 60 * 60 * 1000;

/**
 * Cirurgias com quantos meses fazem. Entrada sem data ou com data ilegível é
 * DESCARTADA em vez de virar zero: zero significaria "operou hoje" e colocaria
 * o aluno na fase mais restritiva por engano. Quem não tem data cai no caminho
 * de `months_since_surgery` sem registro, que já é conservador.
 *
 * Data no futuro também é descartada: é erro de digitação, e meses negativos
 * fariam a comparação de fase mentir.
 */
export function surgeriesWithAge(
	health: HealthProfile | null
): Array<{ procedure: string; monthsAgo: number }> {
	const agora = Date.now();
	return (health?.surgeries ?? []).flatMap((s) => {
		if (!s?.procedure || !s.date) return [];
		const t = new Date(s.date).getTime();
		if (Number.isNaN(t) || t > agora) return [];
		return [{ procedure: s.procedure, monthsAgo: (agora - t) / MES_MS }];
	});
}

export function deriveStudentCtxFromHealth(
	conditionTags: string[],
	age: number | null,
	health: HealthProfile | null
): StudentCtx {
	return {
		conditionTags,
		age,
		cvRisk: (health?.cardiovascularRisk ?? 'baixo') as CvRisk,
		medications: (health?.medications ?? []).map((m) => m?.name).filter((n): n is string => !!n),
		surgeries: surgeriesWithAge(health)
	};
}

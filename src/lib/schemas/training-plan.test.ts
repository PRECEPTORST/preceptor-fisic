/**
 * Unit tests da remontagem da geração faseada.
 *
 * O contrato que importa: metadados + molduras + blocos de exercícios têm que
 * produzir um objeto que passa no `trainingPlanSchema` — é ele que decide se o
 * plano vai pra 'generated' ou pra "Geração falhou" na cara do profissional.
 * Pra rodar: `npm test`
 */
import { describe, it, expect } from 'vitest';
import {
	assemblePlan,
	programMetadataSchema,
	sessionExercisesSchema,
	trainingPlanSchema,
	type ProgramMetadata,
	type SessionExercises,
	type SessionOutline
} from './training-plan';

function makeExercise(name: string) {
	return {
		name,
		muscle_groups: ['peitoral'],
		sets: 3,
		reps: '8-10',
		load_guidance: 'PSE 6-7',
		rest_seconds: 60,
		execution_notes: 'Controle escapular.',
		contraindications: [],
		source_refs: [],
		intensity: '70% 1RM',
		cadence: '2/2',
		muscle_action: 'isotonica' as const,
		range_of_motion: 'Full',
		rest_label: '1min'
	};
}

function makeMetadata(): ProgramMetadata {
	return programMetadataSchema.parse({
		summary: 'x'.repeat(90),
		objective: 'Recomposição corporal com foco em segurança cardiovascular.',
		program_weeks: 12,
		progression_strategy: 'y'.repeat(130),
		aerobic_prescriptions: [],
		monitoring_parameters: [],
		assessment_protocols: [],
		restrictions: []
	});
}

function makeOutlines(days: Array<'seg' | 'qua' | 'sex'>): SessionOutline[] {
	return days.map((d, i) => ({
		label: `Treino ${String.fromCharCode(65 + i)}`,
		day_of_week: d,
		focus: 'Full body — peitoral, dorsal, quadríceps',
		duration_minutes: 60,
		main_exercise_count: 3
	}));
}

function makeSession(): SessionExercises {
	return sessionExercisesSchema.parse({
		warmup: [makeExercise('Mobilidade de ombro')],
		main: [
			makeExercise('Supino reto'),
			makeExercise('Remada curvada'),
			makeExercise('Agachamento')
		],
		cooldown: []
	});
}

describe('assemblePlan', () => {
	it('remonta metadados + molduras + sessões num plano que passa no schema', () => {
		const plan = trainingPlanSchema.parse(
			assemblePlan(makeMetadata(), makeOutlines(['seg', 'qua', 'sex']), [
				makeSession(),
				makeSession(),
				makeSession()
			])
		);

		expect(plan.weekly_sessions).toHaveLength(3);
		expect(plan.weekly_sessions.map((s) => s.day_of_week)).toEqual(['seg', 'qua', 'sex']);
		expect(plan.weekly_sessions[0]!.main).toHaveLength(3);
		expect(plan.objective).toContain('Recomposição');
		expect(plan.progression_strategy.length).toBeGreaterThanOrEqual(120);
	});

	it('descarta sessão que falhou e mantém o resto (plano parcial, não falha total)', () => {
		const plan = trainingPlanSchema.parse(
			assemblePlan(makeMetadata(), makeOutlines(['seg', 'qua', 'sex']), [
				makeSession(),
				null,
				makeSession()
			])
		);

		expect(plan.weekly_sessions).toHaveLength(2);
		// A sessão do meio caiu, então os dias restantes são os das pontas.
		expect(plan.weekly_sessions.map((s) => s.day_of_week)).toEqual(['seg', 'sex']);
	});

	it('mantém metadados do programa (monitoramento, restrições) vindos da fase 1b', () => {
		const metadata = programMetadataSchema.parse({
			...makeMetadata(),
			monitoring_parameters: [
				{ parameter: 'PA de repouso', frequency: 'antes de cada sessão', source_refs: [] }
			],
			restrictions: [
				{
					level: 'yellow',
					title: 'Hipertensão controlada',
					description: 'z'.repeat(30),
					affected_exercises: [],
					source: { type: 'inference', note: 'derivado do perfil clínico' }
				}
			]
		});
		const plan = trainingPlanSchema.parse(
			assemblePlan(metadata, makeOutlines(['seg']), [makeSession()])
		);

		expect(plan.monitoring_parameters).toHaveLength(1);
		expect(plan.restrictions[0]!.level).toBe('yellow');
	});

	it('leva observations da sessão quando a fase 2 mandar uma', () => {
		const withOwn = sessionExercisesSchema.parse({
			...makeSession(),
			observations: 'Parar ao sentir dor lombar.'
		});
		const plan = trainingPlanSchema.parse(
			assemblePlan(makeMetadata(), makeOutlines(['seg', 'qua']), [withOwn, makeSession()])
		);

		expect(plan.weekly_sessions[0]!.observations).toBe('Parar ao sentir dor lombar.');
		expect(plan.weekly_sessions[1]!.observations).toBeUndefined();
	});

	it('remontagem sem nenhuma sessão NÃO valida — o caller trata como falha', () => {
		const parsed = trainingPlanSchema.safeParse(
			assemblePlan(makeMetadata(), makeOutlines(['seg']), [null])
		);
		expect(parsed.success).toBe(false);
	});
});

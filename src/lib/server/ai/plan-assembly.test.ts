/**
 * Unit tests do buildOutlines — a moldura das sessões que o CÓDIGO monta a
 * partir da divisão semanal que a IA devolve.
 *
 * Esses invariantes eram da IA antes e falhavam na prática (dia repetido,
 * contagem de exercícios fora da faixa, sessão faltando). Agora são nossos,
 * então precisam de teste.
 * Pra rodar: `npm test`
 */
import { describe, it, expect } from 'vitest';
import {
	assemblePlan,
	buildManualPlanData,
	buildOutlines,
	buildSession,
	sessionsPreview
} from './plan-assembly';
import {
	programMetadataSchema,
	sessionExercisesSchema,
	sessionSchema,
	trainingPlanSchema,
	type DayOfWeek,
	type ProgramMetadata,
	type SessionExercises,
	type SessionOutline
} from '$lib/schemas/training-plan';

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

function makeOutlines(days: DayOfWeek[]): SessionOutline[] {
	return days.map((d, i) => ({
		label: `Treino ${String.fromCharCode(65 + i)}`,
		day_of_week: d,
		focus: 'Full body — peitoral, dorsal, quadríceps',
		duration_minutes: 60,
		main_exercise_count: 3
	}));
}

describe('buildOutlines', () => {
	it('gera o número de sessões que o aluno contratou, com dias únicos', () => {
		for (const n of [1, 2, 3, 4, 5, 6, 7]) {
			const outlines = buildOutlines(
				n,
				60,
				Array.from({ length: n }, (_, i) => `Foco ${i + 1}`)
			);
			expect(outlines).toHaveLength(n);
			expect(new Set(outlines.map((o) => o.day_of_week)).size).toBe(n);
		}
	});

	it('clampa a frequência na faixa 1–7 aceita pelo schema', () => {
		expect(buildOutlines(0, 60, ['A'])).toHaveLength(1);
		expect(buildOutlines(99, 60, ['A'])).toHaveLength(7);
	});

	it('repete o ciclo de focos quando a IA devolve menos que o pedido', () => {
		const outlines = buildOutlines(4, 60, ['Upper', 'Lower']);
		expect(outlines).toHaveLength(4);
		expect(outlines.map((o) => o.focus)).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
	});

	it('ignora focos sobrando quando a IA devolve mais que o pedido', () => {
		const outlines = buildOutlines(2, 60, ['A', 'B', 'C', 'D']);
		expect(outlines.map((o) => o.focus)).toEqual(['A', 'B']);
	});

	it('não deixa foco vazio virar sessão sem descrição', () => {
		const outlines = buildOutlines(2, 60, ['   ', '']);
		for (const o of outlines) expect(o.focus.length).toBeGreaterThan(3);
	});

	it('escala os exercícios do bloco principal pelo tempo de sessão, dentro de 3–8', () => {
		expect(buildOutlines(1, 30, ['A'])[0]!.main_exercise_count).toBe(3);
		expect(buildOutlines(1, 60, ['A'])[0]!.main_exercise_count).toBe(5);
		expect(buildOutlines(1, 90, ['A'])[0]!.main_exercise_count).toBe(8);
		// Sessão longuíssima não pode explodir o output da fase 2.
		expect(buildOutlines(1, 240, ['A'])[0]!.main_exercise_count).toBe(8);
	});

	it('rotula as sessões em sequência aproveitando o foco da IA', () => {
		const outlines = buildOutlines(2, 60, [
			'Full body A — peitoral, dorsal',
			'Full body B — pernas, core'
		]);
		expect(outlines[0]!.label).toBe('Treino A — Full body A');
		expect(outlines[1]!.label).toBe('Treino B — Full body B');
	});
});

describe('sessionsPreview', () => {
	it('mostra as molduras com blocos vazios antes de qualquer sessão fechar', () => {
		const preview = sessionsPreview(makeOutlines(['seg', 'qua'])) as {
			weekly_sessions: Array<{ day_of_week: string; main: unknown[] }>;
		};
		expect(preview.weekly_sessions).toHaveLength(2);
		expect(preview.weekly_sessions[0]!.main).toEqual([]);
	});

	it('preenche só as sessões já prontas, mantendo a posição das demais', () => {
		const preview = sessionsPreview(makeOutlines(['seg', 'qua', 'sex']), [
			null,
			makeSession(),
			null
		]) as { weekly_sessions: Array<{ main: unknown[] }> };
		expect(preview.weekly_sessions.map((s) => s.main.length)).toEqual([0, 3, 0]);
	});
});

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
	});

	it('descarta sessão que falhou e mantém o resto (plano parcial, não falha total)', () => {
		const plan = trainingPlanSchema.parse(
			assemblePlan(makeMetadata(), makeOutlines(['seg', 'qua', 'sex']), [
				makeSession(),
				null,
				makeSession()
			])
		);
		expect(plan.weekly_sessions.map((s) => s.day_of_week)).toEqual(['seg', 'sex']);
	});

	it('remontagem sem nenhuma sessão NÃO valida — o caller trata como falha', () => {
		const parsed = trainingPlanSchema.safeParse(
			assemblePlan(makeMetadata(), makeOutlines(['seg']), [null])
		);
		expect(parsed.success).toBe(false);
	});
});

describe('buildSession', () => {
	it('produz uma sessão que valida no sessionSchema — é o filtro do salvage', () => {
		// O generator usa isto pra descartar sessões inválidas e remontar o plano
		// com o que sobrou, em vez de perder a geração inteira.
		const outline = makeOutlines(['seg'])[0]!;
		expect(sessionSchema.safeParse(buildSession(outline, makeSession())).success).toBe(true);

		const semExercicios = { ...makeSession(), main: [] } as unknown as ReturnType<
			typeof makeSession
		>;
		expect(sessionSchema.safeParse(buildSession(outline, semExercicios)).success).toBe(false);
	});
});

describe('buildManualPlanData', () => {
	type Skeleton = {
		weekly_sessions: Array<{ day_of_week: string; warmup: unknown[]; main: unknown[]; cooldown: unknown[] }>;
		program_weeks: number;
		objective: string;
		restrictions: unknown[];
	};

	it('nasce com os blocos vazios e um dia distinto por sessão', () => {
		// O plano manual entra no MESMO editor do plano gerado, que indexa por
		// sessão e por bloco. Bloco faltando quebraria o addExercise.
		const p = buildManualPlanData({ sessions: 3, minutesPerSession: 60, focos: [] }) as Skeleton;
		expect(p.weekly_sessions).toHaveLength(3);
		for (const s of p.weekly_sessions) {
			expect(s.warmup).toEqual([]);
			expect(s.main).toEqual([]);
			expect(s.cooldown).toEqual([]);
		}
		expect(new Set(p.weekly_sessions.map((s) => s.day_of_week)).size).toBe(3);
	});

	it('respeita o teto de 7 sessões', () => {
		const p = buildManualPlanData({ sessions: 99, minutesPerSession: 60, focos: [] }) as Skeleton;
		expect(p.weekly_sessions).toHaveLength(7);
	});

	it('NÃO valida no trainingPlanSchema — é esqueleto, não plano pronto', () => {
		// Guarda contra alguém tentar publicar direto: summary e
		// progression_strategy nascem vazios e o schema exige texto.
		const p = buildManualPlanData({ sessions: 2, minutesPerSession: 60, focos: [] });
		expect(trainingPlanSchema.safeParse(p).success).toBe(false);
	});

	it('guarda objetivo e duração do programa', () => {
		const p = buildManualPlanData({
			sessions: 1,
			minutesPerSession: 45,
			focos: ['posterior de coxa'],
			objective: 'pós-operatório de LCA',
			programWeeks: 8
		}) as Skeleton;
		expect(p.objective).toBe('pós-operatório de LCA');
		expect(p.program_weeks).toBe(8);
		expect(p.restrictions).toEqual([]);
	});
});

/**
 * Montagem do plano — lógica PURA (sem DB, sem IA) entre a saída da IA e o
 * formato final: a moldura das sessões (`buildOutlines`), a prévia que a UI lê
 * durante a geração (`sessionsPreview`) e a remontagem validável
 * (`assemblePlan`). Fica fora do generator pra poder ser testada isoladamente.
 */
import type {
	DayOfWeek,
	ProgramMetadata,
	SessionExercises,
	SessionOutline
} from '$lib/schemas/training-plan';

// Distribuição semanal sugerida — spreading com pelo menos 1 dia de descanso
// entre treinos quando possível. Mesma tabela pra todos os splits
// (full-body/upper-lower/PPL); a IA pode desviar se for clinicamente melhor,
// mas o default cobre 95% dos casos. Honra a frequência real do aluno (1–7).
const DAY_DIST: Record<number, DayOfWeek[]> = {
	1: ['seg'],
	2: ['seg', 'qui'],
	3: ['seg', 'qua', 'sex'],
	4: ['seg', 'ter', 'qui', 'sex'],
	5: ['seg', 'ter', 'qua', 'qui', 'sex'],
	6: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
	7: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
};

export function suggestedDaysFor(n: number): string {
	return DAY_DIST[n]?.join(', ') ?? 'seg, qua, sex';
}

/** Rótulo de sessão no padrão da casa: "Treino A", "Treino B"... */
function sessionLabel(index: number, focus: string): string {
	const letter = String.fromCharCode(65 + (index % 26));
	// O foco costuma vir como "Full body A — peitoral, dorsal". Aproveita o
	// texto do modelo, mas garante o prefixo estável que a UI e o PDF esperam.
	const short = focus
		.split(/[—:\-]/)[0]!
		.trim()
		.slice(0, 120);
	return short.length >= 3 ? `Treino ${letter} — ${short}` : `Treino ${letter}`;
}

/**
 * Monta as molduras das sessões em CÓDIGO, a partir da divisão da fase 1a.
 *
 * Dia, rótulo, duração e nº de exercícios são determinísticos de propósito: são
 * os campos que dependem só das preferências do aluno, e tirá-los da IA elimina
 * as falhas que mais apareceram nos testes (dia repetido, contagem fora da
 * faixa, campo faltando). A IA continua decidendo o que importa clinicamente —
 * o foco e os grupamentos de cada dia, que vêm no texto de `session_focus`.
 */
export function buildOutlines(
	targetSessions: number,
	minutesPerSession: number,
	focos: string[]
): SessionOutline[] {
	const N = Math.max(1, Math.min(7, targetSessions));
	const days = DAY_DIST[N] ?? DAY_DIST[3]!;
	// ~10 min por exercício do bloco principal (séries + pausa), reservando
	// aquecimento e volta à calma. Clamp em 3..8 pra caber no schema e na hora.
	const mainCount = Math.max(3, Math.min(8, Math.round((minutesPerSession - 12) / 10)));

	// A IA pode devolver menos (ou mais) focos que o pedido: o número de sessões
	// é do aluno, não dela. Sobrando, corta; faltando, repete o ciclo — um plano
	// com foco repetido é melhor que um plano com menos dias que o contratado.
	return days.slice(0, N).map((day, i) => {
		const focus = (focos[i % Math.max(1, focos.length)] ?? '').trim() || 'Sessão full-body';
		return {
			label: sessionLabel(i, focus),
			day_of_week: day,
			focus: focus.slice(0, 300),
			duration_minutes: minutesPerSession,
			main_exercise_count: mainCount
		};
	});
}

/**
 * Prévia que a UI lê durante a geração: as molduras viradas em
 * `weekly_sessions`, com os exercícios das sessões que já fecharam e blocos
 * vazios nas que ainda estão rodando. É o que faz o plano se materializar na
 * tela sessão por sessão — a prévia usa optional chaining em
 * warmup/main/cooldown, então bloco vazio renderiza sem quebrar.
 *
 * Retorna `unknown`: é um plano PARCIAL de propósito, e a coluna `plan_data` é
 * jsonb sem tipo. Não confundir com `assemblePlan`, cujo retorno passa pelo
 * `trainingPlanSchema` antes de virar plano de verdade.
 */
export function sessionsPreview(
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

/**
 * Remonta metadados + molduras + blocos de exercícios no formato final.
 * `sessions[i]` corresponde a `outlines[i]`; `null` = aquela sessão falhou e é
 * DESCARTADA (plano parcial) em vez de derrubar o plano inteiro.
 *
 * Não valida — quem chama passa o resultado por `trainingPlanSchema`.
 */
export function buildSession(outline: SessionOutline, filled: SessionExercises): unknown {
	return {
		label: outline.label,
		day_of_week: outline.day_of_week,
		focus: outline.focus,
		duration_minutes: outline.duration_minutes,
		warmup: filled.warmup,
		main: filled.main,
		cooldown: filled.cooldown,
		observations: filled.observations
	};
}

export function assemblePlan(
	metadata: ProgramMetadata,
	outlines: SessionOutline[],
	sessions: Array<SessionExercises | null>
): unknown {
	const weekly_sessions = outlines
		.map((outline, i) => {
			const filled = sessions[i];
			return filled ? buildSession(outline, filled) : null;
		})
		.filter((s) => s !== null);

	return {
		summary: metadata.summary,
		objective: metadata.objective,
		program_weeks: metadata.program_weeks,
		progression_strategy: metadata.progression_strategy,
		weekly_sessions,
		aerobic_prescriptions: metadata.aerobic_prescriptions,
		monitoring_parameters: metadata.monitoring_parameters,
		assessment_protocols: metadata.assessment_protocols,
		restrictions: metadata.restrictions
	};
}

/**
 * Esqueleto de plano pra montagem MANUAL: as mesmas molduras de sessão que a
 * geração usa, com os blocos vazios pro profissional preencher no editor que
 * já existe na revisão do plano.
 *
 * Reaproveita `buildOutlines` de propósito. Dia da semana, rótulo e duração já
 * eram determinísticos na geração (não vinham da IA), então plano manual e
 * plano gerado nascem com a MESMA estrutura. É isso que faz o editor, a
 * validação clínica, a impressão e o app do aluno funcionarem nos dois sem
 * nenhum caso especial.
 *
 * Não valida contra `trainingPlanSchema`: o esqueleto é incompleto por
 * definição (summary e progression_strategy nascem vazios, e o schema exige 80
 * e 120 caracteres). Quem preenche é o profissional, no editor.
 */
export function buildManualPlanData(input: {
	sessions: number;
	minutesPerSession: number;
	focos: string[];
	objective?: string;
	programWeeks?: number;
}): unknown {
	const outlines = buildOutlines(input.sessions, input.minutesPerSession, input.focos);
	return {
		...(sessionsPreview(outlines) as object),
		summary: '',
		objective: input.objective?.slice(0, 800) ?? '',
		program_weeks: input.programWeeks ?? 12,
		progression_strategy: '',
		aerobic_prescriptions: [],
		monitoring_parameters: [],
		assessment_protocols: [],
		restrictions: []
	};
}

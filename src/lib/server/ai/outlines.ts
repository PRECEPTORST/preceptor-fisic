/**
 * Moldura das sessões — lógica PURA (sem DB, sem IA), extraída do generator pra
 * poder ser testada isoladamente.
 *
 * Dia, rótulo, duração e nº de exercícios do bloco principal saem daqui, não da
 * IA: são os campos que dependem só das preferências do aluno, e tirá-los do
 * modelo eliminou as falhas que mais apareceram nos testes (dia repetido,
 * contagem fora da faixa, sessão faltando). A IA decide o que é clínico — o
 * foco e os grupamentos de cada dia.
 */
import type { SessionOutline } from '$lib/schemas/training-plan';

// Distribuição semanal sugerida — spreading com pelo menos 1 dia de descanso
// entre treinos quando possível. Mesma tabela pra todos os splits
// (full-body/upper-lower/PPL); a IA pode desviar se for clinicamente melhor,
// mas o default cobre 95% dos casos. Honra a frequência real do aluno (1–7).
const DAY_DIST: Record<number, string[]> = {
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
	const minutes = minutesPerSession;
	const days = DAY_DIST[N] ?? DAY_DIST[3]!;
	// ~10 min por exercício do bloco principal (séries + pausa), reservando
	// aquecimento e volta à calma. Clamp em 3..8 pra caber no schema e na hora.
	const mainCount = Math.max(3, Math.min(8, Math.round((minutes - 12) / 10)));

	// A IA pode devolver menos (ou mais) focos que o pedido: o número de sessões
	// é do aluno, não dela. Sobrando, corta; faltando, repete o ciclo — um plano
	// com foco repetido é melhor que um plano com menos dias que o contratado.
	return days.slice(0, N).map((day, i) => {
		const focus = (focos[i % Math.max(1, focos.length)] ?? '').trim() || 'Sessão full-body';
		return {
			label: sessionLabel(i, focus),
			day_of_week: day as SessionOutline['day_of_week'],
			focus: focus.slice(0, 300),
			duration_minutes: minutes,
			main_exercise_count: mainCount
		};
	});
}

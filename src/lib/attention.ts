/**
 * Motor de "Precisa de atenção" — funções puras, sem DB.
 *
 * Recebe sinais já computados por aluno (aderência, dias sem treinar, PSE
 * recente, observação, ACWR) e devolve UM item de triagem por aluno: o motivo
 * mais grave. Alimenta a fila do dashboard e o realce na lista de alunos.
 *
 * Fecha o loop que hoje é cego: o aluno registra treino → esses sinais mudam
 * em silêncio. Aqui eles viram um card acionável ("Sumiu há 6 dias · abrir
 * ficha"). Espelha o estilo de `training-metrics.ts` (puro, testável).
 */
import type { AcwrLevel } from './training-metrics';

export type AttentionSeverity = 'alta' | 'media';

export type AttentionKind =
	| 'sem_treino'
	| 'pse_alto'
	| 'acwr_risco'
	| 'aderencia_baixa'
	| 'observacao'
	| 'sem_plano';

/** Sinais por aluno — montados no server a partir de StudentListItem + query. */
export type AttentionInput = {
	studentId: string;
	name: string;
	/** Plano publicado/gerado em vigor. false = pausado/sem plano. */
	planActive: boolean;
	/** Aderência 0–100 (sessões 7d ÷ meta semanal). */
	adherence: number;
	/** Sessões-alvo por semana (das preferências). null = não definido. */
	weeklyTarget: number | null;
	/** Dias desde a última sessão. null = nunca treinou. */
	daysSinceLast: number | null;
	/** Maior PSE (0–10) reportado nos últimos 7 dias. null = sem sessão. */
	maxRpe7d: number | null;
	/** Texto da observação recente mais recente, se houver. */
	lastObservation: string | null;
	/** Faixa de ACWR (risco de carga), se calculada. */
	acwrLevel?: AcwrLevel | null;
};

export type AttentionItem = {
	studentId: string;
	name: string;
	severity: AttentionSeverity;
	kind: AttentionKind;
	/** Frase curta do motivo — "Sumiu há 6 dias". */
	message: string;
	/** Contexto extra — o texto que o aluno escreveu, quando for `observacao`. */
	detail?: string;
	action: { label: string; href: string };
};

const PSE_ALTO = 9; // PSE 9–10: esforço quase-máximo, monitorar fadiga/deload.
const ADERENCIA_BAIXA = 60; // < 60% da meta semanal.

/**
 * Limiar de "sumiu": pelo menos 4 dias, ou 1.5× o intervalo esperado entre
 * treinos (meta 2x/sem → ~5 dias; meta 5x/sem → 4 dias). Evita alarme falso
 * pra quem treina pouca frequência por prescrição.
 */
function staleThreshold(weeklyTarget: number | null): number {
	const expectedGap = weeklyTarget && weeklyTarget > 0 ? 7 / weeklyTarget : 3;
	return Math.max(4, Math.round(expectedGap * 1.5));
}

/**
 * Classifica um aluno no motivo MAIS GRAVE (ou null se está tudo em dia).
 * Ordem de prioridade = ordem dos `if` abaixo.
 */
export function classifyAttention(input: AttentionInput): AttentionItem | null {
	const { studentId, name } = input;
	const ficha = { label: 'Abrir ficha', href: `/alunos/${studentId}` };
	const plano = { label: 'Ajustar plano', href: `/alunos/${studentId}` };

	// Sem plano ativo — nada a monitorar até prescrever. Média (não é urgência
	// clínica, mas é aluno parado sem entrega).
	if (!input.planActive) {
		return {
			studentId,
			name,
			severity: 'media',
			kind: 'sem_plano',
			message: 'Sem plano ativo',
			action: { label: 'Gerar plano', href: `/alunos/${studentId}/gerar` }
		};
	}

	// Sumiu — nunca treinou ou passou do limiar. Alta: risco de abandono.
	const threshold = staleThreshold(input.weeklyTarget);
	if (input.daysSinceLast === null) {
		return {
			studentId,
			name,
			severity: 'alta',
			kind: 'sem_treino',
			message: 'Ainda não treinou',
			action: ficha
		};
	}
	if (input.daysSinceLast >= threshold) {
		return {
			studentId,
			name,
			severity: 'alta',
			kind: 'sem_treino',
			message: `Sumiu há ${input.daysSinceLast} dias`,
			action: ficha
		};
	}

	// PSE quase-máximo — sinal de fadiga/sobrecarga. Alta.
	if (input.maxRpe7d !== null && input.maxRpe7d >= PSE_ALTO) {
		return {
			studentId,
			name,
			severity: 'alta',
			kind: 'pse_alto',
			message: `PSE ${input.maxRpe7d} reportado nesta semana`,
			action: plano
		};
	}

	// ACWR em atenção/alto risco — pico de carga. Alta.
	if (input.acwrLevel === 'atencao' || input.acwrLevel === 'alto_risco') {
		return {
			studentId,
			name,
			severity: 'alta',
			kind: 'acwr_risco',
			message:
				input.acwrLevel === 'alto_risco'
					? 'Carga em pico — risco de lesão'
					: 'Carga subindo rápido',
			action: plano
		};
	}

	// Aderência baixa — treinando menos que o prescrito. Média.
	if (input.adherence < ADERENCIA_BAIXA) {
		return {
			studentId,
			name,
			severity: 'media',
			kind: 'aderencia_baixa',
			message: `Aderência ${input.adherence}% esta semana`,
			action: plano
		};
	}

	// Deixou uma observação — pode conter algo clínico ("joelho doeu"). Média.
	if (input.lastObservation && input.lastObservation.trim()) {
		return {
			studentId,
			name,
			severity: 'media',
			kind: 'observacao',
			message: 'Deixou uma observação no treino',
			detail: input.lastObservation.trim(),
			action: ficha
		};
	}

	return null;
}

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { alta: 0, media: 1 };
const KIND_ORDER: Record<AttentionKind, number> = {
	sem_treino: 0,
	pse_alto: 1,
	acwr_risco: 2,
	aderencia_baixa: 3,
	observacao: 4,
	sem_plano: 5
};

/**
 * Classifica uma turma e devolve a fila ordenada (mais grave primeiro),
 * um item por aluno. Alunos em dia caem fora.
 */
export function buildAttentionQueue(inputs: AttentionInput[]): AttentionItem[] {
	return inputs
		.map(classifyAttention)
		.filter((i): i is AttentionItem => i !== null)
		.sort(
			(a, b) =>
				SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
				KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
				a.name.localeCompare(b.name)
		);
}

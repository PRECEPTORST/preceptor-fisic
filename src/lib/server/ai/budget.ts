/**
 * Orçamento de tempo da geração — lógica PURA, testável sem DB nem IA.
 *
 * A função serverless tem um teto duro (`maxDuration`, 300s no Pro). Se a
 * chamada de IA for morta pelo runtime, ninguém persiste o resultado e o plano
 * fica preso em 'generating' até o watchdog marcá-lo como falho — foi
 * exatamente o bug que originou este módulo. Então todo `abortSignal` sai
 * daqui: o que resta do teto, menos a reserva pra validar e persistir.
 */

/** Env mal digitada não pode virar NaN: `AbortSignal.timeout(NaN)` aborta na hora. */
export function envMs(raw: string | undefined, fallback: number): number {
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type GenBudget = {
	/** Teto da função — tem que casar com o maxDuration do adapter. */
	functionBudgetMs: number;
	/** Reserva pra validar + persistir (ou marcar failed) depois da IA responder. */
	postReserveMs: number;
	/** Abaixo disso não vale a pena chamar a IA: só queimaria a reserva. */
	minCallMs: number;
};

/**
 * Quanto a próxima chamada de IA ainda pode gastar, contado do início da
 * REQUEST. Retorna `0` quando não cabe mais nenhuma chamada — quem chama deve
 * falhar de imediato, com tempo de sobra pra persistir o erro.
 *
 * Nunca devolve um piso "de consolo": conceder 15s quando só restam 5 é
 * justamente o que estoura o teto e faz o runtime matar a função no meio do
 * catch.
 */
export function remainingGenBudgetMs(startMs: number, budget: GenBudget, now = Date.now()): number {
	const remaining = budget.functionBudgetMs - budget.postReserveMs - (now - startMs);
	return remaining >= budget.minCallMs ? remaining : 0;
}

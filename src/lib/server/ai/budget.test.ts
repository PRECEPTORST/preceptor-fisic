/**
 * Unit tests do orçamento de tempo.
 *
 * O bug que originou o módulo: a chamada de IA era abortada tarde demais, o
 * runtime matava a função no meio do catch e o plano ficava preso em
 * 'generating'. Estes testes travam a regra que impede isso.
 * Pra rodar: `npm test`
 */
import { describe, it, expect } from 'vitest';
import { envMs, remainingGenBudgetMs, type GenBudget } from './budget';

const BUDGET: GenBudget = { functionBudgetMs: 300_000, postReserveMs: 25_000, minCallMs: 15_000 };
const start = 1_000_000;

describe('envMs', () => {
	it('usa o valor da env quando é um número positivo', () => {
		expect(envMs('60000', 300_000)).toBe(60_000);
	});

	it('cai no default quando a env está ausente, vazia ou não é número', () => {
		// Sem isso, Number('abc') = NaN e AbortSignal.timeout(NaN) aborta na hora,
		// derrubando toda geração por uma variável mal digitada.
		for (const raw of [undefined, '', 'abc', '0', '-5', 'NaN', 'Infinity']) {
			expect(envMs(raw, 300_000)).toBe(300_000);
		}
	});
});

describe('remainingGenBudgetMs', () => {
	it('desconta o tempo já gasto desde o início da request', () => {
		expect(remainingGenBudgetMs(start, BUDGET, start + 30_000)).toBe(245_000);
	});

	it('preserva a reserva de pós-processamento', () => {
		// 300s de teto - 25s de reserva = 275s no melhor caso, nunca 300s.
		expect(remainingGenBudgetMs(start, BUDGET, start)).toBe(275_000);
	});

	it('devolve 0 quando o que sobra não paga uma chamada — sem piso de consolo', () => {
		// Este é o bug corrigido: o piso antigo (Math.max(15_000, …)) concedia
		// 15s ALÉM do teto, comendo a reserva e deixando a função morrer no meio
		// da persistência.
		expect(remainingGenBudgetMs(start, BUDGET, start + 270_000)).toBe(0);
		expect(remainingGenBudgetMs(start, BUDGET, start + 400_000)).toBe(0);
	});

	it('ainda autoriza a chamada quando sobra exatamente o mínimo', () => {
		expect(remainingGenBudgetMs(start, BUDGET, start + 260_000)).toBe(15_000);
	});

	it('respeita um teto menor (plano Hobby, 60s)', () => {
		const hobby: GenBudget = { functionBudgetMs: 60_000, postReserveMs: 25_000, minCallMs: 15_000 };
		expect(remainingGenBudgetMs(start, hobby, start)).toBe(35_000);
		expect(remainingGenBudgetMs(start, hobby, start + 30_000)).toBe(0);
	});
});

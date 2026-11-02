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
import { buildOutlines } from './outlines';

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

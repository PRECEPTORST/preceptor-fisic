/**
 * O caso real que originou isto: o resumo mandava começar entre 40% e 50% de
 * 1RM e os exercícios saíram com 50% a 60%.
 */
import { describe, it, expect } from 'vitest';
import { checarCoerencia, descreveIncoerencia, faixaPercent1RM, faixaPse } from './coerencia';

describe('faixaPercent1RM', () => {
	it.each([
		['iniciar entre 40% e 50% de 1RM', { min: 40, max: 50 }],
		['cargas de 40-50% 1RM', { min: 40, max: 50 }],
		['manter 70% de 1RM', { min: 70, max: 70 }],
		['começar em 40-50% e progredir até 70% de 1RM', { min: 40, max: 70 }]
	])('"%s"', (t, esperado) => {
		expect(faixaPercent1RM(t)).toEqual(esperado);
	});

	it('texto sem 1RM não vira faixa', () => {
		expect(faixaPercent1RM('progressão de 5% semanal na carga')).toBeNull();
		expect(faixaPercent1RM('Peso corporal')).toBeNull();
	});
});

describe('faixaPse', () => {
	it.each([
		['PSE 5-6', { min: 5, max: 6 }],
		['manter PSE 7', { min: 7, max: 7 }],
		['RPE 6-7', { min: 6, max: 7 }]
	])('"%s"', (t, esperado) => {
		expect(faixaPse(t)).toEqual(esperado);
	});
});

describe('checarCoerencia', () => {
	const ex = (nome: string, texto: string) => ({ nome, texto });

	it('o caso real: resumo 40-50% e exercícios a 50-60%', () => {
		const r = checarCoerencia('Iniciar entre 40% e 50% de 1RM, progredindo por tolerância.', [
			ex('Leg press', '50-60% 1RM'),
			ex('Remada sentada', '50-60% 1RM'),
			ex('Supino máquina', '45% 1RM')
		]);
		expect(r).toHaveLength(1);
		expect(r[0]!.metrica).toBe('% 1RM');
		expect(r[0]!.declarado).toEqual({ min: 40, max: 50 });
		// Só os dois que passam de 50. O de 45% está dentro.
		expect(r[0]!.exercicios.map((e) => e.nome)).toEqual(['Leg press', 'Remada sentada']);
	});

	it('progressão declarada no texto NÃO vira incoerência', () => {
		// "começar em 40-50 e progredir até 70" aceita qualquer coisa de 40 a 70.
		const r = checarCoerencia('Começar em 40-50% de 1RM e progredir até 70% de 1RM em 8 semanas.', [
			ex('Leg press', '60% 1RM'),
			ex('Agachamento', '70% 1RM')
		]);
		expect(r).toHaveLength(0);
	});

	it('plano coerente não acusa nada', () => {
		const r = checarCoerencia('Trabalhar entre 60% e 80% de 1RM, PSE 6-7.', [
			ex('Supino', '70% 1RM · PSE 6-7'),
			ex('Remada', '65% 1RM · PSE 7')
		]);
		expect(r).toHaveLength(0);
	});

	it('exercício sem a métrica é ignorado, não acusado', () => {
		const r = checarCoerencia('Trabalhar entre 60% e 80% de 1RM.', [
			ex('Prancha', 'Peso corporal, 30s isometria'),
			ex('Caminhada', 'PSE 4-5')
		]);
		expect(r).toHaveLength(0);
	});

	it('pega PSE fora da faixa declarada', () => {
		const r = checarCoerencia('Manter PSE 5-6 durante todo o bloco inicial.', [
			ex('Agachamento', 'PSE 8-9')
		]);
		expect(r).toHaveLength(1);
		expect(r[0]!.metrica).toBe('PSE');
	});

	it('acusa as duas métricas quando as duas divergem', () => {
		const r = checarCoerencia('Iniciar a 40-50% de 1RM, PSE 5-6.', [
			ex('Leg press', '70% 1RM · PSE 8')
		]);
		expect(r.map((x) => x.metrica).sort()).toEqual(['% 1RM', 'PSE']);
	});

	it('sem faixa declarada no texto, não há o que comparar', () => {
		const r = checarCoerencia('Plano de força para membros inferiores.', [
			ex('Leg press', '70% 1RM')
		]);
		expect(r).toHaveLength(0);
	});
});

describe('descreveIncoerencia', () => {
	it('diz a faixa, os exercícios e o que fazer', () => {
		const [i] = checarCoerencia('Iniciar entre 40% e 50% de 1RM.', [
			{ nome: 'Leg press', texto: '60% 1RM' }
		]);
		const txt = descreveIncoerencia(i!);
		expect(txt).toContain('40 a 50% de 1RM');
		expect(txt).toContain('Leg press (60%)');
		expect(txt).toContain('antes de publicar');
		// Cabe no min(20)/max(2500) do restrictionSchema.
		expect(txt.length).toBeGreaterThan(20);
		expect(txt.length).toBeLessThan(2500);
	});

	it('corta a lista quando há muitos exercícios', () => {
		const exs = Array.from({ length: 10 }, (_, n) => ({ nome: `Ex ${n}`, texto: '90% 1RM' }));
		const [i] = checarCoerencia('Iniciar entre 40% e 50% de 1RM.', exs);
		expect(descreveIncoerencia(i!)).toContain('e mais 4');
	});
});

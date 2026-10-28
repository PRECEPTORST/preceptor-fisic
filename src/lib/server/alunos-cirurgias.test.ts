/**
 * Parse do campo de cirurgias. A DATA é o que define a fase da reabilitação
 * nas regras clínicas, então errar aqui coloca o aluno na fase errada.
 */
import { describe, it, expect } from 'vitest';
import { parseCirurgias } from '../../../web/server/routes/alunos';

describe('parseCirurgias', () => {
	it('lê "procedimento em MM/AAAA"', () => {
		expect(parseCirurgias('reconstrução de LCA em 03/2026')).toEqual([
			{ procedure: 'reconstrução de LCA', date: '2026-03-01' }
		]);
	});

	it('lê sem a palavra "em" e com mês de um dígito', () => {
		expect(parseCirurgias('reparo de menisco 3/2026')).toEqual([
			{ procedure: 'reparo de menisco', date: '2026-03-01' }
		]);
	});

	it('lê data completa AAAA-MM-DD', () => {
		expect(parseCirurgias('LCA 2026-03-15')).toEqual([{ procedure: 'LCA', date: '2026-03-15' }]);
	});

	it('lê data entre parênteses', () => {
		expect(parseCirurgias('LCA (03/2026)')).toEqual([{ procedure: 'LCA', date: '2026-03-01' }]);
	});

	it('separa vários itens por vírgula', () => {
		expect(parseCirurgias('LCA em 03/2026, menisco em 05/2024')).toEqual([
			{ procedure: 'LCA', date: '2026-03-01' },
			{ procedure: 'menisco', date: '2024-05-01' }
		]);
	});

	it('sem data, grava sem data — o aluno fica na fase mais restritiva', () => {
		expect(parseCirurgias('reconstrução de LCA')).toEqual([{ procedure: 'reconstrução de LCA' }]);
	});

	it('mês inválido não vira data inventada', () => {
		expect(parseCirurgias('LCA em 13/2026')).toEqual([{ procedure: 'LCA' }]);
	});

	it('campo vazio não gera item', () => {
		expect(parseCirurgias('')).toEqual([]);
		expect(parseCirurgias('  ,  ')).toEqual([]);
	});

	it('data solta, sem procedimento, é descartada', () => {
		expect(parseCirurgias('03/2026')).toEqual([]);
	});
});

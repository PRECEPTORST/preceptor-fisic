/**
 * Derivação das duas condições cardíacas que entraram depois: reabilitação de
 * internado e pós-transplante.
 *
 * O guia de aeróbio dos doutores já prescrevia as duas e elas não existiam no
 * sistema: o aluno entrava sem tag, nenhuma regra disparava e o plano saía
 * como se ele não tivesse a condição.
 */
import { describe, it, expect } from 'vitest';
import { deriveTagsFromDiagnosisLabels } from './condition-tags';

const tags = (label: string) => deriveTagsFromDiagnosisLabels([label]);

describe('pós-transplante cardíaco', () => {
	it.each([
		'pós-transplante cardíaco',
		'Transplante cardíaco em 2024',
		'transplante de coração',
		'coração transplantado'
	])('reconhece "%s"', (l) => {
		expect(tags(l)).toContain('pos_transplante_cardiaco');
	});

	it('não confunde transplante de outro órgão', () => {
		expect(tags('transplante renal')).not.toContain('pos_transplante_cardiaco');
		expect(tags('transplante de fígado')).not.toContain('pos_transplante_cardiaco');
	});
});

describe('reabilitação cardíaca de internado', () => {
	it.each([
		'reabilitação cardíaca fase 1',
		'reabilitação cardíaca intra-hospitalar',
		'paciente internado pós-IAM',
		'hospitalizado após cirurgia cardíaca'
	])('reconhece "%s"', (l) => {
		expect(tags(l)).toContain('reabilitacao_cardiaca_internado');
	});

	it('reabilitação cardíaca ambulatorial NÃO é internado', () => {
		expect(tags('reabilitação cardíaca ambulatorial')).not.toContain(
			'reabilitacao_cardiaca_internado'
		);
		expect(tags('reabilitação cardíaca fase 2')).not.toContain('reabilitacao_cardiaca_internado');
	});

	it('o IAM continua marcando cardiopatia junto', () => {
		const t = tags('paciente internado pós-IAM');
		expect(t).toContain('cardiopatia_isquemica');
		expect(t).toContain('reabilitacao_cardiaca_internado');
	});
});

describe('transplantado e internado ao mesmo tempo', () => {
	it('recebe as duas tags, e a mais restritiva vale junto', () => {
		const t = deriveTagsFromDiagnosisLabels(['transplante cardíaco', 'internado']);
		expect(t).toContain('pos_transplante_cardiaco');
		expect(t).toContain('reabilitacao_cardiaca_internado');
	});
});

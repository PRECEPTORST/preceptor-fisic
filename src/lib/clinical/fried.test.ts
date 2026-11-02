/**
 * Classificação de fragilidade pelos critérios de Fried.
 *
 * O que isto protege: antes, fragilidade vinha do texto do diagnóstico, e a
 * derivação casava a palavra "idoso". Todo aluno de terceira idade entrava
 * como frágil e levava as restrições de quem não é.
 */
import { describe, it, expect } from 'vitest';
import {
	classificaFried,
	tagFragilidade,
	idadeEmAnos,
	deriveTagsFromDiagnosisLabels,
	CRITERIOS_FRIED,
	IDADE_MINIMA_FRIED
} from './condition-tags';

const marca = (...chaves: string[]) =>
	Object.fromEntries(CRITERIOS_FRIED.map((c) => [c.chave, chaves.includes(c.chave)]));

describe('classificaFried', () => {
	it('zero critério é robusto', () => {
		const c = classificaFried(marca())!;
		expect(c.classificacao).toBe('robusto');
		expect(c.tag).toBe('idoso_robusto');
		expect(c.presentes).toBe(0);
	});

	it('1 e 2 critérios são pré-frágil', () => {
		expect(classificaFried(marca('fraqueza'))!.tag).toBe('idoso_pre_fragil');
		expect(classificaFried(marca('fraqueza', 'exaustao'))!.tag).toBe('idoso_pre_fragil');
	});

	it('3, 4 e 5 critérios são frágil', () => {
		expect(classificaFried(marca('fraqueza', 'exaustao', 'perda_peso'))!.tag).toBe('idoso_fragil');
		expect(
			classificaFried(marca('fraqueza', 'exaustao', 'perda_peso', 'lentidao_marcha'))!.tag
		).toBe('idoso_fragil');
		expect(classificaFried(marca(...CRITERIOS_FRIED.map((c) => c.chave)))!.tag).toBe(
			'idoso_fragil'
		);
	});

	it('sem avaliação não classifica nada', () => {
		expect(classificaFried(null)).toBeNull();
		expect(classificaFried(undefined)).toBeNull();
	});

	it('o corte é exatamente 2 para 3', () => {
		for (let n = 0; n <= 5; n++) {
			const chaves = CRITERIOS_FRIED.slice(0, n).map((c) => c.chave);
			const c = classificaFried(marca(...chaves))!;
			const esperado = n === 0 ? 'robusto' : n <= 2 ? 'pre_fragil' : 'fragil';
			expect(c.classificacao, `${n} critérios`).toBe(esperado);
		}
	});
});

describe('tagFragilidade', () => {
	const fragil = marca('fraqueza', 'exaustao', 'perda_peso');

	it('vale a partir da idade mínima', () => {
		expect(tagFragilidade(fragil, IDADE_MINIMA_FRIED)).toBe('idoso_fragil');
		expect(tagFragilidade(fragil, 78)).toBe('idoso_fragil');
	});

	it('não vale abaixo dela: os critérios significam outra coisa num aluno jovem', () => {
		expect(tagFragilidade(fragil, IDADE_MINIMA_FRIED - 1)).toBeNull();
		expect(tagFragilidade(fragil, 30)).toBeNull();
	});

	it('sem idade registrada não classifica', () => {
		expect(tagFragilidade(fragil, null)).toBeNull();
		expect(tagFragilidade(fragil, undefined)).toBeNull();
	});

	it('idoso avaliado sem nenhum critério vira robusto, que antes nunca era preenchido', () => {
		expect(tagFragilidade(marca(), 72)).toBe('idoso_robusto');
	});
});

describe('derivação por label não decide mais fragilidade', () => {
	it('"idoso" sozinho não é mais frágil — era o bug', () => {
		expect(deriveTagsFromDiagnosisLabels(['idoso ativo'])).not.toContain('idoso_fragil');
	});

	it('o que o label afirma continua valendo', () => {
		expect(deriveTagsFromDiagnosisLabels(['idoso frágil'])).toContain('idoso_fragil');
		expect(deriveTagsFromDiagnosisLabels(['fragilidade'])).toContain('idoso_fragil');
	});

	it('sarcopenia vai pra tag própria, que a IDOSO-001 também cobre', () => {
		expect(deriveTagsFromDiagnosisLabels(['sarcopenia'])).toContain('sarcopenia');
	});
});

describe('idadeEmAnos', () => {
	it('conta anos completos', () => {
		const d = new Date();
		d.setFullYear(d.getFullYear() - 70);
		expect(idadeEmAnos(d.toISOString().slice(0, 10))).toBe(70);
	});

	it('data ausente ou ilegível devolve null em vez de zero', () => {
		expect(idadeEmAnos(null)).toBeNull();
		expect(idadeEmAnos('')).toBeNull();
		expect(idadeEmAnos('banana')).toBeNull();
	});
});

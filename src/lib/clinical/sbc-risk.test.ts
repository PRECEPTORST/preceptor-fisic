import { describe, it, expect } from 'vitest';
import {
	ergRiskPercent,
	sbcCategoryFromErg,
	sbcCategoryToLevel,
	stratifySbc,
	type ErgInput
} from './sbc-risk';

const male55: ErgInput = {
	sex: 'masculino',
	age: 55,
	totalCholesterol: 213,
	hdl: 50,
	systolicBp: 140,
	onBpMed: false,
	smoker: false,
	diabetes: false
};

describe('ergRiskPercent — Escore de Risco Global (Framingham 2008)', () => {
	it('caso de referência ♂55 CT213 HDL50 PAS140 → 13,53%', () => {
		expect(ergRiskPercent(male55)).toBeCloseTo(13.5, 1);
	});

	it('tabagismo e diabetes aumentam o risco', () => {
		const base = ergRiskPercent(male55);
		expect(ergRiskPercent({ ...male55, smoker: true })).toBeGreaterThan(base);
		expect(ergRiskPercent({ ...male55, diabetes: true })).toBeGreaterThan(base);
	});

	it('HDL mais alto reduz o risco', () => {
		expect(ergRiskPercent({ ...male55, hdl: 70 })).toBeLessThan(ergRiskPercent(male55));
	});

	it('anti-hipertensivo (mesma PAS) aumenta o risco vs não tratado', () => {
		const treated = ergRiskPercent({ ...male55, onBpMed: true });
		const untreated = ergRiskPercent({ ...male55, onBpMed: false });
		expect(treated).toBeGreaterThan(untreated);
	});

	it('mulher jovem saudável → risco baixo', () => {
		const r = ergRiskPercent({
			sex: 'feminino',
			age: 40,
			totalCholesterol: 180,
			hdl: 60,
			systolicBp: 115,
			onBpMed: false,
			smoker: false,
			diabetes: false
		});
		expect(r).toBeLessThan(5);
	});
});

describe('sbcCategoryFromErg — cortes por sexo', () => {
	it('<5% = baixo (ambos os sexos)', () => {
		expect(sbcCategoryFromErg(4.9, 'masculino')).toBe('baixo');
		expect(sbcCategoryFromErg(4.9, 'feminino')).toBe('baixo');
	});
	it('♂: 5–20% intermediário, >20% alto', () => {
		expect(sbcCategoryFromErg(15, 'masculino')).toBe('intermediario');
		expect(sbcCategoryFromErg(21, 'masculino')).toBe('alto');
	});
	it('♀: 5–10% intermediário, >10% alto', () => {
		expect(sbcCategoryFromErg(8, 'feminino')).toBe('intermediario');
		expect(sbcCategoryFromErg(12, 'feminino')).toBe('alto');
		// mesmo 12% que em homem seria intermediário, em mulher é alto
		expect(sbcCategoryFromErg(12, 'masculino')).toBe('intermediario');
	});
});

describe('sbcCategoryToLevel — mapa p/ enum do app', () => {
	it('intermediário vira moderado; os demais mantêm', () => {
		expect(sbcCategoryToLevel('baixo')).toBe('baixo');
		expect(sbcCategoryToLevel('intermediario')).toBe('moderado');
		expect(sbcCategoryToLevel('alto')).toBe('alto');
		expect(sbcCategoryToLevel('muito_alto')).toBe('muito_alto');
	});
});

describe('stratifySbc — reclassificadores diretos', () => {
	it('doença aterosclerótica estabelecida → muito alto, ignora escore', () => {
		const r = stratifySbc(male55, { establishedCvd: true });
		expect(r.level).toBe('muito_alto');
		expect(r.reclassified).toBe(true);
	});
	it('condição de alto risco → alto', () => {
		const r = stratifySbc(male55, { highRiskCondition: true });
		expect(r.level).toBe('alto');
		expect(r.reclassified).toBe(true);
	});
	it('sem reclassificador, usa o ERG', () => {
		const r = stratifySbc(male55);
		expect(r.reclassified).toBe(false);
		expect(r.riskPct).toBeCloseTo(13.5, 1);
		expect(r.category).toBe('intermediario');
		expect(r.level).toBe('moderado');
	});
	it('idade fora de 30–74 gera nota', () => {
		expect(stratifySbc({ ...male55, age: 80 }).notes.some((n) => /fora da faixa/.test(n))).toBe(
			true
		);
	});
});

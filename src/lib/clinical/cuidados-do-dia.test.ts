/**
 * Cuidados do dia no plano.
 *
 * O guia de HIV dos doutores lista febre, infecção ativa e dor torácica como
 * motivo de suspender a sessão, e nada disso é condição crônica: é como a
 * pessoa está hoje. O Jonas pediu que saísse como informação de cuidado no
 * plano, sem campo novo. Estes testes protegem a parte que não depende do
 * modelo: a garantia de que o critério está lá.
 */
import { describe, it, expect } from 'vitest';
import {
	cuidadosDoDia,
	garanteCuidadosDoDia,
	CUIDADOS_GERAIS,
	CUIDADOS_POR_TAG
} from './cuidados-do-dia';

type Mon = { parameter: string; frequency: string; alert_threshold?: string };

describe('cuidadosDoDia', () => {
	it('todo aluno recebe os sinais de alarme, mesmo sem diagnóstico', () => {
		const c = cuidadosDoDia(['populacao_geral']);
		expect(c.length).toBeGreaterThan(0);
		expect(c[0]!.alert_threshold).toMatch(/dor no peito/i);
	});

	it('HIV traz febre, infecção ativa e dor torácica, que é o caso que originou isto', () => {
		const texto = cuidadosDoDia(['hiv'])
			.map((c) => c.alert_threshold)
			.join(' ');
		expect(texto).toMatch(/febre/i);
		expect(texto).toMatch(/infecção oportunista ativa/i);
		expect(texto).toMatch(/dor tor[áa]cica/i);
	});

	it('diabetes descompensado traz o corte de cetona e o de 250 mg/dL', () => {
		const texto = cuidadosDoDia(['diabetes_descompensado'])
			.map((c) => c.alert_threshold)
			.join(' ');
		expect(texto).toMatch(/cetona/i);
		expect(texto).toMatch(/250 mg\/dL/);
	});

	it('DPOC traz o corte de SpO2', () => {
		expect(
			cuidadosDoDia(['dpoc_grave'])
				.map((c) => c.alert_threshold)
				.join(' ')
		).toMatch(/88%/);
	});

	it('não repete parâmetro quando o aluno tem várias condições da mesma família', () => {
		const c = cuidadosDoDia(['dpoc_leve', 'dpoc_moderada', 'dpoc_grave']);
		const nomes = c.map((x) => x.parameter.toLowerCase());
		expect(new Set(nomes).size).toBe(nomes.length);
	});

	it('soma os cuidados de condições diferentes', () => {
		const c = cuidadosDoDia(['hiv', 'diabetes_tipo_2']);
		const texto = c.map((x) => x.alert_threshold).join(' ');
		expect(texto).toMatch(/febre/i);
		expect(texto).toMatch(/100 mg\/dL/);
	});

	it('toda entrada tem fonte, porque citação sem documento é o que a gente está tirando do sistema', () => {
		const todos = [...CUIDADOS_GERAIS, ...Object.values(CUIDADOS_POR_TAG).flat()];
		for (const c of todos) {
			expect(c.fonte, c.parameter).toBeTruthy();
			expect(c.alert_threshold.length, c.parameter).toBeGreaterThan(20);
		}
	});
});

describe('garanteCuidadosDoDia', () => {
	it('injeta o que falta quando o plano vem sem monitoramento nenhum', () => {
		const out = garanteCuidadosDoDia<Mon>([], ['hiv']);
		expect(out.length).toBe(cuidadosDoDia(['hiv']).length);
	});

	it('não sobrescreve o que a IA escreveu com o mesmo nome', () => {
		const daIa: Mon = {
			parameter: 'Sinais de alarme durante a sessão',
			frequency: 'a cada série',
			alert_threshold: 'texto da IA'
		};
		const out = garanteCuidadosDoDia<Mon>([daIa], ['populacao_geral']);
		const igual = out.filter((m) => m.parameter === daIa.parameter);
		expect(igual).toHaveLength(1);
		expect(igual[0]!.alert_threshold).toBe('texto da IA');
	});

	it('preserva os parâmetros que a IA criou por conta dela', () => {
		const daIa: Mon = { parameter: 'Peso corporal', frequency: 'semanal' };
		const out = garanteCuidadosDoDia<Mon>([daIa], ['hiv']);
		expect(out.map((m) => m.parameter)).toContain('Peso corporal');
	});

	it('é idempotente: rodar duas vezes não duplica', () => {
		const uma = garanteCuidadosDoDia<Mon>([], ['hiv', 'dpoc_grave']);
		const duas = garanteCuidadosDoDia<Mon>(uma, ['hiv', 'dpoc_grave']);
		expect(duas.length).toBe(uma.length);
	});

	it('aguenta monitoramento nulo vindo do modelo', () => {
		expect(garanteCuidadosDoDia<Mon>(undefined as never, ['hiv']).length).toBeGreaterThan(0);
	});
});

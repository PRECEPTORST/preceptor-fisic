/**
 * Unit tests do CPF — validação, cifra e chave de unicidade.
 *
 * O hash é o que trava o segundo trial: se ele deixar de ser determinístico,
 * a trava some sem quebrar nada visível. Por isso tem teste.
 * Pra rodar: `npm test`
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
	normalizeCpfCnpj,
	hashCpf,
	encryptCpf,
	decryptCpf,
	formatCpfCnpj
} from './cpf';

// CPFs de teste com DV correto (números clássicos de fixture, não são de
// pessoas reais).
const CPF_OK = '52998224725';
const CPF_OK_2 = '11144477735';

beforeAll(() => {
	process.env.CPF_SECRET = 'segredo-de-teste-nao-usar-em-producao';
});

describe('normalizeCpfCnpj', () => {
	it('aceita CPF válido com ou sem máscara e devolve só dígitos', () => {
		expect(normalizeCpfCnpj('529.982.247-25')).toBe(CPF_OK);
		expect(normalizeCpfCnpj(CPF_OK)).toBe(CPF_OK);
	});

	it('recusa DV errado', () => {
		expect(normalizeCpfCnpj('52998224726')).toBeNull();
	});

	it('recusa dígitos repetidos — passam na conta do DV mas não existem', () => {
		expect(normalizeCpfCnpj('11111111111')).toBeNull();
		expect(normalizeCpfCnpj('00000000000')).toBeNull();
	});

	it('recusa tamanho errado e lixo', () => {
		expect(normalizeCpfCnpj('123')).toBeNull();
		expect(normalizeCpfCnpj('')).toBeNull();
		expect(normalizeCpfCnpj('abc')).toBeNull();
	});

	it('aceita CNPJ por formato — os DVs quem valida é o Asaas', () => {
		expect(normalizeCpfCnpj('11.222.333/0001-81')).toBe('11222333000181');
	});
});

describe('hashCpf', () => {
	it('é determinístico — é o que faz o UNIQUE do banco travar o 2º trial', () => {
		expect(hashCpf(CPF_OK)).toBe(hashCpf(CPF_OK));
	});

	it('separa CPFs diferentes', () => {
		expect(hashCpf(CPF_OK)).not.toBe(hashCpf(CPF_OK_2));
	});

	it('não devolve o CPF em claro', () => {
		expect(hashCpf(CPF_OK)).not.toContain(CPF_OK);
	});
});

describe('encryptCpf / decryptCpf', () => {
	it('vai e volta', () => {
		expect(decryptCpf(encryptCpf(CPF_OK))).toBe(CPF_OK);
	});

	it('mesmo CPF gera cifras diferentes (IV aleatório) — por isso o hash existe', () => {
		expect(encryptCpf(CPF_OK)).not.toBe(encryptCpf(CPF_OK));
	});

	it('não guarda o número em claro', () => {
		expect(encryptCpf(CPF_OK)).not.toContain(CPF_OK);
	});

	it('devolve null em dado corrompido em vez de explodir', () => {
		const bom = encryptCpf(CPF_OK);
		expect(decryptCpf(bom.slice(0, -4) + 'XXXX')).toBeNull();
		expect(decryptCpf('lixo')).toBeNull();
		expect(decryptCpf(null)).toBeNull();
		expect(decryptCpf('')).toBeNull();
	});
});

describe('formatCpfCnpj', () => {
	it('formata CPF e CNPJ', () => {
		expect(formatCpfCnpj(CPF_OK)).toBe('529.982.247-25');
		expect(formatCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
	});
});

/**
 * Unit tests do magic-link signer.
 * Mocka $env/dynamic/private pra rodar offline.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock do $env antes de importar o módulo
vi.mock('$env/dynamic/private', () => ({
	env: { SUPABASE_SERVICE_ROLE_KEY: 'a'.repeat(40) } // 40 chars > 32 do slice
}));

const { signStudentToken, verifyStudentToken } = await import('./aluno-token');

describe('signStudentToken', () => {
	it('produz token determinístico de 16 hex chars', () => {
		const t1 = signStudentToken('student-123');
		const t2 = signStudentToken('student-123');
		expect(t1).toBe(t2);
		expect(t1).toMatch(/^[a-f0-9]{16}$/);
	});

	it('produz tokens diferentes pra studentIds diferentes', () => {
		const a = signStudentToken('student-123');
		const b = signStudentToken('student-456');
		expect(a).not.toBe(b);
	});
});

describe('verifyStudentToken', () => {
	it('aceita token válido', () => {
		const id = 'abc-123';
		const token = signStudentToken(id);
		expect(verifyStudentToken(id, token)).toBe(true);
	});

	it('rejeita token vazio/null/undefined', () => {
		expect(verifyStudentToken('abc', null)).toBe(false);
		expect(verifyStudentToken('abc', undefined)).toBe(false);
		expect(verifyStudentToken('abc', '')).toBe(false);
	});

	it('rejeita token de outro studentId', () => {
		const tokenA = signStudentToken('student-A');
		expect(verifyStudentToken('student-B', tokenA)).toBe(false);
	});

	it('rejeita token de tamanho diferente', () => {
		const valid = signStudentToken('id');
		expect(verifyStudentToken('id', valid + 'x')).toBe(false);
		expect(verifyStudentToken('id', valid.slice(0, 10))).toBe(false);
	});

	it('é constant-time (sem early return)', () => {
		// Smoke test — apenas confirma que tokens com mesmo length retornam false
		// sem crashar (não testa timing real, mas garante o code path)
		const valid = signStudentToken('id');
		const same_length_wrong = '0'.repeat(16);
		expect(verifyStudentToken('id', same_length_wrong)).toBe(false);
	});
});

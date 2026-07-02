/**
 * Unit tests do motor de atenção — funções puras, sem DB.
 * Pra rodar: `npm test`
 */
import { describe, it, expect } from 'vitest';
import { classifyAttention, buildAttentionQueue, type AttentionInput } from './attention';

/** Base "aluno saudável em dia" — sobrescreva só o que o teste precisa. */
function base(over: Partial<AttentionInput> = {}): AttentionInput {
	return {
		studentId: 's1',
		name: 'Fulano',
		planActive: true,
		adherence: 100,
		weeklyTarget: 3,
		daysSinceLast: 1,
		maxRpe7d: 7,
		lastObservation: null,
		acwrLevel: 'otima',
		...over
	};
}

describe('classifyAttention', () => {
	it('aluno em dia → null (sai da fila)', () => {
		expect(classifyAttention(base())).toBeNull();
	});

	it('sem plano ativo → sem_plano (média), independente do resto', () => {
		const item = classifyAttention(base({ planActive: false, daysSinceLast: 30 }));
		expect(item?.kind).toBe('sem_plano');
		expect(item?.severity).toBe('media');
		expect(item?.action.href).toContain('/gerar');
	});

	it('nunca treinou com plano ativo → sem_treino alta', () => {
		const item = classifyAttention(base({ daysSinceLast: null }));
		expect(item?.kind).toBe('sem_treino');
		expect(item?.severity).toBe('alta');
		expect(item?.message).toMatch(/não treinou/i);
	});

	it('passou do limiar de dias → sem_treino com contagem', () => {
		const item = classifyAttention(base({ daysSinceLast: 6 }));
		expect(item?.kind).toBe('sem_treino');
		expect(item?.message).toContain('6');
	});

	it('limiar respeita frequência baixa (meta 2x → tolera ~5 dias)', () => {
		expect(classifyAttention(base({ weeklyTarget: 2, daysSinceLast: 4 }))).toBeNull();
		expect(classifyAttention(base({ weeklyTarget: 2, daysSinceLast: 5 }))?.kind).toBe('sem_treino');
	});

	it('PSE 9 → pse_alto alta', () => {
		const item = classifyAttention(base({ maxRpe7d: 9 }));
		expect(item?.kind).toBe('pse_alto');
		expect(item?.severity).toBe('alta');
	});

	it('ACWR alto_risco → acwr_risco alta', () => {
		const item = classifyAttention(base({ acwrLevel: 'alto_risco' }));
		expect(item?.kind).toBe('acwr_risco');
		expect(item?.severity).toBe('alta');
	});

	it('aderência < 60 → aderencia_baixa média', () => {
		const item = classifyAttention(base({ adherence: 33 }));
		expect(item?.kind).toBe('aderencia_baixa');
		expect(item?.message).toContain('33');
	});

	it('observação preenchida → observacao com detail', () => {
		const item = classifyAttention(base({ lastObservation: 'joelho doeu na 3ª série' }));
		expect(item?.kind).toBe('observacao');
		expect(item?.detail).toBe('joelho doeu na 3ª série');
	});

	it('prioridade: sumido vence observação', () => {
		const item = classifyAttention(base({ daysSinceLast: 9, lastObservation: 'algo' }));
		expect(item?.kind).toBe('sem_treino');
	});

	it('observação só de espaços é ignorada', () => {
		expect(classifyAttention(base({ lastObservation: '   ' }))).toBeNull();
	});
});

describe('buildAttentionQueue', () => {
	it('remove alunos em dia e ordena alta antes de média', () => {
		const queue = buildAttentionQueue([
			base({ studentId: 'ok', name: 'EmDia' }),
			base({ studentId: 'a', name: 'Aderencia', adherence: 20 }), // media
			base({ studentId: 'b', name: 'Sumido', daysSinceLast: 10 }) // alta
		]);
		expect(queue.map((q) => q.studentId)).toEqual(['b', 'a']);
	});
});

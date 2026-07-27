/**
 * Unit tests do resgate do envelope `parameters`.
 *
 * Os payloads aqui são a forma real que o Sonnet 5 devolveu nas medições — é
 * essa resposta que, sem o resgate, virava "Geração falhou" com o plano pronto
 * dentro dela.
 * Pra rodar: `npm test`
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { unwrapParametersEnvelope } from './structured';

const schema = z.object({
	summary: z.string().min(5),
	sessions: z.array(z.string()).default([])
});

describe('unwrapParametersEnvelope', () => {
	it('desembrulha quando parameters vem como objeto', () => {
		const text = JSON.stringify({ parameters: { summary: 'plano completo', sessions: ['seg'] } });
		expect(unwrapParametersEnvelope(text, schema)).toEqual({
			summary: 'plano completo',
			sessions: ['seg']
		});
	});

	it('desembrulha quando parameters vem como string JSON', () => {
		const text = JSON.stringify({
			parameters: JSON.stringify({ summary: 'plano completo', sessions: [] })
		});
		expect(unwrapParametersEnvelope(text, schema)?.summary).toBe('plano completo');
	});

	it('aplica os defaults do schema no objeto resgatado', () => {
		const text = JSON.stringify({ parameters: { summary: 'sem sessões' } });
		expect(unwrapParametersEnvelope(text, schema)?.sessions).toEqual([]);
	});

	it('devolve null quando não há envelope (erro legítimo, não mascarar)', () => {
		const text = JSON.stringify({ summary: 'x' });
		expect(unwrapParametersEnvelope(text, schema)).toBeNull();
	});

	it('devolve null quando o conteúdo do envelope é inválido pro schema', () => {
		const text = JSON.stringify({ parameters: { summary: 'no' } }); // min(5)
		expect(unwrapParametersEnvelope(text, schema)).toBeNull();
	});

	it('não estoura com texto vazio, não-JSON, array ou string solta', () => {
		expect(unwrapParametersEnvelope(undefined, schema)).toBeNull();
		expect(unwrapParametersEnvelope('', schema)).toBeNull();
		expect(unwrapParametersEnvelope('não é json', schema)).toBeNull();
		expect(unwrapParametersEnvelope('[1,2,3]', schema)).toBeNull();
		expect(
			unwrapParametersEnvelope(JSON.stringify({ parameters: 'texto solto' }), schema)
		).toBeNull();
	});
});

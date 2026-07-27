/**
 * Resgate de output estruturado quando o provider embrulha a tool call.
 *
 * Medido no Sonnet 5 + @ai-sdk/anthropic 3.0.100: em ~25% das chamadas o modelo
 * emite o input da tool aninhado em `parameters` — às vezes como objeto, às
 * vezes como string JSON — e o SDK levanta "response did not match schema"
 * mesmo com o conteúdo perfeito e completo. Descartar essas respostas custaria
 * uma geração inteira por capricho de serialização, então a gente desembrulha.
 *
 * Fica em módulo próprio (sem DB, sem IA) pra poder ser testado com os payloads
 * reais que capturamos.
 */
import type { z } from 'zod';

/**
 * Tenta extrair um objeto válido de um texto de resposta que falhou a
 * validação. Retorna `null` quando não é o caso do envelope — aí o erro
 * original é legítimo e quem chama deve tratá-lo.
 */
export function unwrapParametersEnvelope<T>(
	text: string | undefined,
	schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T | null {
	if (!text) return null;
	let outer: unknown;
	try {
		outer = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof outer !== 'object' || outer === null || Array.isArray(outer)) return null;

	const inner = (outer as Record<string, unknown>).parameters;
	if (inner === undefined) return null;

	let value: unknown = inner;
	if (typeof inner === 'string') {
		try {
			value = JSON.parse(inner);
		} catch {
			return null;
		}
	}

	const parsed = schema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

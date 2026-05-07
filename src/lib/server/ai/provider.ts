/**
 * Provider Google centralizado e lazy — instancia a cada chamada lendo
 * apiKey do $env/dynamic/private. Sem cache estático, porque HMR pode
 * trocar valores sem re-importar o módulo.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '$env/dynamic/private';

type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;

function instantiate(): GoogleProvider {
	const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY não configurado em .env.local');
	return createGoogleGenerativeAI({ apiKey });
}

const target = function placeholder() {} as unknown as GoogleProvider;

export const google: GoogleProvider = new Proxy(target, {
	get(_t, prop, receiver) {
		const fresh = instantiate();
		return Reflect.get(fresh, prop, receiver);
	},
	apply(_t, _thisArg, args) {
		const fresh = instantiate();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (fresh as unknown as (...a: unknown[]) => unknown).apply(fresh, args as any);
	}
}) as GoogleProvider;

/**
 * Rate limit baseado em IP + janela deslizante. Memória local por instância
 * (suficiente em Vercel serverless, dados resetam em deploy/cold start —
 * o que serve como anti-bruteforce básico).
 *
 * Pra produção pesada: trocar por Upstash Redis ou Vercel KV.
 *
 * Uso:
 *   const ok = checkRateLimit('login', ip, { max: 5, windowMs: 60000 });
 *   if (!ok.allowed) return fail(429, { error: ok.message });
 */
import { audit } from './audit';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const PRESETS = {
	login: { max: 5, windowMs: 60_000, label: 'login' },
	signup: { max: 3, windowMs: 600_000, label: 'criação de conta' },
	password_reset: { max: 3, windowMs: 600_000, label: 'recuperação de senha' },
	plan_generate: { max: 5, windowMs: 300_000, label: 'geração de plano' }
} as const;

export type RateLimitKey = keyof typeof PRESETS;

export function checkRateLimit(
	key: RateLimitKey,
	identifier: string
): { allowed: boolean; retryAfterMs?: number; message?: string } {
	const preset = PRESETS[key];
	const bucketKey = `${key}:${identifier}`;
	const now = Date.now();

	// Limpa buckets vencidos a cada chamada (não custa nada já que Map é pequeno)
	for (const [k, v] of buckets.entries()) {
		if (v.resetAt < now) buckets.delete(k);
	}

	const bucket = buckets.get(bucketKey);
	if (!bucket || bucket.resetAt < now) {
		buckets.set(bucketKey, { count: 1, resetAt: now + preset.windowMs });
		return { allowed: true };
	}

	bucket.count++;
	if (bucket.count > preset.max) {
		const retryAfterMs = bucket.resetAt - now;
		const minutes = Math.ceil(retryAfterMs / 60_000);
		return {
			allowed: false,
			retryAfterMs,
			message: `Muitas tentativas de ${preset.label}. Aguarde ${minutes} minuto${minutes > 1 ? 's' : ''} e tente de novo.`
		};
	}

	return { allowed: true };
}

/**
 * Atalho que extrai IP da request, audita o hit se passou do limite,
 * e retorna { allowed, message }.
 */
export async function checkAndAudit(opts: {
	key: RateLimitKey;
	request: Request;
	getClientAddress?: () => string;
	professionalId?: string | null;
}): Promise<{ allowed: boolean; message?: string }> {
	const ip =
		opts.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		opts.request.headers.get('x-real-ip') ??
		(opts.getClientAddress ? opts.getClientAddress() : 'unknown');

	const result = checkRateLimit(opts.key, ip);
	if (!result.allowed) {
		await audit({
			action: opts.key === 'plan_generate' ? 'plan.rate_limited' : 'auth.login',
			professionalId: opts.professionalId ?? null,
			entityType: 'rate_limit',
			payload: { key: opts.key, ip, retryAfterMs: result.retryAfterMs },
			ipAddress: ip,
			userAgent: opts.request.headers.get('user-agent')?.slice(0, 200) ?? null
		});
	}
	return { allowed: result.allowed, message: result.message };
}

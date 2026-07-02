/**
 * Magic-link tokens pro app do aluno.
 *
 * Geração: HMAC-SHA256(studentId, secret) truncado pra 24 hex chars.
 * Determinístico — mesma URL serve sempre, mas não dá pra adivinhar
 * sem o secret server-side.
 *
 * Secret = ALUNO_LINK_SECRET (dedicado, `openssl rand -hex 32`). Fallback:
 * SHA-256 da SUPABASE_SERVICE_ROLE_KEY completa — nunca um slice, pois o
 * prefixo de todo JWT do Supabase é um header público constante.
 */
import { createHmac, createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';

function getSecret(): string {
	const dedicated = env.ALUNO_LINK_SECRET ?? process.env.ALUNO_LINK_SECRET ?? '';
	if (dedicated) return dedicated;
	const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
	if (!key)
		throw new Error(
			'ALUNO_LINK_SECRET/SUPABASE_SERVICE_ROLE_KEY ausentes — sem secret pro magic-link'
		);
	return createHash('sha256').update(key).digest('hex');
}

export function signStudentToken(studentId: string): string {
	const secret = getSecret();
	return createHmac('sha256', secret).update(studentId).digest('hex').slice(0, 24);
}

export function verifyStudentToken(studentId: string, token: string | null | undefined): boolean {
	if (!token) return false;
	const expected = signStudentToken(studentId);
	// Constant-time comparison
	if (expected.length !== token.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
	}
	return diff === 0;
}

export function buildAlunoUrl(origin: string, studentId: string): string {
	const token = signStudentToken(studentId);
	return `${origin}/a/${studentId}?t=${token}`;
}

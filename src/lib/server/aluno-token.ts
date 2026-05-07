/**
 * Magic-link tokens pro app do aluno.
 *
 * Geração: HMAC-SHA256(studentId, secret) truncado pra 16 hex chars.
 * Determinístico — mesma URL serve sempre, mas não dá pra adivinhar
 * sem o secret server-side.
 *
 * Secret = primeiros 32 chars do SUPABASE_SERVICE_ROLE_KEY (não muda
 * frequentemente, único por projeto Supabase).
 */
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';

function getSecret(): string {
	const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
	if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — sem secret pro magic-link');
	return key.slice(0, 32);
}

export function signStudentToken(studentId: string): string {
	const secret = getSecret();
	return createHmac('sha256', secret).update(studentId).digest('hex').slice(0, 16);
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

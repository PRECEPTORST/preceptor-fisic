/**
 * Núcleo puro do link mágico do aluno: assinatura HMAC, comparação em tempo
 * constante e checagem contra a versão vigente do link. Sem `$env` nem banco
 * (o secret e a busca da versão entram por parâmetro), para poder ser testado
 * e reaproveitado fora do SvelteKit. aluno-token.ts é o invólucro com o secret
 * do ambiente e a consulta real; o comportamento é o mesmo de antes.
 */
import { createHmac } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** payload = studentId (v1, compatível com links antigos) ou `${id}.v${n}`. 24 hex. */
export function signWithSecret(secret: string, studentId: string, version = 1): string {
	const payload = version <= 1 ? studentId : `${studentId}.v${version}`;
	return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 24);
}

export function verifyWithSecret(
	secret: string,
	studentId: string,
	token: string | null | undefined,
	version = 1
): boolean {
	if (!token) return false;
	const expected = signWithSecret(secret, studentId, version);
	// Comparação em tempo constante
	if (expected.length !== token.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
	}
	return diff === 0;
}

/**
 * Valida o token contra a versão vigente do link. Aluno inexistente ou id
 * malformado → false, sem vazar o motivo.
 */
export async function checkStudentAccess(
	studentId: string,
	token: string | null | undefined,
	currentVersion: (studentId: string) => Promise<number | null | undefined>,
	verify: (studentId: string, token: string, version: number) => boolean
): Promise<boolean> {
	if (!token) return false;
	if (!UUID.test(studentId)) return false;
	const version = await currentVersion(studentId);
	if (version == null) return false;
	return verify(studentId, token, version);
}

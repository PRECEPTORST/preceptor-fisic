/**
 * CPF/CNPJ: validação, cifra e chave de unicidade.
 *
 * Por que guardar. O CPF é pedido no cadastro por dois motivos: travar um
 * trial por pessoa e não precisar pedir de novo na hora de pagar (o Asaas
 * exige `cpfCnpj` pra criar o cliente, e pedir isso no checkout é onde mais
 * atrapalha).
 *
 * Como guardar. Duas colunas, com propósitos diferentes:
 *
 *   - `cpf_encrypted`: AES-256-GCM, reversível, pra mandar ao Asaas depois.
 *   - `cpf_hash`: HMAC-SHA256, irreversível, com UNIQUE no banco. É o que
 *     responde "esse CPF já usou trial?" sem precisar decifrar nada.
 *
 * O hash é separado de propósito: a cifra do GCM tem IV aleatório, então o
 * mesmo CPF gera textos cifrados diferentes e não serve pra comparação.
 *
 * O que a validação prova. Só que o número é bem formado. Dígito verificador
 * não diz que o CPF existe nem que é da pessoa, e gerador de CPF válido é
 * trivial de achar. A trava aqui é de unicidade, não de identidade: serve pra
 * cortar o segundo trial casual, não quem está determinado a burlar.
 *
 * Segredo: CPF_SECRET (`openssl rand -hex 32`). Mesmo padrão de fallback do
 * aluno-token.ts — SHA-256 da service role key inteira, nunca um slice, já que
 * o prefixo de todo JWT do Supabase é header público constante.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

function secretMaterial(): string {
	const dedicated = env.CPF_SECRET ?? process.env.CPF_SECRET ?? '';
	if (dedicated) return dedicated;
	const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
	if (!key) throw new Error('CPF_SECRET/SUPABASE_SERVICE_ROLE_KEY ausentes — sem segredo pro CPF');
	return createHash('sha256').update(key).digest('hex');
}

/** Chave de 32 bytes pro AES-256, derivada do segredo com rótulo próprio. */
function encryptionKey(): Buffer {
	return createHash('sha256').update(`cpf-aes:${secretMaterial()}`).digest();
}

/**
 * Só dígitos, validando DV do CPF. CNPJ passa por formato (14 dígitos): quem
 * valida os dígitos dele é o Asaas, que é quem recusa a cobrança.
 * Retorna null quando inválido.
 */
export function normalizeCpfCnpj(raw: string): string | null {
	const d = (raw ?? '').replace(/\D/g, '');
	if (d.length === 14) return d;
	if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
	const dv = (slice: number) => {
		let sum = 0;
		for (let i = 0; i < slice; i++) sum += Number(d[i]) * (slice + 1 - i);
		const r = (sum * 10) % 11;
		return r === 10 ? 0 : r;
	};
	return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
}

/**
 * Chave de unicidade. Determinística de propósito: é ela que o UNIQUE do banco
 * usa pra impedir dois trials com o mesmo CPF.
 */
export function hashCpf(digits: string): string {
	return createHmac('sha256', secretMaterial()).update(`cpf:${digits}`).digest('hex');
}

/** `iv:tag:ciphertext`, tudo em base64. */
export function encryptCpf(digits: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
	const enc = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()]);
	return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

/** Devolve null se o dado estiver corrompido ou cifrado com outro segredo. */
export function decryptCpf(stored: string | null | undefined): string | null {
	if (!stored) return null;
	const [ivB64, tagB64, dataB64] = stored.split(':');
	if (!ivB64 || !tagB64 || !dataB64) return null;
	try {
		const decipher = createDecipheriv(
			'aes-256-gcm',
			encryptionKey(),
			Buffer.from(ivB64, 'base64')
		);
		decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
		return Buffer.concat([
			decipher.update(Buffer.from(dataB64, 'base64')),
			decipher.final()
		]).toString('utf8');
	} catch {
		return null;
	}
}

/** "123.456.789-01" — só pra exibir de volta pra própria pessoa. */
export function formatCpfCnpj(digits: string): string {
	if (digits.length === 11)
		return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
	if (digits.length === 14)
		return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
	return digits;
}

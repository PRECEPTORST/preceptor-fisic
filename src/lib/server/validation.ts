/**
 * Validações compartilhadas de input do servidor.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True se `value` é um UUID válido. Usado pra blindar queries contra ids
 * malformados vindos da URL (bots/links quebrados): sem isso, o Postgres
 * lança `invalid input syntax for type uuid` e a rota inteira retorna 500
 * ao invés de um 404 amigável.
 */
export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Converte input livre num número inteiro saneado dentro de [min, max].
 * Retorna `fallback` se o valor não for numérico (NaN/Infinity) — evita
 * que NaN chegue a colunas integer NOT NULL (erro de Postgres → 500).
 */
export function toIntInRange(
	value: unknown,
	{ min, max, fallback }: { min: number; max: number; fallback: number }
): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Parse defensivo de data. Retorna `null` se a string for vazia ou não
 * resultar numa data válida — assim Invalid Date nunca chega ao driver
 * (que lança RangeError ao serializar → 500).
 */
export function parseDateOrNull(value: unknown): Date | null {
	if (value == null || value === '') return null;
	const d = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(d.getTime()) ? null : d;
}

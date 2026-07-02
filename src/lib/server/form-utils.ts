/**
 * Parse defensivo de campos de form (server-side).
 *
 * Regras BR: vírgula decimal ("72,5" → 72.5), data em dd/mm/aaaa ou ISO.
 * Nunca retornar NaN/Invalid Date — sempre `null` quando inválido, pra
 * action decidir entre fail(400) e ignorar o campo.
 */

/** "72,5" | "72.5" | " 72 " → 72.5; vazio/inválido → null. */
export function parseDecimalBR(v: FormDataEntryValue | null | undefined): number | null {
	if (v == null) return null;
	const s = String(v).trim().replace(/\s/g, '');
	if (!s) return null;
	// aceita "1.234,56" (milhar com ponto) e "1234,56" e "1234.56"
	const normalized = /,\d{1,}$/.test(s)
		? s.replace(/\./g, '').replace(',', '.')
		: s.replace(',', '.');
	const n = Number(normalized);
	return Number.isFinite(n) ? n : null;
}

/** Inteiro seguro; vazio/inválido → null. */
export function parseIntSafe(v: FormDataEntryValue | null | undefined): number | null {
	const n = parseDecimalBR(v);
	if (n == null) return null;
	return Number.isInteger(n) ? n : Math.round(n);
}

/** Clampa em [min,max]; null passa direto. */
export function clamp(n: number | null, min: number, max: number): number | null {
	if (n == null) return null;
	return Math.min(max, Math.max(min, n));
}

/**
 * Data de form: aceita "yyyy-mm-dd" (input date) e "dd/mm/aaaa" (digitada).
 * Retorna "yyyy-mm-dd" validado (existe no calendário) ou null.
 */
export function parseDateISO(v: FormDataEntryValue | null | undefined): string | null {
	if (v == null) return null;
	const s = String(v).trim();
	if (!s) return null;
	let y: number, m: number, d: number;
	let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	} else {
		match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
		if (!match) return null;
		[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
	}
	if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
	const dt = new Date(Date.UTC(y, m - 1, d));
	if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** String de form aparada e limitada; vazio → null. */
export function parseText(v: FormDataEntryValue | null | undefined, maxLen: number): string | null {
	if (v == null) return null;
	const s = String(v).trim().slice(0, maxLen);
	return s || null;
}

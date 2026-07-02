/**
 * Timezone do produto: America/Sao_Paulo.
 *
 * O server (Vercel) roda em UTC. Todo parse de datetime-local vindo de form
 * e todo bucket de dia/semana em agregação PRECISA passar por aqui — usar
 * `new Date('YYYY-MM-DDTHH:mm')` no server interpreta o horário como UTC e
 * desloca tudo em 3h (bugs C11/C14/C29 da auditoria de lançamento).
 */

export const APP_TZ = 'America/Sao_Paulo';

/** Offset (ms) do fuso APP_TZ em relação ao UTC num dado instante. */
function tzOffsetMs(at: Date): number {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone: APP_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
	const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
	const asUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour === '24' ? '00' : parts.hour),
		Number(parts.minute),
		Number(parts.second)
	);
	return asUtc - at.getTime();
}

/**
 * Interpreta uma string de <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
 * ou de <input type="date"> ("YYYY-MM-DD", assume 00:00) como horário de
 * Brasília e devolve o Date (instante UTC) correspondente.
 * Retorna null se a string for inválida.
 */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
	if (!value) return null;
	const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
	if (!m) return null;
	const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
	// Chute inicial: trata como UTC, depois corrige pelo offset do fuso
	// naquele instante (funciona inclusive na virada de horário de verão,
	// com no máximo 1 iteração de refinamento).
	let guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
	for (let i = 0; i < 2; i++) {
		const off = tzOffsetMs(new Date(guess));
		const corrected =
			Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)) - off;
		if (corrected === guess) break;
		guess = corrected;
	}
	const dt = new Date(guess);
	return isNaN(dt.getTime()) ? null : dt;
}

/** "YYYY-MM-DD" do instante `at` no fuso de Brasília (pra bucket de dia). */
export function localDateKey(at: Date): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: APP_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(at);
}

/** Componentes locais (Brasília) de um instante — pra montar grids/agregações. */
export function localParts(at: Date): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: number;
} {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone: APP_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short',
		hour12: false
	});
	const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
	const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour === '24' ? '00' : parts.hour),
		minute: Number(parts.minute),
		weekday: WD[parts.weekday ?? ''] ?? 0
	};
}

/** Início do dia (00:00 de Brasília) que contém `at`, como instante UTC. */
export function startOfLocalDay(at: Date): Date {
	const key = localDateKey(at);
	return parseLocalDateTime(key) ?? at;
}

/**
 * Início da semana local (segunda 00:00 de Brasília) que contém `at`.
 * Segunda-feira como início — padrão de treino semanal do produto.
 */
export function startOfLocalWeek(at: Date): Date {
	const day = startOfLocalDay(at);
	const wd = localParts(day).weekday; // 0=dom ... 6=sáb
	const back = (wd + 6) % 7; // dom→6, seg→0, ter→1...
	return new Date(day.getTime() - back * 86_400_000);
}

/** Formata um instante como data/hora de Brasília (dd/mm/aaaa hh:mm). */
export function formatLocal(at: Date, opts?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TZ, ...opts }).format(at);
}

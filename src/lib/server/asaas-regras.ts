/**
 * Regras puras do webhook Asaas. Sem I/O, para testar cada combinação de
 * evento × cobrança × estado da conta.
 */

export const GRACE_DAYS = 5;

export const ACTIVATE = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
export const PAST_DUE = new Set(['PAYMENT_OVERDUE']);
export const CANCEL = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED']);

export type Cobranca = 'ebook' | 'plano' | 'outra';

export type Decisao =
	| { tipo: 'ignorar'; motivo?: string }
	| { tipo: 'ebook' }
	| { tipo: 'ativar' }
	| { tipo: 'rebaixar' }
	| { tipo: 'cancelar' };

/** O que fazer com o evento antes de saber de qual conta ele é. */
export function decidirPorEvento(event: string, cobranca: Cobranca): Decisao {
	const relevante = ACTIVATE.has(event) || PAST_DUE.has(event) || CANCEL.has(event);
	if (!relevante) return { tipo: 'ignorar' };
	// Ebook nunca mexe em assinatura: nem estorno, nem atraso.
	if (cobranca === 'ebook') {
		return ACTIVATE.has(event) ? { tipo: 'ebook' } : { tipo: 'ignorar', motivo: `ebook ${event} — sem efeito na assinatura` };
	}
	if (cobranca === 'outra') return { tipo: 'ignorar', motivo: 'pagamento não mapeado a plano' };
	if (ACTIVATE.has(event)) return { tipo: 'ativar' };
	if (PAST_DUE.has(event)) return { tipo: 'rebaixar' };
	return { tipo: 'cancelar' };
}

/**
 * Evento negativo de uma assinatura que não é a vigente na conta é resíduo
 * (cobrança antiga ou assinatura duplicada já trocada): não derruba quem pagou.
 */
export function eventoDeOutraAssinatura(
	pagamentoSubscription: string | null | undefined,
	contaSubscription: string | null | undefined
): boolean {
	return Boolean(pagamentoSubscription && contaSubscription && pagamentoSubscription !== contaSubscription);
}

/**
 * Nova expiração ao renovar. Conta a partir da expiração vigente (sem a
 * carência) quando ela ainda está no futuro: quem paga adiantado não perde dias.
 */
export function novaExpiracao(agora: Date, expiracaoAtual: Date | null, meses: number): Date {
	let base = new Date(agora);
	if (expiracaoAtual) {
		const semCarencia = new Date(expiracaoAtual);
		semCarencia.setDate(semCarencia.getDate() - GRACE_DAYS);
		if (semCarencia > base) base = semCarencia;
	}
	base.setMonth(base.getMonth() + meses);
	base.setDate(base.getDate() + GRACE_DAYS);
	return base;
}

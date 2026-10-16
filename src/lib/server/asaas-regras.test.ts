import { describe, expect, it } from 'vitest';
import { decidirPorEvento, eventoDeOutraAssinatura, novaExpiracao } from './asaas-regras';

describe('decidirPorEvento', () => {
	it('estorno do ebook não cancela assinatura', () => {
		expect(decidirPorEvento('PAYMENT_REFUNDED', 'ebook').tipo).toBe('ignorar');
		expect(decidirPorEvento('PAYMENT_CHARGEBACK_REQUESTED', 'ebook').tipo).toBe('ignorar');
	});
	it('atraso do ebook não rebaixa assinatura', () => {
		expect(decidirPorEvento('PAYMENT_OVERDUE', 'ebook').tipo).toBe('ignorar');
	});
	it('ebook pago dispara entrega', () => {
		expect(decidirPorEvento('PAYMENT_RECEIVED', 'ebook').tipo).toBe('ebook');
	});
	it('cobrança fora do catálogo não mexe em nada, em nenhum evento', () => {
		for (const e of ['PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED']) {
			expect(decidirPorEvento(e, 'outra').tipo).toBe('ignorar');
		}
	});
	it('plano segue o evento', () => {
		expect(decidirPorEvento('PAYMENT_CONFIRMED', 'plano').tipo).toBe('ativar');
		expect(decidirPorEvento('PAYMENT_OVERDUE', 'plano').tipo).toBe('rebaixar');
		expect(decidirPorEvento('PAYMENT_REFUNDED', 'plano').tipo).toBe('cancelar');
		expect(decidirPorEvento('PAYMENT_CREATED', 'plano').tipo).toBe('ignorar');
	});
});

describe('eventoDeOutraAssinatura', () => {
	it('só é resíduo quando as duas assinaturas existem e diferem', () => {
		expect(eventoDeOutraAssinatura('sub_velha', 'sub_nova')).toBe(true);
		expect(eventoDeOutraAssinatura('sub_x', 'sub_x')).toBe(false);
		expect(eventoDeOutraAssinatura(null, 'sub_x')).toBe(false);
		expect(eventoDeOutraAssinatura('sub_x', null)).toBe(false);
	});
});

describe('novaExpiracao', () => {
	const agora = new Date('2026-10-16T12:00:00Z');
	it('sem expiração vigente conta de hoje + carência', () => {
		expect(novaExpiracao(agora, null, 1).toISOString().slice(0, 10)).toBe('2026-11-21');
	});
	it('pagamento adiantado soma a partir do vencimento', () => {
		// vence 10/11 (já com 5 dias de carência → vencimento real 05/11)
		const atual = new Date('2026-11-10T12:00:00Z');
		expect(novaExpiracao(agora, atual, 1).toISOString().slice(0, 10)).toBe('2026-12-10');
	});
	it('expiração já passada conta de hoje', () => {
		const atual = new Date('2026-09-01T12:00:00Z');
		expect(novaExpiracao(agora, atual, 12).toISOString().slice(0, 10)).toBe('2027-10-21');
	});
});

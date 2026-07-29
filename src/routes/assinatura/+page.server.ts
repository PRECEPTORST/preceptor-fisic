import { error, fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { professionals } from '$lib/server/db/schema';
import {
	asaasEnabled,
	createAsaasCustomer,
	createPlanSubscription,
	PAYMENT_LINKS
} from '$lib/server/asaas';
import { logger } from '$lib/server/logger';
import { hasActiveSubscription, isTrialing, trialDaysLeft } from '$lib/server/subscription';
import { decryptCpf, normalizeCpfCnpj } from '$lib/server/cpf';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (!locals.user) error(401, 'não autenticado');
	// O professional do layout é uma projeção enxuta (sem campos de billing) —
	// busca aqui a linha com status/plano/vencimento/asaasCustomerId.
	const [professional] = await db
		.select({
			id: professionals.id,
			name: professionals.name,
			email: professionals.email,
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionPlan: professionals.subscriptionPlan,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt,
			asaasCustomerId: professionals.asaasCustomerId,
			cpfEncrypted: professionals.cpfEncrypted,
			trialStartedAt: professionals.trialStartedAt
		})
		.from(professionals)
		.where(eq(professionals.authUserId, locals.user.id))
		.limit(1);
	if (!professional) error(401, 'não autenticado');

	// Distingue quem NUNCA teve acesso (conta recém-criada, trial sem data) de
	// quem tinha acesso e perdeu. O layout manda todo bloqueado pra cá com
	// motivo=expirado, mas dizer "seu acesso terminou" pra quem acabou de criar
	// a conta é mentira: essa pessoa nunca teve período gratuito.
	const semAssinatura = !hasActiveSubscription(professional);
	// Sem trial_started_at a pessoa nunca teve período gratuito: ou é conta
	// antiga (anterior ao trial), ou o CPF dela já tinha usado o teste. Nos dois
	// casos dizer "seu acesso terminou" é mentira.
	const nuncaTeveAcesso =
		professional.subscriptionStatus === 'trial' &&
		(professional.subscriptionExpiresAt == null || professional.trialStartedAt == null);
	// Quem está em teste NÃO é "ativo": tem acesso, mas precisa ver os planos e
	// conseguir assinar. Tratar trial como assinante deixava a tela dizendo
	// "sua assinatura está ativa" sem nenhum botão de compra, e é justamente
	// pra cá que a faixa do topo manda a pessoa.
	const emTrial = isTrialing(professional);
	const situacao: 'ativo' | 'trial' | 'novo' | 'expirado' = emTrial
		? 'trial'
		: !semAssinatura
			? 'ativo'
			: nuncaTeveAcesso
				? 'novo'
				: 'expirado';

	return {
		professional,
		billingEnabled: asaasEnabled(),
		situacao,
		diasDeTrial: emTrial ? trialDaysLeft(professional) : 0,
		// A tela esconde o campo de CPF quando já temos o documento guardado.
		// Só o booleano vai pro cliente, nunca o número.
		cpfNoCadastro: decryptCpf(professional.cpfEncrypted) != null
	};
}) satisfies PageServerLoad;

const PLAN_KEYS = Object.keys(PAYMENT_LINKS) as (keyof typeof PAYMENT_LINKS)[];

export const actions: Actions = {
	subscribe: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		if (!asaasEnabled()) return fail(503, { error: 'pagamentos indisponíveis no momento' });

		const fd = await request.formData();
		const planKey = String(fd.get('plan') ?? '') as keyof typeof PAYMENT_LINKS;
		const cpfRaw = String(fd.get('cpf') ?? '');
		if (!PLAN_KEYS.includes(planKey)) return fail(400, { error: 'plano inválido' });

		const [prof] = await db
			.select({
				id: professionals.id,
				name: professionals.name,
				email: professionals.email,
				asaasCustomerId: professionals.asaasCustomerId,
				cpfEncrypted: professionals.cpfEncrypted
			})
			.from(professionals)
			.where(eq(professionals.authUserId, locals.user.id))
			.limit(1);
		if (!prof) return fail(401, { error: 'não autenticado' });

		let customerId = prof.asaasCustomerId;
		if (!customerId) {
			// CPF guardado no cadastro tem precedência: quem já informou não
			// digita de novo na hora de pagar. O campo do formulário fica só
			// como saída pras contas antigas (e pra quem quer cobrar no CNPJ).
			const cpfCnpj = decryptCpf(prof.cpfEncrypted) ?? normalizeCpfCnpj(cpfRaw);
			if (!cpfCnpj) return fail(400, { error: 'CPF/CNPJ inválido' });
			try {
				customerId = await createAsaasCustomer({
					name: prof.name,
					email: prof.email,
					cpfCnpj,
					professionalId: prof.id
				});
			} catch (e) {
				logger.error({ err: String(e).slice(0, 300) }, 'assinatura.customer.failed');
				return fail(502, { error: 'não foi possível iniciar a assinatura, tente de novo' });
			}
			await db
				.update(professionals)
				.set({ asaasCustomerId: customerId, updatedAt: sql`now()` })
				.where(eq(professionals.id, prof.id));
		}

		let invoiceUrl: string | null;
		try {
			({ invoiceUrl } = await createPlanSubscription({
				customerId,
				planKey,
				professionalId: prof.id
			}));
		} catch (e) {
			logger.error({ err: String(e).slice(0, 300) }, 'assinatura.subscription.failed');
			return fail(502, { error: 'não foi possível gerar a cobrança, tente de novo' });
		}

		if (!invoiceUrl) {
			// Assinatura criada mas fatura ainda materializando — o webhook ativa
			// quando pagar; a pessoa recebe a fatura por email do próprio Asaas.
			return { success: true, pendingInvoice: true };
		}
		redirect(303, invoiceUrl);
	}
} satisfies Actions;

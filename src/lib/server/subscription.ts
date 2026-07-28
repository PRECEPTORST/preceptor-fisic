/**
 * Gate de assinatura e limites de plano, server-side.
 *
 * Regra de acesso: vale a data de expiração, seja qual for o status. Antes,
 * 'trial' retornava true sem olhar data nenhuma, e como nada gravava
 * subscription_expires_at no cadastro, toda conta nova ficava com acesso
 * vitalício. O produto não tem período gratuito: quem cria conta assina para
 * usar.
 *
 * Limites: cada plano define quantos alunos ativos e quantas gerações de plano
 * por ciclo. A contagem de gerações usa o ciclo da assinatura (a partir da data
 * de expiração, retrocedendo um mês), não o mês do calendário, para quem assina
 * dia 28 não perder a franquia em dois dias.
 *
 * Checar SEMPRE no servidor. Esconder botão na interface não é gate.
 */
import type { Professional } from './db/schema';

type SubscriptionFields = Pick<Professional, 'subscriptionStatus' | 'subscriptionExpiresAt'>;
type CycleFields = SubscriptionFields & Partial<Pick<Professional, 'trialStartedAt'>>;

/** Limites por plano. `null` = sem teto (Institucional é por contrato). */
export type PlanLimits = { students: number | null; generations: number | null };

/** Período gratuito: 7 dias, 2 gerações. Ver TRIAL_DAYS / TRIAL_PLAN. */
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN = 'trial';

export const PLAN_LIMITS: Record<string, PlanLimits> = {
	// O teto de alunos do trial é folgado de propósito: o que custa dinheiro é
	// a geração por IA, não a linha no banco. Cadastrar aluno é justamente o
	// que faz a pessoa se apropriar do produto.
	trial: { students: 10, generations: 2 },
	essencial: { students: 60, generations: 20 },
	pro: { students: 150, generations: 50 },
	institucional: { students: null, generations: 100 },
	// Contas internas do time, sem teto.
	'admin-test': { students: null, generations: null }
};

/** Fallback de quem tem acesso liberado mas está sem plano gravado. */
const DEFAULT_LIMITS: PlanLimits = PLAN_LIMITS.essencial!;

export function limitsFor(
	professional: Pick<Professional, 'subscriptionPlan'> & Partial<SubscriptionFields>
): PlanLimits {
	const plan = professional.subscriptionPlan?.toLowerCase() ?? '';
	if (PLAN_LIMITS[plan]) return PLAN_LIMITS[plan]!;
	// Quem está em trial sem plano gravado NÃO pode cair no fallback do
	// Essencial: seriam 20 gerações de graça em vez de 2.
	if (professional.subscriptionStatus === 'trial') return PLAN_LIMITS.trial!;
	return DEFAULT_LIMITS;
}

/**
 * Tem acesso? Só quem está dentro da validade. Status que representam falta de
 * pagamento (past_due, cancelled, inactive) nunca passam, mesmo com data no
 * futuro.
 */
export function hasActiveSubscription(professional: SubscriptionFields): boolean {
	const { subscriptionStatus: status, subscriptionExpiresAt: expiresAt } = professional;
	if (status !== 'active' && status !== 'trial') return false;
	if (expiresAt == null) return false;
	return expiresAt.getTime() > Date.now();
}

/**
 * Início do ciclo atual: um mês antes da data de expiração. Sem data, cai no
 * mês do calendário como último recurso.
 */
export function currentCycleStart(professional: CycleFields): Date {
	// Trial tem ciclo próprio: retroceder um mês a partir do vencimento cairia
	// três semanas ANTES da conta existir, e a franquia de 2 gerações passaria
	// a contar num intervalo que não é o do período gratuito.
	if (professional.subscriptionStatus === 'trial' && professional.trialStartedAt) {
		return professional.trialStartedAt;
	}
	const expires = professional.subscriptionExpiresAt;
	if (!expires) {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	}
	const start = new Date(expires);
	start.setMonth(start.getMonth() - 1);
	return start;
}

/** Está no período gratuito e ainda dentro do prazo. */
export function isTrialing(professional: SubscriptionFields): boolean {
	return professional.subscriptionStatus === 'trial' && hasActiveSubscription(professional);
}

/**
 * Dias que faltam, arredondando PRA CIMA: quem tem 6h de trial ainda lê
 * "1 dia", não "0 dias". Zero só quando já acabou.
 */
export function trialDaysLeft(professional: SubscriptionFields): number {
	const expires = professional.subscriptionExpiresAt;
	if (!expires) return 0;
	const ms = expires.getTime() - Date.now();
	return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** "termina hoje" / "resta 1 dia" / "restam 5 dias" */
export function trialLabel(diasRestantes: number): string {
	if (diasRestantes <= 0) return 'seu teste terminou';
	if (diasRestantes === 1) return 'resta 1 dia de teste';
	return `restam ${diasRestantes} dias de teste`;
}

export const SUBSCRIPTION_BLOCKED_MESSAGE =
	'Seu acesso gratuito terminou. Assine um plano para continuar gerando planos de treino.';

export function studentLimitMessage(limit: number): string {
	return `Você chegou ao limite de ${limit} alunos ativos do seu plano. Faça upgrade para cadastrar mais.`;
}

export function generationLimitMessage(limit: number): string {
	return `Você usou as ${limit} gerações de plano do seu ciclo. Faça upgrade para gerar mais ou aguarde a renovação.`;
}

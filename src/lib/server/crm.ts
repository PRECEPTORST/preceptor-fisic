/**
 * Regras do CRM interno (admin) que estavam inline nas form actions do
 * SvelteKit. Ficam aqui para a API do app React (web/server/routes/crm.ts)
 * reaproveitar sem cópia. Quem chama já garantiu que o usuário é admin.
 */
import { desc } from 'drizzle-orm';
import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { db } from '$lib/server/db';
import { professionals } from '$lib/server/db/schema';
import { env } from '$env/dynamic/public';
import { env as privEnv } from '$env/dynamic/private';
import { anthropic } from '$lib/server/ai/provider';
import { getAllFeedback } from '$lib/server/queries';
import { limitsFor } from '$lib/server/subscription';
import { audit } from '$lib/server/audit';
import { logger } from '$lib/server/logger';
import { planLabel, isLegacyPlan } from '$lib/planos';

/** Todas as contas de profissional, com a franquia e o rótulo do plano prontos. */
export async function listarContasComFranquia() {
	const contas = await db
		.select({
			id: professionals.id,
			name: professionals.name,
			email: professionals.email,
			cref: professionals.cref,
			isAdmin: professionals.isAdmin,
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionPlan: professionals.subscriptionPlan,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt,
			createdAt: professionals.createdAt
		})
		.from(professionals)
		.orderBy(desc(professionals.createdAt));
	return contas.map((c) => ({
		...c,
		limites: limitsFor(c),
		planoLabel: planLabel(c.subscriptionPlan),
		planoLegado: isLegacyPlan(c.subscriptionPlan)
	}));
}

export type ContaCrm = Awaited<ReturnType<typeof listarContasComFranquia>>[number];

export type ResultadoLink =
	| { ok: true; email: string; resetUrl: string }
	| { ok: false; status: 400 | 404 | 500; error: string };

/**
 * Gera o link de redefinição de senha (recovery) para o admin mandar pelo
 * WhatsApp, e registra em auditoria quem gerou e para quem.
 * `origem` é a origem da requisição: o link aponta para o ambiente onde o
 * admin está (PUBLIC_APP_URL só é fallback).
 */
export async function gerarLinkRecuperacao(params: {
	email: string;
	origem: string | null;
	adminId: string;
	ipAddress?: string | null;
	userAgent?: string | null;
}): Promise<ResultadoLink> {
	const email = params.email.trim().toLowerCase();
	if (!email || !email.includes('@')) return { ok: false, status: 400, error: 'e-mail inválido' };

	const supabaseUrl = env.PUBLIC_SUPABASE_URL;
	const serviceKey = privEnv.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceKey) {
		logger.error({}, 'crm.contas.misconfigured');
		return { ok: false, status: 500, error: 'Supabase não configurado neste ambiente.' };
	}
	const base = params.origem || env.PUBLIC_APP_URL?.replace(/\/$/, '') || '';
	if (!base) {
		logger.error({}, 'crm.contas.sem_base_url');
		return { ok: false, status: 500, error: 'Não consegui montar o link neste ambiente.' };
	}

	const supa = createClient(supabaseUrl, serviceKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	const { data: link, error } = await supa.auth.admin.generateLink({ type: 'recovery', email });
	const hashedToken = link?.properties?.hashed_token;
	if (error || !hashedToken) {
		const semConta = error?.status === 404;
		if (!semConta) logger.error({ err: error?.message }, 'crm.contas.generate_link.failed');
		return semConta
			? { ok: false, status: 404, error: 'Não existe conta com esse e-mail.' }
			: { ok: false, status: 500, error: 'Não consegui gerar o link. Tente de novo.' };
	}

	const resetUrl = `${base}/recuperar/redefinir?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
	audit({
		action: 'admin.password_reset_link_generated',
		professionalId: params.adminId,
		entityType: 'auth',
		payload: { target_email: email.slice(0, 120) },
		ipAddress: params.ipAddress ?? null,
		userAgent: params.userAgent ?? null
	});
	return { ok: true, email, resetUrl };
}

export type ResultadoResumo =
	| { ok: true; summary: string; summarizedCount: number }
	| { ok: false; status: 400 | 500; error: string };

/** Resume com IA todos os feedbacks dos beta testers (sob demanda, admin). */
export async function resumirFeedbacks(): Promise<ResultadoResumo> {
	const all = await getAllFeedback();
	if (all.length === 0) return { ok: false, status: 400, error: 'Ainda não há feedbacks pra resumir.' };

	const corpus = all
		.map(
			(f, i) =>
				`${i + 1}. [${f.category}]${f.page ? ` (em: ${f.page.slice(0, 200)})` : ''} — ${f.authorName ?? 'anônimo'}: ${f.message}`
		)
		.join('\n');

	try {
		const { text } = await generateText({
			model: anthropic('claude-opus-4-8'),
			system:
				'Você é um analista de produto sênior. Resuma feedbacks de beta testers de um app de prescrição de treino clínico (Preceptor FISIC) para a equipe fundadora. Seja objetivo, honesto e acionável. Responda em português do Brasil, em markdown.',
			prompt: `Abaixo estão ${all.length} feedbacks dos beta testers. Gere um resumo executivo curto com estas seções:\n\n1. **Temas principais** — agrupe feedbacks parecidos e diga quantos mencionaram cada tema.\n2. **Bugs reportados** — lista priorizada por gravidade/frequência.\n3. **Sugestões mais pedidas**.\n4. **Top 3 ações recomendadas** pra próxima sprint.\n\nNão invente nada que não esteja nos feedbacks.\n\nFEEDBACKS:\n${corpus}`,
			abortSignal: AbortSignal.timeout(60_000)
		});
		return { ok: true, summary: text, summarizedCount: all.length };
	} catch (err) {
		return { ok: false, status: 500, error: 'Falha ao gerar resumo: ' + String(err).slice(0, 150) };
	}
}

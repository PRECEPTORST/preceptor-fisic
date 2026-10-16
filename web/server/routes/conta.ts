import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { requireAccess, requireProfessional, requireUser, type Vars } from '../auth';
import { db } from '$lib/server/db';
import { organizationInvites, organizations, professionals } from '$lib/server/db/schema';
import {
	createFeedback,
	createLeadFromSignup,
	createProfessional,
	FEEDBACK_CATEGORIES,
	getMyFeedback,
	getProfessionalByAuthId,
	updateProfessional,
	type FeedbackCategory
} from '$lib/server/queries';
import {
	acceptInvite,
	createInvite,
	getOrganization,
	hashInviteToken,
	hasAccess,
	listMembers,
	listOrganizationStudents,
	listPendingInvites,
	removeMember
} from '$lib/server/organization';
import {
	asaasEnabled,
	createAsaasCustomer,
	createPlanSubscription,
	listActiveSubscriptions,
	pendingInvoiceUrl,
	PAYMENT_LINKS
} from '$lib/server/asaas';
import { currentCycleStart, hasActiveSubscription, isTrialing, trialDaysLeft, TRIAL_DAYS } from '$lib/server/subscription';
import { decryptCpf, normalizeCpfCnpj } from '$lib/server/cpf';
import { sendProfessionalWelcome } from '$lib/server/email';
import { checkAndAudit } from '$lib/server/rate-limit';
import { audit, clientFingerprint } from '$lib/server/audit';
import { logger } from '$lib/server/logger';

/**
 * API do domínio "conta", montada em /api (ver app.ts). Cada rota espelha a
 * form action correspondente do SvelteKit e confere o dono pelo professional
 * da sessão (nunca por id vindo do cliente).
 *
 * Gates: /configuracoes, /assinatura, /upgrade e /convite são rotas livres
 * (sem requireAccess), igual ao ROTAS_LIVRES. /onboarding só exige sessão.
 */
export const conta = new Hono<{ Variables: Vars }>();

const Specialty = z.enum([
	'prescricao_clinica',
	'treinamento_funcional',
	'reabilitacao',
	'musculacao',
	'personal',
	'pilates',
	'outro'
]);

function linhas<T>(r: unknown): T[] {
	return ((r as { rows?: T[] }).rows ?? r) as T[];
}

// ───────────────────────── Configurações ─────────────────────────

const Perfil = z.object({
	name: z.string().trim().min(2, 'Nome obrigatório.').max(120, 'Nome muito longo (máx. 120 caracteres).'),
	// cref aparece pra alunos na área pública: cap de tamanho, sem regex de formato.
	cref: z.string().trim().max(40, 'CREF/CREFITO muito longo (máx. 40 caracteres).').nullish(),
	specialty: Specialty
});

conta.put('/configuracoes/perfil', requireUser, requireProfessional, async (c) => {
	const p = Perfil.safeParse(await c.req.json().catch(() => ({})));
	if (!p.success) return c.json({ error: p.error.issues[0]?.message ?? 'Dados inválidos.' }, 400);
	await updateProfessional({
		authUserId: c.get('user').id,
		name: p.data.name,
		cref: p.data.cref || null,
		specialty: p.data.specialty,
		// updateProfessional zera avatarUrl quando omitido; preserva o atual.
		avatarUrl: c.get('professional').avatarUrl
	});
	return c.json({ ok: true });
});

// ───────────────────────── Assinatura ─────────────────────────

conta.get('/assinatura', requireUser, requireProfessional, (c) => {
	const prof = c.get('professional');
	const semAssinatura = !hasActiveSubscription(prof);
	// Sem trial_started_at a pessoa nunca teve período gratuito (conta antiga ou
	// CPF que já testou): dizer "seu acesso terminou" seria mentira.
	const nuncaTeveAcesso =
		prof.subscriptionStatus === 'trial' && (prof.subscriptionExpiresAt == null || prof.trialStartedAt == null);
	// Trial NÃO é "ativo": precisa ver os planos e conseguir assinar.
	const emTrial = isTrialing(prof);
	const situacao = emTrial ? 'trial' : !semAssinatura ? 'ativo' : nuncaTeveAcesso ? 'novo' : 'expirado';
	return c.json({
		nome: prof.name,
		email: prof.email,
		plano: prof.subscriptionPlan,
		expiraEm: prof.subscriptionExpiresAt,
		billingEnabled: asaasEnabled(),
		situacao,
		diasDeTrial: emTrial ? trialDaysLeft(prof) : 0,
		// Só o booleano vai pro cliente, nunca o número.
		precisaCpf: !prof.asaasCustomerId && decryptCpf(prof.cpfEncrypted) == null
	});
});

const PLAN_KEYS = Object.keys(PAYMENT_LINKS) as [keyof typeof PAYMENT_LINKS, ...(keyof typeof PAYMENT_LINKS)[]];
const Assinar = z.object({ plan: z.enum(PLAN_KEYS), cpf: z.string().max(40).optional() });

conta.post('/assinatura', requireUser, requireProfessional, async (c) => {
	if (!asaasEnabled()) return c.json({ error: 'Pagamentos indisponíveis no momento.' }, 503);
	const p = Assinar.safeParse(await c.req.json().catch(() => ({})));
	if (!p.success) return c.json({ error: 'Plano inválido.' }, 400);
	const prof = c.get('professional');

	let customerId = prof.asaasCustomerId;
	if (!customerId) {
		// CPF do cadastro tem precedência; o campo é saída pra contas antigas e CNPJ.
		const cpfCnpj = decryptCpf(prof.cpfEncrypted) ?? normalizeCpfCnpj(p.data.cpf ?? '');
		if (!cpfCnpj) return c.json({ error: 'CPF/CNPJ inválido.' }, 400);
		try {
			customerId = await createAsaasCustomer({ name: prof.name, email: prof.email, cpfCnpj, professionalId: prof.id });
		} catch (e) {
			logger.error({ err: String(e).slice(0, 300) }, 'assinatura.customer.failed');
			return c.json({ error: 'Não foi possível iniciar a assinatura, tente de novo.' }, 502);
		}
		await db.update(professionals).set({ asaasCustomerId: customerId, updatedAt: sql`now()` }).where(eq(professionals.id, prof.id));
	}

	// Trava contra assinatura duplicada (ver +page.server.ts do Svelte): quem
	// abandona a fatura e volta não pode abrir uma segunda recorrência. Falha
	// na consulta LIBERA a criação de propósito.
	let jaAberta: string | null | undefined;
	let temAtiva = false;
	try {
		const ativas = await listActiveSubscriptions(customerId);
		if (ativas.length > 0) {
			temAtiva = true;
			jaAberta = await pendingInvoiceUrl(ativas[0]!.id);
			await db
				.update(professionals)
				.set({ asaasSubscriptionId: ativas[0]!.id, updatedAt: sql`now()` })
				.where(eq(professionals.id, prof.id));
		}
	} catch (e) {
		logger.error({ err: String(e).slice(0, 300) }, 'assinatura.checagem_duplicata.falhou');
	}
	if (temAtiva) {
		if (jaAberta) return c.json({ url: jaAberta, existente: true });
		return c.json(
			{
				error:
					'Você já tem uma assinatura em andamento. Se o pagamento não apareceu, fale com a gente que a gente verifica. Não crie outra, para não gerar cobrança dupla.',
				jaAssinou: true
			},
			409
		);
	}

	let invoiceUrl: string | null;
	let subscriptionId: string;
	try {
		({ invoiceUrl, subscriptionId } = await createPlanSubscription({ customerId, planKey: p.data.plan, professionalId: prof.id }));
	} catch (e) {
		logger.error({ err: String(e).slice(0, 300) }, 'assinatura.subscription.failed');
		return c.json({ error: 'Não foi possível gerar a cobrança, tente de novo.' }, 502);
	}
	// Grava antes de devolver: a próxima tentativa já cai na trava acima.
	await db
		.update(professionals)
		.set({ asaasSubscriptionId: subscriptionId, updatedAt: sql`now()` })
		.where(eq(professionals.id, prof.id))
		.catch((err) => logger.error({ err: String(err).slice(0, 200) }, 'assinatura.subscription_id.nao_gravado'));

	// Sem fatura ainda: o Asaas manda por e-mail e o webhook ativa ao pagar.
	if (!invoiceUrl) return c.json({ pendente: true });
	return c.json({ url: invoiceUrl });
});

// ───────────────────────── Upgrade (muro) ─────────────────────────

conta.get('/upgrade', requireUser, requireProfessional, async (c) => {
	const prof = c.get('professional');
	if (await hasAccess(prof)) return c.json({ temAcesso: true });
	let acervo = { alunos: 0, planos: 0, publicados: 0 };
	try {
		const r = await db.execute(sql`
			SELECT
				(SELECT COUNT(*) FROM students WHERE professional_id = ${prof.id} AND deleted_at IS NULL)::int AS alunos,
				(SELECT COUNT(*) FROM training_plans WHERE professional_id = ${prof.id})::int AS planos,
				(SELECT COUNT(*) FROM training_plans WHERE professional_id = ${prof.id} AND status = 'published')::int AS publicados
		`);
		const row = linhas<{ alunos: number; planos: number; publicados: number }>(r)[0];
		if (row) acervo = { alunos: Number(row.alunos), planos: Number(row.planos), publicados: Number(row.publicados) };
	} catch (err) {
		// Degrada pra zeros: o muro sem números ainda funciona, um 500 não.
		logger.error({ err: String(err).slice(0, 200) }, 'upgrade.acervo.failed');
	}
	return c.json({
		temAcesso: false,
		usouTrial: prof.trialStartedAt != null,
		acervo,
		nome: prof.name.split(' ')[0] || prof.name
	});
});

// ───────────────────────── Feedback ─────────────────────────

const VALID_CATEGORIES = FEEDBACK_CATEGORIES.map((x) => x.id) as [FeedbackCategory, ...FeedbackCategory[]];
const Feedback = z.object({
	category: z.enum(VALID_CATEGORIES, { errorMap: () => ({ message: 'Categoria inválida.' }) }),
	message: z.string().trim().min(3, 'Escreva um pouco mais no feedback.').max(4000, 'Feedback muito longo (máx. 4000 caracteres).'),
	page: z.string().nullish()
});

conta.get('/feedback', requireUser, requireProfessional, requireAccess, async (c) =>
	c.json({ mine: await getMyFeedback(c.get('professional').id) })
);

conta.post('/feedback', requireUser, requireProfessional, requireAccess, async (c) => {
	const p = Feedback.safeParse(await c.req.json().catch(() => ({})));
	if (!p.success) return c.json({ error: p.error.issues[0]?.message ?? 'Dados inválidos.' }, 400);
	const pro = c.get('professional');
	await createFeedback({
		professionalId: pro.id,
		authorName: pro.name,
		authorEmail: pro.email,
		category: p.data.category,
		message: p.data.message,
		// page entra no corpus do resumo IA: cap de 200 chars.
		page: (p.data.page?.trim() || null)?.slice(0, 200) ?? null
	});
	return c.json({ ok: true }, 201);
});

// ───────────────────────── Equipe (dono da clínica) ─────────────────────────

async function donoDaClinica(prof: Vars['professional']) {
	if (!prof.organizationId) throw new HTTPException(404, { message: 'Sua conta não faz parte de uma clínica.' });
	const org = await getOrganization(prof.organizationId);
	if (!org) throw new HTTPException(404, { message: 'Clínica não encontrada.' });
	if (org.ownerProfessionalId !== prof.id)
		throw new HTTPException(403, { message: 'Só quem administra a clínica acessa esta página.' });
	return org;
}

conta.get('/equipe', requireUser, requireProfessional, requireAccess, async (c) => {
	const org = await donoDaClinica(c.get('professional'));
	const [membros, convites, alunos] = await Promise.all([
		listMembers(org.id),
		listPendingInvites(org.id),
		listOrganizationStudents(org.id)
	]);
	// O ciclo vem da assinatura do dono.
	const [dono] = await db
		.select({
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt,
			trialStartedAt: professionals.trialStartedAt
		})
		.from(professionals)
		.where(eq(professionals.id, org.ownerProfessionalId))
		.limit(1);
	const desde = dono ? currentCycleStart(dono) : new Date(0);
	const r = await db.execute(sql`
		SELECT r.professional_id, COUNT(*)::int AS n
		FROM ai_runs r
		JOIN professionals p ON p.id = r.professional_id
		WHERE p.organization_id = ${org.id}
		  AND r.kind = 'plan_generation'
		  AND r.created_at >= ${desde.toISOString()}
		GROUP BY r.professional_id
	`);
	const porMembro = new Map(linhas<{ professional_id: string; n: number }>(r).map((x) => [x.professional_id, Number(x.n)]));
	const usadasNoCiclo = [...porMembro.values()].reduce((a, b) => a + b, 0);
	return c.json({
		org: {
			id: org.id,
			name: org.name,
			seats: org.seats,
			generationsLimit: org.generationsLimit,
			perMemberGenerationCap: org.perMemberGenerationCap
		},
		membros: membros.map((m) => ({ ...m, noCiclo: porMembro.get(m.id) ?? 0 })),
		convites,
		alunos,
		usadasNoCiclo,
		cicloDesde: desde
	});
});

conta.post('/equipe/convites', requireUser, requireProfessional, requireAccess, async (c) => {
	const prof = c.get('professional');
	const org = await donoDaClinica(prof);
	const p = z.object({ email: z.string().trim().max(200) }).safeParse(await c.req.json().catch(() => ({})));
	if (!p.success) return c.json({ error: 'E-mail inválido.' }, 400);
	const r = await createInvite({ org, email: p.data.email, invitedBy: prof.id });
	if (!r.ok) return c.json({ error: r.erro }, 400);
	audit({
		action: 'org.invite_created',
		professionalId: prof.id,
		entityType: 'organization',
		entityId: org.id,
		payload: { email: p.data.email.slice(0, 120) },
		...clientFingerprint(c.req.raw)
	});
	// O link aponta pro ambiente onde a pessoa está de fato.
	const base = new URL(c.req.url).origin.replace(/\/$/, '');
	return c.json({ convite: { email: p.data.email.toLowerCase(), url: `${base}/convite/${r.token}` } }, 201);
});

conta.delete('/equipe/membros/:id', requireUser, requireProfessional, requireAccess, async (c) => {
	const prof = c.get('professional');
	const org = await donoDaClinica(prof);
	const alvo = c.req.param('id');
	// removeMember só desvincula quem é da MESMA clínica (WHERE organization_id).
	const erro = await removeMember(org, alvo);
	if (erro) return c.json({ error: erro }, 400);
	audit({
		action: 'org.member_removed',
		professionalId: prof.id,
		entityType: 'organization',
		entityId: org.id,
		payload: { removido: alvo },
		...clientFingerprint(c.req.raw)
	});
	return c.json({ ok: true });
});

conta.put('/equipe/teto', requireUser, requireProfessional, requireAccess, async (c) => {
	const org = await donoDaClinica(c.get('professional'));
	const body = (await c.req.json().catch(() => ({}))) as { cap?: unknown };
	// null = sem teto individual, todo mundo puxa do pool livremente.
	const cap = body.cap == null || body.cap === '' ? null : Number(body.cap);
	if (cap != null && (!Number.isInteger(cap) || cap < 1 || cap > org.generationsLimit)) {
		return c.json(
			{ error: `O teto por profissional deve ficar entre 1 e ${org.generationsLimit}, ou vazio para não ter teto.` },
			400
		);
	}
	await db.update(organizations).set({ perMemberGenerationCap: cap, updatedAt: new Date() }).where(eq(organizations.id, org.id));
	return c.json({ ok: true });
});

// ───────────────────────── Convite ─────────────────────────

conta.get('/convite/:token', requireUser, requireProfessional, async (c) => {
	const prof = c.get('professional');
	const [convite] = await db
		.select()
		.from(organizationInvites)
		.where(eq(organizationInvites.tokenHash, hashInviteToken(c.req.param('token'))))
		.limit(1);
	if (!convite) return c.json({ error: 'Convite não encontrado.' }, 404);
	const org = await getOrganization(convite.organizationId);
	if (!org) return c.json({ error: 'Clínica não encontrada.' }, 404);
	const situacao = convite.acceptedAt
		? 'usado'
		: convite.revokedAt
			? 'cancelado'
			: convite.expiresAt.getTime() < Date.now()
				? 'expirado'
				: prof.organizationId === org.id
					? 'ja_membro'
					: prof.organizationId
						? 'outra_clinica'
						: 'valido';
	return c.json({ situacao, clinica: org.name, convidado: convite.email, voce: { nome: prof.name, email: prof.email } });
});

conta.post('/convite/:token/aceitar', requireUser, requireProfessional, async (c) => {
	const prof = c.get('professional');
	const r = await acceptInvite(c.req.param('token'), prof);
	if (!r.ok) return c.json({ error: r.erro }, 400);
	audit({
		action: 'org.invite_accepted',
		professionalId: prof.id,
		entityType: 'organization',
		entityId: r.organizationId,
		...clientFingerprint(c.req.raw)
	});
	return c.json({ ok: true, clinica: r.nome });
});

// ───────────────────────── Onboarding (sessão, sem professional) ─────────────────────────

conta.get('/onboarding', requireUser, async (c) => {
	const existente = await getProfessionalByAuthId(c.get('user').id);
	return c.json({ email: c.get('user').email ?? '', jaTemPerfil: Boolean(existente) });
});

const Onboarding = z.object({
	name: z.string().trim().min(2, 'Nome obrigatório (mínimo 2 caracteres).').max(120, 'Nome muito longo (máx. 120 caracteres).'),
	cref: z.string().trim().max(40, 'Registro muito longo (máx. 40 caracteres).').nullish(),
	specialty: Specialty.or(z.string()).refine((v) => Specialty.safeParse(v).success, 'Selecione uma especialidade.'),
	cpf: z.string().max(40).default('')
});

conta.post('/onboarding', requireUser, async (c) => {
	const user = c.get('user');
	const existente = await getProfessionalByAuthId(user.id);
	// Já existe: sucesso silencioso (front mostra o passo 3). Não diz nada do trial.
	if (existente) return c.json({ ok: true, name: existente.name });

	// Throttle por IP ANTES de olhar o CPF: cada envio testa um CPF contra a
	// trava de trial, então sem teto a tela vira oráculo.
	const rl = await checkAndAudit({ key: 'onboarding', request: c.req.raw });
	if (!rl.allowed) return c.json({ error: rl.message ?? 'Muitas tentativas.' }, 429);

	const p = Onboarding.safeParse(await c.req.json().catch(() => ({})));
	if (!p.success) return c.json({ error: p.error.issues[0]?.message ?? 'Dados inválidos.' }, 400);
	const cpfDigits = normalizeCpfCnpj(p.data.cpf);
	if (!cpfDigits) return c.json({ error: 'CPF inválido. Confira os números e tente de novo.', campo: 'cpf' }, 400);
	const specialty = Specialty.parse(p.data.specialty);

	let created: { id: string; trialGranted: boolean };
	try {
		created = await createProfessional({
			authUserId: user.id,
			email: user.email ?? '',
			name: p.data.name,
			cref: p.data.cref || null,
			specialty,
			cpfDigits
		});
	} catch (e) {
		// Duplo submit: a unique de auth_user_id estoura no 2º insert.
		const raced = await getProfessionalByAuthId(user.id);
		if (raced) return c.json({ ok: true, name: raced.name });
		logger.error({ err: String(e).slice(0, 300) }, 'onboarding.create_professional.failed');
		return c.json({ error: 'Não foi possível criar seu perfil. Tente de novo.' }, 500);
	}

	createLeadFromSignup({ professionalId: created.id, name: p.data.name, email: user.email ?? '' }).catch((err) =>
		logger.error({ err: String(err).slice(0, 200) }, 'crm.lead_from_signup.failed')
	);
	if (user.email) {
		sendProfessionalWelcome({ to: user.email, name: p.data.name }).catch((err) =>
			logger.error({ err: String(err).slice(0, 200) }, 'professional.welcome.send_failed')
		);
	}
	// Mesmo contrato do Svelte: só o booleano, só para o dono da conta recém-criada.
	return c.json({ ok: true, name: p.data.name, trialGranted: created.trialGranted, trialDays: TRIAL_DAYS }, 201);
});

// ───────────────────────── Redefinir senha (público) ─────────────────────────

const TOKEN_ERROR = 'Link inválido ou expirado. Peça um novo em "Esqueci minha senha".';
const Redefinir = z.object({ token_hash: z.string().min(1).max(500), password: z.string(), confirm: z.string() });

/**
 * Consome o token de recovery (uso único) só aqui, no POST, para o preview
 * do WhatsApp não queimar o link no GET. A senha é validada ANTES de tocar no
 * token: erro de digitação não pode gastar o link.
 */
conta.post('/recuperar/redefinir', async (c) => {
	const rl = await checkAndAudit({ key: 'password_reset', request: c.req.raw });
	if (!rl.allowed) return c.json({ error: rl.message ?? 'Muitas tentativas.' }, 429);
	const p = Redefinir.safeParse(await c.req.json().catch(() => ({})));
	if (!p.success) return c.json({ error: TOKEN_ERROR }, 400);
	if (p.data.password.length < 8) return c.json({ error: 'Senha precisa ter pelo menos 8 caracteres.' }, 400);
	if (p.data.password !== p.data.confirm) return c.json({ error: 'As senhas não coincidem.' }, 400);

	const url = process.env.PUBLIC_SUPABASE_URL;
	const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) return c.json({ error: 'Auth não configurado.' }, 503);
	const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
	const v = await sb.auth.verifyOtp({ type: 'recovery', token_hash: p.data.token_hash });
	if (v.error || !v.data.session) return c.json({ error: TOKEN_ERROR }, 400);
	const u = await sb.auth.updateUser({ password: p.data.password });
	if (u.error) return c.json({ error: 'Não foi possível atualizar. O link pode ter expirado. Peça um novo.' }, 400);
	audit({
		action: 'auth.password_changed',
		entityType: 'auth',
		entityId: v.data.user?.id ?? null,
		...clientFingerprint(c.req.raw)
	});
	// Encerra a sessão de recovery: a pessoa entra com a senha nova.
	await sb.auth.signOut().catch(() => undefined);
	return c.json({ ok: true });
});

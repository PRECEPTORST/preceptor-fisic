/**
 * Institucional: clínicas com mais de um profissional.
 *
 * Três coisas mudam quando alguém pertence a uma organização:
 *
 *   ACESSO  — quem paga é o dono. O membro herda a assinatura dele enquanto
 *             estiver vinculado, e não precisa assinar por conta própria.
 *   COTA    — a franquia de gerações é um POOL da clínica inteira, com teto
 *             opcional por profissional pra ninguém consumir tudo sozinho.
 *   VAGAS   — o contrato define quantos profissionais cabem.
 *
 * O que NÃO muda: de quem é o dado. Aluno, avaliação e plano continuam
 * pertencendo ao professional que os criou, e as queries que filtram por
 * professional_id seguem valendo. O dono da clínica vê números consolidados,
 * não ficha clínica de aluno de outro profissional — dado de saúde continua
 * restrito a quem atende.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { organizations, organizationInvites, professionals } from './db/schema';
import { hasActiveSubscription, currentCycleStart } from './subscription';
import type { Professional } from './db/schema';

/** Convite vale 7 dias: prazo suficiente pra pessoa ver o e-mail, curto o
 *  bastante pra um link esquecido não virar porta aberta. */
const INVITE_DAYS = 7;

export type OrganizationRow = typeof organizations.$inferSelect;

export function hashInviteToken(token: string): string {
	return createHash('sha256').update(`org-invite:${token}`).digest('hex');
}

export async function getOrganization(id: string): Promise<OrganizationRow | null> {
	const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
	return row ?? null;
}

/**
 * O profissional tem acesso? Resolve a herança do Institucional.
 *
 * Fora de organização, é a assinatura da própria conta. Dentro, vale a do
 * dono: o membro não tem assinatura nenhuma e não deveria ter.
 */
export async function hasAccess(professional: Professional): Promise<boolean> {
	if (hasActiveSubscription(professional)) return true;
	if (!professional.organizationId) return false;

	const [dono] = await db
		.select({
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt
		})
		.from(organizations)
		.innerJoin(professionals, eq(professionals.id, organizations.ownerProfessionalId))
		.where(eq(organizations.id, professional.organizationId))
		.limit(1);

	return dono ? hasActiveSubscription(dono) : false;
}

export type QuotaCheck =
	| { ok: true }
	| { ok: false; motivo: 'pool' | 'individual'; usado: number; limite: number };

/**
 * Cota de gerações da clínica no ciclo corrente.
 *
 * Duas barreiras: o pool da organização e o teto individual. O pool é
 * verificado primeiro porque é o limite que realmente custa dinheiro; o teto
 * individual existe só pra repartir esse pool.
 *
 * O ciclo vem da assinatura do DONO, que é quem tem data de vencimento.
 */
export async function checkOrganizationQuota(
	org: OrganizationRow,
	professionalId: string
): Promise<QuotaCheck> {
	const [dono] = await db
		.select({
			subscriptionStatus: professionals.subscriptionStatus,
			subscriptionExpiresAt: professionals.subscriptionExpiresAt,
			trialStartedAt: professionals.trialStartedAt
		})
		.from(professionals)
		.where(eq(professionals.id, org.ownerProfessionalId))
		.limit(1);
	if (!dono) return { ok: false, motivo: 'pool', usado: 0, limite: org.generationsLimit };

	const desde = currentCycleStart(dono);

	const [totais] = await db.execute<{ pool: number; individual: number }>(sql`
		SELECT
			COUNT(*)::int AS pool,
			COUNT(*) FILTER (WHERE r.professional_id = ${professionalId})::int AS individual
		FROM ai_runs r
		JOIN professionals p ON p.id = r.professional_id
		WHERE p.organization_id = ${org.id}
		  AND r.kind = 'plan_generation'
		  AND r.created_at >= ${desde.toISOString()}
	`) as unknown as Array<{ pool: number; individual: number }>;

	const pool = Number(totais?.pool ?? 0);
	const individual = Number(totais?.individual ?? 0);

	if (pool >= org.generationsLimit)
		return { ok: false, motivo: 'pool', usado: pool, limite: org.generationsLimit };

	const cap = org.perMemberGenerationCap;
	if (cap != null && individual >= cap)
		return { ok: false, motivo: 'individual', usado: individual, limite: cap };

	return { ok: true };
}

export function quotaMessage(check: Extract<QuotaCheck, { ok: false }>): string {
	return check.motivo === 'pool'
		? `A clínica usou as ${check.limite} gerações do ciclo. Fale com quem administra a conta para ampliar o plano.`
		: `Você usou suas ${check.limite} gerações do ciclo. Quem administra a conta pode aumentar seu limite.`;
}

/** Membros da clínica, com os números que o dono acompanha. */
export async function listMembers(organizationId: string) {
	const rows = await db.execute<{
		id: string;
		name: string;
		email: string;
		cref: string | null;
		is_owner: boolean;
		created_at: Date;
		alunos: number;
		planos: number;
		geracoes: number;
	}>(sql`
		SELECT
			p.id, p.name, p.email, p.cref, p.created_at,
			(o.owner_professional_id = p.id) AS is_owner,
			(SELECT COUNT(*) FROM students s
				WHERE s.professional_id = p.id AND s.deleted_at IS NULL)::int AS alunos,
			(SELECT COUNT(*) FROM training_plans t
				WHERE t.professional_id = p.id)::int AS planos,
			(SELECT COUNT(*) FROM ai_runs r
				WHERE r.professional_id = p.id AND r.kind = 'plan_generation')::int AS geracoes
		FROM professionals p
		JOIN organizations o ON o.id = p.organization_id
		WHERE p.organization_id = ${organizationId}
		ORDER BY is_owner DESC, p.name
	`);
	const list = (rows as unknown as { rows?: typeof rows }).rows ?? rows;
	return list as unknown as Array<{
		id: string;
		name: string;
		email: string;
		cref: string | null;
		is_owner: boolean;
		created_at: Date;
		alunos: number;
		planos: number;
		geracoes: number;
	}>;
}

/**
 * Alunos da clínica com o profissional responsável.
 *
 * Só identificação e vínculo: nome, quem atende e desde quando. Nada de
 * diagnóstico, medicação, avaliação ou plano — dado de saúde continua restrito
 * a quem atende. Serve pra clínica saber quem responde por quem, que é o que
 * importa quando um profissional sai.
 */
export async function listOrganizationStudents(organizationId: string) {
	const rows = await db.execute<{
		id: string;
		nome: string;
		responsavel: string;
		responsavel_id: string;
		criado_em: Date;
		planos: number;
	}>(sql`
		SELECT
			s.id, s.name AS nome, s.created_at AS criado_em,
			p.name AS responsavel, p.id AS responsavel_id,
			(SELECT COUNT(*) FROM training_plans t
				WHERE t.student_id = s.id AND t.status = 'published')::int AS planos
		FROM students s
		JOIN professionals p ON p.id = s.professional_id
		WHERE p.organization_id = ${organizationId}
		  AND s.deleted_at IS NULL
		ORDER BY p.name, s.name
	`);
	const list = (rows as unknown as { rows?: typeof rows }).rows ?? rows;
	return list as unknown as Array<{
		id: string;
		nome: string;
		responsavel: string;
		responsavel_id: string;
		criado_em: Date;
		planos: number;
	}>;
}

/**
 * O profissional pode cadastrar aluno em nome de `alvoId`?
 *
 * Só o dono, e só para quem está na mesma clínica. Sem isso um POST montado à
 * mão criaria aluno na conta de qualquer profissional do sistema.
 */
export async function podeAtribuirPara(
	professional: Professional,
	alvoId: string
): Promise<boolean> {
	if (alvoId === professional.id) return true;
	if (!professional.organizationId) return false;
	const org = await getOrganization(professional.organizationId);
	if (!org || org.ownerProfessionalId !== professional.id) return false;
	const [alvo] = await db
		.select({ organizationId: professionals.organizationId })
		.from(professionals)
		.where(eq(professionals.id, alvoId))
		.limit(1);
	return alvo?.organizationId === professional.organizationId;
}

export async function listPendingInvites(organizationId: string) {
	return db
		.select({
			id: organizationInvites.id,
			email: organizationInvites.email,
			expiresAt: organizationInvites.expiresAt,
			createdAt: organizationInvites.createdAt
		})
		.from(organizationInvites)
		.where(
			and(
				eq(organizationInvites.organizationId, organizationId),
				isNull(organizationInvites.acceptedAt),
				isNull(organizationInvites.revokedAt)
			)
		);
}

export type InviteResult =
	| { ok: true; token: string; expiresAt: Date }
	| { ok: false; erro: string };

/**
 * Cria o convite e devolve o token EM CLARO uma única vez — depois disso só
 * existe o hash. Quem chama é responsável por entregar o link.
 *
 * Conta vagas ocupadas + convites pendentes: senão dava pra estourar o
 * contrato disparando convites em lote e esperando todos aceitarem.
 */
export async function createInvite(input: {
	org: OrganizationRow;
	email: string;
	invitedBy: string;
}): Promise<InviteResult> {
	const email = input.email.trim().toLowerCase();
	if (!email.includes('@')) return { ok: false, erro: 'E-mail inválido.' };

	const [ja] = await db
		.select({ id: professionals.id, organizationId: professionals.organizationId })
		.from(professionals)
		.where(eq(professionals.email, email))
		.limit(1);
	if (ja?.organizationId === input.org.id)
		return { ok: false, erro: 'Essa pessoa já está na equipe.' };
	if (ja?.organizationId)
		return { ok: false, erro: 'Essa pessoa já pertence a outra clínica.' };

	const membros = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(professionals)
		.where(eq(professionals.organizationId, input.org.id));
	const pendentes = await listPendingInvites(input.org.id);
	const ocupadas = Number(membros[0]?.n ?? 0) + pendentes.length;
	if (ocupadas >= input.org.seats)
		return {
			ok: false,
			erro: `Todas as ${input.org.seats} vagas do contrato estão ocupadas ou com convite pendente.`
		};

	if (pendentes.some((p) => p.email === email))
		return { ok: false, erro: 'Já existe convite pendente para esse e-mail.' };

	const token = randomBytes(24).toString('base64url');
	const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
	await db.insert(organizationInvites).values({
		organizationId: input.org.id,
		email,
		tokenHash: hashInviteToken(token),
		invitedByProfessionalId: input.invitedBy,
		expiresAt
	});
	return { ok: true, token, expiresAt };
}

export type AcceptResult =
	| { ok: true; organizationId: string; nome: string }
	| { ok: false; erro: string };

/**
 * Aceita o convite e vincula o profissional à clínica.
 *
 * Não exige que o e-mail do convite seja o mesmo do login: quem tem o link
 * entra. O link é secreto, de uso único e expira em 7 dias, e travar por
 * e-mail quebraria quem se cadastrou com endereço pessoal.
 */
export async function acceptInvite(token: string, professional: Professional): Promise<AcceptResult> {
	if (professional.organizationId)
		return { ok: false, erro: 'Sua conta já pertence a uma clínica.' };

	const [convite] = await db
		.select()
		.from(organizationInvites)
		.where(eq(organizationInvites.tokenHash, hashInviteToken(token)))
		.limit(1);

	if (!convite) return { ok: false, erro: 'Convite não encontrado.' };
	if (convite.acceptedAt) return { ok: false, erro: 'Esse convite já foi usado.' };
	if (convite.revokedAt) return { ok: false, erro: 'Esse convite foi cancelado.' };
	if (convite.expiresAt.getTime() < Date.now())
		return { ok: false, erro: 'Esse convite expirou. Peça um novo para a clínica.' };

	const org = await getOrganization(convite.organizationId);
	if (!org) return { ok: false, erro: 'Clínica não encontrada.' };

	// Revalida a vaga no momento do aceite: entre o convite e o clique, outra
	// pessoa pode ter entrado e ocupado a última.
	const [membros] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(professionals)
		.where(eq(professionals.organizationId, org.id));
	if (Number(membros?.n ?? 0) >= org.seats)
		return { ok: false, erro: 'A clínica não tem mais vagas disponíveis.' };

	await db.transaction(async (tx) => {
		await tx
			.update(professionals)
			.set({ organizationId: org.id, updatedAt: new Date() })
			.where(eq(professionals.id, professional.id));
		await tx
			.update(organizationInvites)
			.set({ acceptedAt: new Date(), acceptedByProfessionalId: professional.id })
			.where(eq(organizationInvites.id, convite.id));
	});

	return { ok: true, organizationId: org.id, nome: org.name };
}

/** Tira o profissional da clínica. O dono não pode sair da própria. */
export async function removeMember(org: OrganizationRow, professionalId: string): Promise<string | null> {
	if (org.ownerProfessionalId === professionalId)
		return 'Quem administra a conta não pode sair da própria clínica.';
	await db
		.update(professionals)
		.set({ organizationId: null, updatedAt: new Date() })
		.where(and(eq(professionals.id, professionalId), eq(professionals.organizationId, org.id)));
	return null;
}

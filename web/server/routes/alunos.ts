import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAccess, requireProfessional, requireUser, type Vars } from '../auth';
import {
	countActiveStudents,
	createAssessment,
	createStudentTx,
	getRecentTrainingSessions,
	getStudentDetail,
	getStudentLoadEvolution,
	getStudentsByProfessional,
	setCardiovascularRisk,
	softDeleteStudent,
	updateStudentTx
} from '$lib/server/queries';
import { db } from '$lib/server/db';
import { students, trainingPlans } from '$lib/server/db/schema';
import { limitsFor, studentLimitMessage } from '$lib/server/subscription';
import { getOrganization, listMembers, podeAtribuirPara } from '$lib/server/organization';
import { parseDateISO, parseDecimalBR } from '$lib/server/form-utils';
import { localDateKey } from '$lib/server/tz';
import { audit, clientFingerprint } from '$lib/server/audit';
import { signStudentToken } from '$lib/server/aluno-token';
import { sendStudentFillLink, sendStudentMagicLink } from '$lib/server/email';
import { checkRateLimit } from '$lib/server/rate-limit';
import { logger } from '$lib/server/logger';
import { env as pubEnv } from '$env/dynamic/public';

/**
 * API do domínio "alunos", montada em /api (ver app.ts). Porta as form actions
 * de src/routes/(app)/alunos/**. Toda rota que recebe :id confere o dono com
 * getStudentDetail(id, professional.id) antes de ler ou escrever.
 */

type Ctx = Context<{ Variables: Vars }>;

const SexEnum = z.enum(['feminino', 'masculino', 'outro', 'nao_informado']);
const RiskEnum = z.enum(['baixo', 'moderado', 'alto', 'muito_alto']);
const ExpEnum = z.enum(['iniciante', 'intermediario', 'avancado']);
const DifficultyEnum = z.enum(['pequena', 'media', 'alta']);
const SplitEnum = z.enum(['auto', 'full_body', 'upper_lower', 'push_pull_legs']);

// Peso/altura chegam como texto ("72,5"): parseDecimalBR distingue vazio de inválido.
const texto = z.string().max(4000).optional().nullable();

const perfilSchema = z.object({
	name: z.string().trim().min(2, 'nome deve ter ao menos 2 letras').max(160),
	birthDate: texto,
	sex: SexEnum,
	weightKg: texto,
	heightCm: texto,
	phone: texto,
	email: z.string().trim().email('e-mail inválido').optional().nullable().or(z.literal('')),
	cardiovascularRisk: RiskEnum,
	diagnoses: z.string().max(4000).default(''),
	medications: z.string().max(4000).default(''),
	limitations: z.string().max(4000).default(''),
	goals: z.array(z.string().max(60)).max(20).default([]),
	weeklySessions: z.number().int().min(1, 'frequência semanal inválida (1 a 7)').max(7, 'frequência semanal inválida (1 a 7)'),
	minutesPerSession: z.number().int().min(15, 'minutos por sessão inválidos (15 a 180)').max(180, 'minutos por sessão inválidos (15 a 180)'),
	experienceLevel: ExpEnum,
	prescribedDifficulty: DifficultyEnum.default('media'),
	trainingSplit: SplitEnum.default('auto')
});

const criarSchema = z.discriminatedUnion('mode', [
	perfilSchema.extend({ mode: z.literal('completo'), responsavelId: z.string().optional() }),
	z.object({
		mode: z.literal('link'),
		responsavelId: z.string().optional(),
		name: z.string().trim().min(2, 'nome deve ter ao menos 2 letras').max(160),
		email: z.string().trim().email('e-mail inválido'),
		birthDate: z.string().trim().min(1, 'informe a data de nascimento')
	})
]);

const riscoSchema = z.object({ level: RiskEnum });

const avaliacaoSchema = z.object({
	weightKg: texto,
	heightCm: texto,
	bodyFatPct: texto,
	leanMassKg: texto,
	restingHr: texto,
	bpSys: texto,
	bpDia: texto,
	notes: z.string().max(4000).optional().nullable()
});

// Faixas plausíveis por campo; int = coluna integer no Postgres.
const CAMPOS_AVALIACAO = [
	{ key: 'weightKg', label: 'Peso', min: 20, max: 400 },
	{ key: 'heightCm', label: 'Altura', min: 100, max: 250 },
	{ key: 'bodyFatPct', label: '% Gordura', min: 1, max: 70 },
	{ key: 'leanMassKg', label: 'Massa magra', min: 10, max: 200 },
	{ key: 'restingHr', label: 'FC repouso', min: 30, max: 220, int: true },
	{ key: 'bpSys', label: 'PA sistólica', min: 70, max: 260, int: true },
	{ key: 'bpDia', label: 'PA diastólica', min: 40, max: 150, int: true }
] as const;

function parseList(s: string): string[] {
	return s
		.split(/[,\n;]+/)
		.map((x) => x.trim())
		.filter(Boolean);
}

/** Igual ao editar do SvelteKit: preserva os campos ricos do jsonb que o form não edita. */
function mergeByKey<T extends Record<string, unknown>>(incoming: T[], existing: unknown, key: string): T[] {
	const norm = (s: unknown) =>
		String(s ?? '')
			.trim()
			.toLowerCase();
	const prevList = Array.isArray(existing) ? (existing as Record<string, unknown>[]) : [];
	return incoming.map((item) => {
		const prev = prevList.find((e) => norm(e[key]) === norm(item[key]));
		return prev ? ({ ...prev, ...item } as T) : item;
	});
}

function appBaseUrl(c: Ctx): string {
	return (pubEnv.PUBLIC_APP_URL?.replace(/\/$/, '') || new URL(c.req.url).origin).replace(/\/$/, '');
}

function falha(status: 400 | 402 | 403 | 404 | 422 | 429 | 500 | 503, message: string): never {
	throw new HTTPException(status, { message });
}

async function corpo<T extends z.ZodTypeAny>(c: Ctx, schema: T): Promise<z.infer<T>> {
	const json = await c.req.json().catch(() => falha(400, 'Corpo da requisição inválido.'));
	const r = schema.safeParse(json);
	if (!r.success) {
		const i = r.error.issues[0];
		falha(422, i ? `${i.path.join('.') || 'dados'}: ${i.message}` : 'Dados inválidos.');
	}
	return r.data;
}

/** Aluno do profissional logado, ou 404 (mesma resposta para "não existe" e "é de outro"). */
async function alunoDoProfissional(c: Ctx) {
	const detail = await getStudentDetail(c.req.param('id') ?? '', c.get('professional').id);
	if (!detail) falha(404, 'Aluno não encontrado.');
	return detail;
}

/** Peso, altura e data de nascimento: mesmas mensagens das actions. */
function validarMedidas(v: { weightKg?: string | null; heightCm?: string | null; birthDate?: string | null }) {
	const weightKg = parseDecimalBR(v.weightKg ?? null);
	const heightCm = parseDecimalBR(v.heightCm ?? null);
	if (v.weightKg?.trim() && weightKg == null) falha(422, 'peso inválido — use apenas números (ex.: 72,5)');
	if (v.heightCm?.trim() && heightCm == null) falha(422, 'altura inválida — use apenas números (ex.: 175)');
	if (weightKg != null && (weightKg < 20 || weightKg > 400)) falha(422, 'peso inválido (20 a 400 kg)');
	if (heightCm != null && (heightCm < 100 || heightCm > 250))
		falha(
			422,
			heightCm > 0 && heightCm < 3
				? 'altura inválida — informe em centímetros (ex.: 175), não em metros'
				: 'altura inválida (100 a 250 cm)'
		);
	let birthDate: string | null = null;
	if (v.birthDate?.trim()) {
		birthDate = parseDateISO(v.birthDate.trim());
		if (!birthDate) falha(422, 'data de nascimento inválida (use AAAA-MM-DD ou DD/MM/AAAA)');
		if (birthDate > localDateKey(new Date())) falha(422, 'data de nascimento não pode ser no futuro');
	}
	return { weightKg, heightCm, birthDate };
}

const guard = [requireUser, requireProfessional, requireAccess] as const;

export const alunos = new Hono<{ Variables: Vars }>()
	/** Lista do profissional logado. */
	.get('/alunos', ...guard, async (c) => {
		const lista = await getStudentsByProfessional(c.get('professional').id);
		return c.json({ students: lista });
	})

	/** Contexto do cadastro: equipe só para o dono da clínica (seletor de responsável). */
	.get('/alunos/equipe', ...guard, async (c) => {
		const professional = c.get('professional');
		let equipe: Array<{ id: string; name: string }> = [];
		if (professional.organizationId) {
			const org = await getOrganization(professional.organizationId);
			if (org?.ownerProfessionalId === professional.id) {
				equipe = (await listMembers(org.id)).map((m) => ({ id: m.id, name: m.name }));
			}
		}
		return c.json({ equipe, euId: professional.id });
	})

	/** Cadastro (modo completo ou link). Porta a action default de /alunos/novo. */
	.post('/alunos', ...guard, async (c) => {
		const professional = c.get('professional');

		// Institucional é ilimitado: o membro não tem plano gravado na conta.
		const studentCap = professional.organizationId ? null : limitsFor(professional).students;
		if (studentCap != null && (await countActiveStudents(professional.id)) >= studentCap) {
			falha(402, studentLimitMessage(studentCap));
		}

		const input = await corpo(c, criarSchema);
		const responsavelId = input.responsavelId?.trim() || professional.id;
		if (!(await podeAtribuirPara(professional, responsavelId))) {
			falha(403, 'Você não pode cadastrar aluno para esse profissional.');
		}
		const fp = clientFingerprint(c.req.raw);

		if (input.mode === 'link') {
			const { birthDate } = validarMedidas({ birthDate: input.birthDate });
			if (!birthDate) falha(422, 'Preencha nome, e-mail e data de nascimento.');
			let id: string;
			try {
				id = await createStudentTx({
					professionalId: responsavelId,
					name: input.name,
					birthDate,
					sex: 'nao_informado',
					email: input.email,
					// LGPD art. 11: no modo link quem consente é o titular, em /a/[id]/completar.
					consentAcceptedAt: null,
					diagnoses: [],
					medications: [],
					cardiovascularRisk: 'baixo',
					experienceLevel: 'iniciante',
					prescribedDifficulty: 'media',
					weeklySessions: 3,
					minutesPerSession: 60,
					goals: [],
					profileComplete: false
				});
			} catch (e) {
				falha(400, 'erro ao salvar aluno: ' + (e as Error).message);
			}
			audit({ action: 'student.create', professionalId: professional.id, entityType: 'student', entityId: id, ...fp });

			const fillUrl = `${appBaseUrl(c)}/a/${id}/completar?t=${signStudentToken(id)}`;
			// E-mail best-effort, com rate limit por profissional (anti-spam no domínio do Resend).
			const rl = checkRateLimit('email_send', `student-create:${professional.id}`);
			try {
				if (!rl.allowed) throw new Error('rate-limited');
				await sendStudentFillLink({ to: input.email, studentName: input.name, professionalName: professional.name, fillUrl });
			} catch (err) {
				logger.error({ studentId: id, err: String(err).slice(0, 200) }, 'student.fill_link.email_failed');
			}
			return c.json({ mode: 'link' as const, id, fillUrl, studentName: input.name }, 201);
		}

		const { weightKg, heightCm, birthDate } = validarMedidas(input);
		let id: string;
		try {
			id = await createStudentTx({
				professionalId: responsavelId,
				name: input.name,
				birthDate,
				sex: input.sex,
				weightKg,
				heightCm,
				phone: input.phone?.trim() || null,
				email: input.email?.trim() || null,
				consentAcceptedAt: new Date(),
				diagnoses: parseList(input.diagnoses).map((label) => ({ label })),
				medications: parseList(input.medications).map((name) => ({ name })),
				injuries: parseList(input.limitations).map((region) => ({ region })),
				cardiovascularRisk: input.cardiovascularRisk,
				experienceLevel: input.experienceLevel,
				prescribedDifficulty: input.prescribedDifficulty,
				trainingSplit: input.trainingSplit,
				weeklySessions: input.weeklySessions,
				minutesPerSession: input.minutesPerSession,
				goals: input.goals,
				profileComplete: true
			});
		} catch (e) {
			falha(400, 'erro ao salvar aluno: ' + (e as Error).message);
		}
		audit({ action: 'student.create', professionalId: professional.id, entityType: 'student', entityId: id, ...fp });

		const email = input.email?.trim();
		if (email) {
			const rl = checkRateLimit('email_send', `student-create:${professional.id}`);
			try {
				if (!rl.allowed) throw new Error('rate-limited');
				await sendStudentMagicLink({
					to: email,
					studentName: input.name,
					professionalName: professional.name,
					magicLinkUrl: `${appBaseUrl(c)}/a/${id}?t=${signStudentToken(id)}`
				});
			} catch (err) {
				logger.error({ studentId: id, err: String(err).slice(0, 200) }, 'student.magic_link.send_failed');
			}
		}
		return c.json({ mode: 'completo' as const, id }, 201);
	})

	/** Ficha: detalhe + status real dos planos + links + carga + sessões recentes. */
	.get('/alunos/:id', ...guard, async (c) => {
		const professional = c.get('professional');
		const id = c.req.param('id');
		const detail = await alunoDoProfissional(c);
		const [loadEvolution, recentSessions, planStatuses] = await Promise.all([
			getStudentLoadEvolution(id),
			getRecentTrainingSessions(id, professional.id),
			// getStudentDetail só expõe isActive; plano gerando/falho não pode virar "Encerrado".
			db.select({ id: trainingPlans.id, status: trainingPlans.status }).from(trainingPlans).where(eq(trainingPlans.studentId, id))
		]);
		const statusById = new Map(planStatuses.map((p) => [p.id, p.status]));
		const plans = detail.plans.map((p) => ({
			...p,
			status: statusById.get(p.id) ?? (p.isActive ? 'published' : 'archived')
		}));
		const base = appBaseUrl(c);
		const token = signStudentToken(id, detail.student.linkTokenVersion);
		return c.json({
			detail: { ...detail, plans },
			alunoUrl: `${base}/a/${id}?t=${token}`,
			fillUrl: `${base}/a/${id}/completar?t=${token}`,
			loadEvolution,
			recentSessions
		});
	})

	/** Edição. Porta a action save de /alunos/[id]/editar. */
	.put('/alunos/:id', ...guard, async (c) => {
		const professional = c.get('professional');
		const detail = await alunoDoProfissional(c);
		const input = await corpo(c, perfilSchema);
		const { weightKg, heightCm, birthDate } = validarMedidas(input);
		const hp = detail.healthProfile;
		try {
			await updateStudentTx({
				studentId: detail.student.id,
				professionalId: professional.id,
				name: input.name,
				birthDate,
				sex: input.sex,
				weightKg,
				heightCm,
				phone: input.phone?.trim() || null,
				email: input.email?.trim() || null,
				diagnoses: mergeByKey(parseList(input.diagnoses).map((label) => ({ label })), hp?.diagnoses, 'label'),
				medications: mergeByKey(parseList(input.medications).map((name) => ({ name })), hp?.medications, 'name'),
				injuries: mergeByKey(parseList(input.limitations).map((region) => ({ region })), hp?.injuries, 'region'),
				cardiovascularRisk: input.cardiovascularRisk,
				experienceLevel: input.experienceLevel,
				prescribedDifficulty: input.prescribedDifficulty,
				trainingSplit: input.trainingSplit,
				weeklySessions: input.weeklySessions,
				minutesPerSession: input.minutesPerSession,
				goals: input.goals
			});
		} catch (e) {
			falha(400, (e as Error).message);
		}
		audit({
			action: 'student.update',
			professionalId: professional.id,
			entityType: 'student',
			entityId: detail.student.id,
			...clientFingerprint(c.req.raw)
		});
		return c.json({ ok: true });
	})

	/** Exclusão lógica (dados ficam para LGPD/auditoria). */
	.delete('/alunos/:id', ...guard, async (c) => {
		const professional = c.get('professional');
		const detail = await alunoDoProfissional(c);
		await softDeleteStudent(detail.student.id, professional.id);
		audit({
			action: 'student.delete',
			professionalId: professional.id,
			entityType: 'student',
			entityId: detail.student.id,
			...clientFingerprint(c.req.raw)
		});
		return c.json({ ok: true });
	})

	/** Revoga o link atual (link_token_version + 1): o antigo passa a responder 403. */
	.post('/alunos/:id/link/revogar', ...guard, async (c) => {
		const professional = c.get('professional');
		const detail = await alunoDoProfissional(c);
		await db
			.update(students)
			.set({ linkTokenVersion: detail.student.linkTokenVersion + 1, updatedAt: new Date() })
			.where(eq(students.id, detail.student.id));
		await audit({
			action: 'student.link_revoke',
			professionalId: professional.id,
			entityType: 'student',
			entityId: detail.student.id,
			...clientFingerprint(c.req.raw)
		});
		return c.json({ ok: true });
	})

	/** Reenvia o magic-link por e-mail (3 envios / 10 min por profissional+aluno). */
	.post('/alunos/:id/link/reenviar', ...guard, async (c) => {
		const professional = c.get('professional');
		const detail = await alunoDoProfissional(c);
		const { student } = detail;
		if (!student.email) falha(400, 'Aluno não tem e-mail cadastrado. Adicione o e-mail primeiro em Editar.');
		const rl = checkRateLimit('email_send', `resend:${professional.id}:${student.id}`);
		if (!rl.allowed) falha(429, 'Muitos envios de e-mail. Aguarde alguns minutos e tente de novo.');

		const token = signStudentToken(student.id, student.linkTokenVersion);
		const result = await sendStudentMagicLink({
			to: student.email,
			studentName: student.name,
			professionalName: professional.name,
			magicLinkUrl: `${appBaseUrl(c)}/a/${student.id}?t=${token}`
		});
		if (result.skipped) falha(503, 'Serviço de e-mail não configurado (RESEND_API_KEY ausente).');
		if (!result.sent) falha(500, result.error ?? 'Falha ao enviar.');

		audit({
			action: 'student.magic_link_resent',
			professionalId: professional.id,
			entityType: 'student',
			entityId: student.id,
			payload: { sentTo: student.email }
		});
		return c.json({ sentTo: student.email });
	})

	/** Grava o risco CV escolhido pelo profissional (decisão humana, com trilha). */
	.put('/alunos/:id/risco-cv', ...guard, async (c) => {
		const professional = c.get('professional');
		const detail = await alunoDoProfissional(c);
		const { level } = await corpo(c, riscoSchema);
		const previous = detail.healthProfile?.cardiovascularRisk ?? null;
		await setCardiovascularRisk(detail.student.id, level);
		audit({
			action: 'health.cv_risk_updated',
			professionalId: professional.id,
			entityType: 'student',
			entityId: detail.student.id,
			payload: { from: previous, to: level }
		});
		return c.json({ level });
	})

	/** Nova avaliação física. Porta a action default de /alunos/[id]/avaliacao. */
	.post('/alunos/:id/avaliacoes', ...guard, async (c) => {
		const professional = c.get('professional');
		const detail = await alunoDoProfissional(c);
		const input = await corpo(c, avaliacaoSchema);

		const vals = {} as Record<(typeof CAMPOS_AVALIACAO)[number]['key'], number | undefined>;
		for (const f of CAMPOS_AVALIACAO) {
			const raw = String(input[f.key] ?? '').trim();
			if (!raw) {
				vals[f.key] = undefined;
				continue;
			}
			const n = parseDecimalBR(raw);
			if (n == null) falha(422, `Valor inválido em ${f.label} — use apenas números (ex.: 83,5)`);
			const v = 'int' in f && f.int ? Math.round(n) : n;
			if (v < f.min || v > f.max) falha(422, `${f.label} fora da faixa plausível (${f.min} a ${f.max})`);
			vals[f.key] = v;
		}
		const notes = input.notes?.trim() || undefined;
		if (!notes && CAMPOS_AVALIACAO.every((f) => vals[f.key] === undefined)) falha(422, 'Preencha ao menos uma métrica.');

		const { weightKg, heightCm } = vals;
		const bmi = weightKg && heightCm ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10 : undefined;
		const id = await createAssessment({
			professionalId: professional.id,
			studentId: detail.student.id,
			weightKg,
			bodyFatPct: vals.bodyFatPct,
			leanMassKg: vals.leanMassKg,
			bmi,
			restingHr: vals.restingHr,
			bloodPressureSystolic: vals.bpSys,
			bloodPressureDiastolic: vals.bpDia,
			notes
		});
		return c.json({ id }, 201);
	});

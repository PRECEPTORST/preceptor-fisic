import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from 'hono';
import { requireAccess, requireProfessional, requireUser, type Vars } from '../auth';
import { audit, clientFingerprint, type AuditAction } from '$lib/server/audit';
import {
	archivePlan,
	getPlanDetail,
	getPlansByProfessional,
	getRecentSessionLogs,
	getStudentDetail,
	matchCatalogByName,
	publishPlan,
	searchExerciseCatalog
} from '$lib/server/queries';
import { db } from '$lib/server/db';
import { trainingPlans } from '$lib/server/db/schema';
import { isUuid } from '$lib/server/validation';
import { failIfStale } from '$lib/server/ai/generator';
import {
	BLOCOS,
	cotaGeracoes,
	adicionarExercicio,
	criarPlanoManual,
	editarExercicio,
	excluirPlano,
	iniciarGeracao,
	moverExercicio,
	reativarPlano,
	removerExercicio,
	resolverRestricao,
	revalidarPlano,
	trocarExercicio,
	type Resultado
} from '$lib/server/treinos';

/** API do domínio "treinos", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const treinos = new Hono<{ Variables: Vars }>();

const guard = [requireUser, requireProfessional, requireAccess] as const;

type C = Context<{ Variables: Vars }>;

/** Lê e valida o JSON do corpo; 422 com a primeira mensagem do zod. */
async function corpo<T extends z.ZodTypeAny>(c: C, schema: T): Promise<z.infer<T>> {
	let raw: unknown;
	try {
		raw = await c.req.json();
	} catch {
		raw = {};
	}
	const r = schema.safeParse(raw);
	if (!r.success) throw new HTTPException(422, { message: r.error.issues[0]?.message ?? 'Dados inválidos.' });
	return r.data;
}

/** Converte o Resultado de $lib/server/treinos em resposta HTTP. */
function responder<T extends object>(c: C, r: Resultado<T>) {
	if (!r.ok) throw new HTTPException(r.status, { message: r.error });
	const { ok: _ok, ...resto } = r;
	return c.json(resto);
}

function registrar(c: C, action: AuditAction, entityId: string, payload?: Record<string, unknown>) {
	audit({
		action,
		professionalId: c.get('professional').id,
		entityType: 'training_plan',
		entityId,
		payload,
		...clientFingerprint(c.req.raw)
	});
}

const indice = (msg: string) => z.number({ invalid_type_error: msg, required_error: msg }).int(msg).min(0, msg);
const posicao = z.object({
	sessionIdx: indice('Índice de sessão inválido.'),
	block: z.enum(BLOCOS, { errorMap: () => ({ message: 'Bloco inválido.' }) }),
	exerciseIdx: indice('Índice de exercício inválido.')
});
const texto = (max: number) => z.string().max(max, `Máximo de ${max} caracteres.`).optional();

const edicao = posicao.extend({
	name: z.string().trim().min(2, 'Nome do exercício inválido.').max(200),
	sets: z.number().int().nullish(),
	reps: texto(60),
	rest_seconds: z.number().int().nullish(),
	load_guidance: texto(300),
	intensity: texto(120),
	execution_notes: texto(2000),
	cadence: texto(60),
	range_of_motion: texto(120),
	muscle_action: texto(40)
});
const catalogId = z.string().min(1, 'Escolha um exercício do catálogo.');

// ── Lista ──
treinos.get('/treinos', ...guard, async (c) => {
	const plans = await getPlansByProfessional(c.get('professional').id);
	return c.json({ plans });
});

// ── Plano ──
treinos.get('/treinos/:id', ...guard, async (c) => {
	const plan = await getPlanDetail(c.req.param('id'), c.get('professional').id);
	if (!plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
	return c.json({ plan });
});

/** Polling da geração em background. Retorna o planData parcial durante o streaming. */
treinos.get('/treinos/:id/status', ...guard, async (c) => {
	if (!isUuid(c.req.param('id'))) throw new HTTPException(404, { message: 'Plano não encontrado.' });
	const [row] = await db
		.select({
			id: trainingPlans.id,
			status: trainingPlans.status,
			progressPct: trainingPlans.progressPct,
			progressPhase: trainingPlans.progressPhase,
			errorMessage: trainingPlans.errorMessage,
			generatedAt: trainingPlans.generatedAt,
			planData: trainingPlans.planData,
			updatedAt: trainingPlans.updatedAt
		})
		.from(trainingPlans)
		.where(and(eq(trainingPlans.id, c.req.param('id')), eq(trainingPlans.professionalId, c.get('professional').id)))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: 'Plano não encontrado.' });

	// Watchdog: geração parada há mais de 3 min vira failed (sem spinner infinito).
	const stale = await failIfStale(row);
	const status = stale?.status ?? row.status;
	return c.json({
		id: row.id,
		status,
		progress: stale ? 0 : row.progressPct,
		phase: stale ? 'erro' : row.progressPhase,
		error: stale?.errorMessage ?? row.errorMessage,
		generated: status === 'generated' || status === 'published',
		failed: status === 'failed',
		partial: row.planData ?? null
	});
});

/** Busca no catálogo para trocar/adicionar exercício. Confere o plano antes. */
treinos.get('/treinos/:id/catalogo', ...guard, async (c) => {
	const plan = await getPlanDetail(c.req.param('id'), c.get('professional').id);
	if (!plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
	const q = c.req.query('q')?.trim().slice(0, 100) || undefined;
	const { items, total } = await searchExerciseCatalog({ query: q, limit: 40 });
	return c.json({
		total,
		items: items.map((x) => ({
			id: x.id,
			externalId: x.externalId,
			name: x.name,
			bodyPart: x.bodyPart,
			targetMuscle: x.targetMuscle,
			equipment: x.equipment,
			difficulty: x.difficulty,
			hasVideo: Boolean(x.videoUrl)
		}))
	});
});

treinos.post('/treinos/:id/publicar', ...guard, async (c) => {
	const id = c.req.param('id');
	const r = await publishPlan(id, c.get('professional').id);
	if (!r.ok) {
		const status = r.reason === 'plano não encontrado' || r.reason?.includes('não pertence') ? 404 : 409;
		throw new HTTPException(status, { message: r.reason ?? 'Não foi possível publicar.' });
	}
	registrar(c, 'plan.publish', id);
	return c.json({ ok: true });
});

treinos.post('/treinos/:id/arquivar', ...guard, async (c) => {
	const id = c.req.param('id');
	const plan = await getPlanDetail(id, c.get('professional').id);
	if (!plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
	await archivePlan(id, c.get('professional').id);
	registrar(c, 'plan.archive', id);
	return c.json({ ok: true });
});

treinos.post('/treinos/:id/reativar', ...guard, async (c) => {
	const id = c.req.param('id');
	const r = await reativarPlano(id, c.get('professional').id);
	if (r.ok) registrar(c, 'plan.unarchive', id);
	return responder(c, r);
});

treinos.post('/treinos/:id/revalidar', ...guard, async (c) =>
	responder(c, await revalidarPlano(c.req.param('id'), c.get('professional').id))
);

treinos.delete('/treinos/:id', ...guard, async (c) => {
	const id = c.req.param('id');
	const r = await excluirPlano(id, c.get('professional').id);
	if (r.ok) registrar(c, 'plan.delete', id);
	return responder(c, r);
});

// ── Exercícios ──
treinos.patch('/treinos/:id/exercicios', ...guard, async (c) => {
	const b = await corpo(c, edicao);
	return responder(c, await editarExercicio(c.req.param('id'), c.get('professional').id, b));
});

treinos.post('/treinos/:id/exercicios/trocar', ...guard, async (c) => {
	const b = await corpo(c, posicao.extend({ catalogId, keepPrescription: z.boolean().default(true) }));
	return responder(c, await trocarExercicio(c.req.param('id'), c.get('professional').id, b));
});

treinos.post('/treinos/:id/exercicios', ...guard, async (c) => {
	const b = await corpo(c, posicao.omit({ exerciseIdx: true }).extend({ catalogId }));
	return responder(c, await adicionarExercicio(c.req.param('id'), c.get('professional').id, b));
});

treinos.post('/treinos/:id/exercicios/remover', ...guard, async (c) => {
	const b = await corpo(c, posicao);
	return responder(c, await removerExercicio(c.req.param('id'), c.get('professional').id, b));
});

treinos.post('/treinos/:id/exercicios/mover', ...guard, async (c) => {
	const b = await corpo(
		c,
		posicao.extend({ direction: z.enum(['up', 'down'], { errorMap: () => ({ message: 'Direção inválida.' }) }) })
	);
	return responder(c, await moverExercicio(c.req.param('id'), c.get('professional').id, b));
});

treinos.post('/treinos/:id/restricoes/:index/resolver', ...guard, async (c) => {
	const id = c.req.param('id');
	const index = Number(c.req.param('index'));
	const b = await corpo(c, z.object({ resolution: z.enum(['overridden', 'dismissed']).default('overridden') }));
	const r = await resolverRestricao(id, c.get('professional').id, index, b.resolution);
	if (r.ok)
		registrar(c, 'plan.restriction_override', id, {
			restriction: r.restriction.title,
			level: r.restriction.level,
			resolution: b.resolution
		});
	return responder(c, r.ok ? { ok: true } : r);
});

// ── Sessão (detalhe) ──
treinos.get('/treinos/:id/sessoes/:idx', ...guard, async (c) => {
	const plan = await getPlanDetail(c.req.param('id'), c.get('professional').id);
	if (!plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
	const idx = Number(c.req.param('idx'));
	const session = Number.isInteger(idx) ? plan.planData.weekly_sessions?.[idx] : undefined;
	if (!session) throw new HTTPException(404, { message: 'Sessão não encontrada.' });

	const label = session.label ?? `Sessão ${idx + 1}`;
	const nomes = [
		...new Set([...(session.warmup ?? []), ...(session.main ?? []), ...(session.cooldown ?? [])].map((e) => e.name).filter(Boolean))
	];
	const videoMap: Record<string, string> = {};
	const [recentLogs] = await Promise.all([
		getRecentSessionLogs(plan.id, label, 5),
		Promise.all(
			nomes.map(async (n) => {
				const m = await matchCatalogByName(n);
				if (m?.videoUrl) videoMap[n] = m.videoUrl;
			})
		)
	]);
	return c.json({
		plan: { id: plan.id, studentId: plan.studentId, studentName: plan.studentName, sourceMap: plan.sourceMap },
		session,
		idx,
		recentLogs,
		videoMap
	});
});

// ── Impressão ──
treinos.get('/treinos/:id/imprimir', ...guard, async (c) => {
	const pro = c.get('professional');
	const plan = await getPlanDetail(c.req.param('id'), pro.id);
	if (!plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
	const d = await getStudentDetail(plan.studentId, pro.id);
	return c.json({
		plan,
		professional: { name: pro.name, specialty: pro.specialty, cref: pro.cref },
		student: d ? { name: d.student.name, birthDate: d.student.birthDate } : null,
		goals: (d?.preferences?.goals as string[] | null) ?? []
	});
});

// ── Criação (telas em /alunos/:id/gerar e /alunos/:id/manual) ──

/** Contexto clínico do aluno para as telas de criação de plano. */
treinos.get('/alunos/:id/prescricao', ...guard, async (c) => {
	const d = await getStudentDetail(c.req.param('id'), c.get('professional').id);
	if (!d) throw new HTTPException(404, { message: 'Aluno não encontrado.' });
	const hp = d.healthProfile;
	const cota = await cotaGeracoes(c.get('professional'));
	return c.json({
		cota,
		student: { id: d.student.id, name: d.student.name, birthDate: d.student.birthDate },
		diagnoses: ((hp?.diagnoses as { label: string }[] | null) ?? []).map((x) => x.label),
		medications: ((hp?.medications as { name: string; dose?: string }[] | null) ?? []).map(
			(m) => m.name + (m.dose ? ' ' + m.dose : '')
		),
		limitations: ((hp?.injuries as { region: string; notes?: string }[] | null) ?? []).map(
			(i) => i.region + (i.notes ? ' · ' + i.notes : '')
		),
		goals: (d.preferences?.goals as string[] | null) ?? [],
		equipment: d.preferences?.equipmentAvailable ?? [],
		weeklySessions: d.preferences?.weeklySessions ?? null,
		minutesPerSession: d.preferences?.minutesPerSession ?? null
	});
});

/** Dispara a geração por IA e devolve o id; o front faz polling de /treinos/:id/status. */
treinos.post('/alunos/:id/gerar', ...guard, async (c) => {
	const requestStartMs = Date.now();
	const b = await corpo(
		c,
		z.object({
			notes: z.string().max(2000, 'Observações muito longas (máximo 2000 caracteres). Resuma o texto antes de gerar.').optional(),
			equipment: z.array(z.string()).max(20).default([])
		})
	);
	const r = await iniciarGeracao(c.get('professional'), c.req.param('id'), { ...b, requestStartMs });
	return responder(c, r);
});

treinos.post('/alunos/:id/manual', ...guard, async (c) => {
	const b = await corpo(
		c,
		z.object({
			sessions: z.number().int().min(1, 'Escolha de 1 a 7 sessões por semana.').max(7, 'Escolha de 1 a 7 sessões por semana.'),
			minutes: z
				.number()
				.int()
				.min(20, 'A duração da sessão deve ficar entre 20 e 180 minutos.')
				.max(180, 'A duração da sessão deve ficar entre 20 e 180 minutos.'),
			weeks: z.number().int().min(1).max(104).catch(12),
			objective: z.string().max(800).default(''),
			focos: z.array(z.string().max(300)).max(7).default([])
		})
	);
	const pro = c.get('professional');
	const r = await criarPlanoManual(pro.id, c.req.param('id'), b);
	if (r.ok)
		audit({
			action: 'plan.create_manual',
			professionalId: pro.id,
			entityType: 'training_plan',
			entityId: r.planId,
			payload: { sessions: b.sessions, minutes: b.minutes, weeks: b.weeks },
			...clientFingerprint(c.req.raw)
		});
	return responder(c, r);
});

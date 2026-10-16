import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Vars } from '../auth';
import { alunoDevBypass, verifyStudentAccess } from '$lib/server/aluno-token';
import {
	completeStudentSelfFillTx,
	getAlunoAppData,
	getAlunoSelfFillData,
	getAlunoThread,
	getAlunoUnreadCount,
	logTrainingSession,
	postAlunoMessage
} from '$lib/server/queries';
import { getAlunoHistorico, getAlunoSessionVideoMap, getAlunoVideoByCatalogId } from '$lib/server/aluno-app';
import { clamp, parseDecimalBR } from '$lib/server/form-utils';
import { requireAluno, type AlunoVars, type VerificarAcesso } from '../../src/lib/aluno-acesso';
import { duracaoDoTreino, montarExerciseLogs, normalizarPSE } from '../../src/lib/aluno-treino';

/**
 * API do domínio "publico", montada em /api (ver app.ts).
 *
 * App do aluno (/api/aluno/:id/*): SEM sessão Supabase. O dono do recurso é
 * provado pelo token HMAC do link mágico (header `x-aluno-token` ou `?t=`),
 * validado por verifyStudentAccess (comparação em tempo constante contra a
 * versão vigente do link em students.link_token_version). Token ausente,
 * errado ou de versão revogada → 401, sem dizer qual dos três.
 *
 * Nenhuma rota recebe id de conversa, plano ou profissional do cliente: tudo
 * é derivado do studentId já validado (sem superfície de IDOR).
 */
const acessoReal: VerificarAcesso = async (id, token) =>
	(await verifyStudentAccess(id, token)) || alunoDevBypass();

const serie = z.object({ weight: z.string().max(20), reps: z.string().max(20) });
const entradaTreino = z.object({
	exercicios: z
		.array(
			z.object({
				kind: z.enum(['weight', 'bodyweight', 'time']),
				series: z.array(serie).max(30),
				concluido: z.boolean(),
				pct: z.string().max(10)
			})
		)
		.max(60),
	rpe: z.number().nullable(),
	observacoes: z.string().max(4000),
	duracaoMin: z.number()
});

// Aceita só ISO (aaaa-mm-dd) ou vazio: "31/12/1990" estoura na coluna date.
const isoDate = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar no formato AAAA-MM-DD')
	.refine((s) => !Number.isNaN(new Date(s).getTime()), 'data inválida');

const entradaCadastro = z.object({
	birthDate: z.string().max(20),
	weightKg: z.string().max(20),
	heightCm: z.string().max(20),
	phone: z.string().max(40),
	cardiovascularRisk: z.enum(['baixo', 'moderado', 'alto', 'muito_alto']),
	diagnoses: z.string().max(4000),
	medications: z.string().max(4000),
	limitations: z.string().max(4000),
	goals: z.array(z.string().max(60)).min(1, 'selecione ao menos 1 objetivo').max(20),
	weeklySessions: z.number().int().min(1).max(7),
	minutesPerSession: z.number().int().min(15).max(180),
	experienceLevel: z.enum(['iniciante', 'intermediario', 'avancado']),
	prescribedDifficulty: z.enum(['pequena', 'media', 'alta']),
	acceptPrivacy: z.boolean()
});

const lista = (s: string) =>
	s
		.split(/[,\n;]+/)
		.map((x) => x.trim())
		.filter(Boolean);

function invalido(issues: z.ZodIssue[]): never {
	throw new HTTPException(422, {
		message: 'Confira os campos: ' + issues.map((i) => `${i.path.join('.') || 'entrada'} (${i.message})`).join('; ')
	});
}

/** Monta as rotas do aluno. `verificar` é injetável só para o teste. */
export function criarRotasAluno(verificar: VerificarAcesso = acessoReal) {
	const r = new Hono<{ Variables: AlunoVars }>();
	r.use('/aluno/:id/*', requireAluno(verificar));
	r.use('/aluno/:id', requireAluno(verificar));

	// Início: plano, sequência, semana, vídeos e mensagens não lidas.
	r.get('/aluno/:id', async (c) => {
		const id = c.get('alunoId');
		const data = await getAlunoAppData(id);
		if (!data) throw new HTTPException(404, { message: 'Aluno não encontrado.' });
		const [videoByCatalogId, unreadMessages] = await Promise.all([
			getAlunoVideoByCatalogId(data.plan?.planData),
			getAlunoUnreadCount(id)
		]);
		return c.json({
			student: data.student,
			professional: { name: data.professional.name, cref: data.professional.cref },
			plan: data.plan ? { id: data.plan.id, planData: data.plan.planData } : null,
			streakDays: data.streakDays,
			sessionsThisWeek: data.sessionsThisWeek,
			weeklyTarget: data.weeklyTarget,
			videoByCatalogId,
			unreadMessages
		});
	});

	// Execução de uma sessão.
	r.get('/aluno/:id/treino/:idx', async (c) => {
		const data = await getAlunoAppData(c.get('alunoId'));
		if (!data?.plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
		const idx = Number(c.req.param('idx'));
		const session = data.plan.planData.weekly_sessions?.[idx];
		if (!Number.isInteger(idx) || !session) throw new HTTPException(404, { message: 'Sessão não encontrada.' });
		const videoMap = await getAlunoSessionVideoMap(session);
		return c.json({ student: { id: data.student.id, name: data.student.name }, sessionIdx: idx, session, videoMap });
	});

	// Registro do treino (PSE, observação, séries). Mesmas regras da action `complete`.
	r.post('/aluno/:id/treino/:idx', async (c) => {
		const id = c.get('alunoId');
		const parsed = entradaTreino.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) invalido(parsed.error.issues);
		const data = await getAlunoAppData(id);
		if (!data?.plan) throw new HTTPException(404, { message: 'Plano não encontrado.' });
		const idx = Number(c.req.param('idx'));
		const session = data.plan.planData.weekly_sessions?.[idx];
		if (!Number.isInteger(idx) || !session) throw new HTTPException(404, { message: 'Sessão não encontrada.' });

		const exerciseLogs = montarExerciseLogs(session.main ?? [], data.plan.id, idx, parsed.data);
		if (!exerciseLogs.some((e) => e.completed))
			throw new HTTPException(422, { message: 'Marque ao menos um exercício como concluído.' });

		const sessionId = await logTrainingSession({
			studentId: id,
			planId: data.plan.id,
			professionalId: data.professional.id,
			sessionLabel: session.label ?? `Sessão ${idx + 1}`,
			exerciseLogs,
			perceivedEffort: normalizarPSE(parsed.data.rpe),
			durationMinutes: duracaoDoTreino(parsed.data.duracaoMin, session),
			observations: parsed.data.observacoes.trim() || undefined
		});
		return c.json({ ok: true, sessionId }, 201);
	});

	// Auto-preenchimento do cadastro pelo aluno.
	r.get('/aluno/:id/completar', async (c) => {
		const data = await getAlunoSelfFillData(c.get('alunoId'));
		if (!data) throw new HTTPException(404, { message: 'Cadastro não encontrado.' });
		return c.json(data);
	});

	r.post('/aluno/:id/completar', async (c) => {
		const parsed = entradaCadastro.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) invalido(parsed.error.issues);
		const d = parsed.data;
		// LGPD art. 11: dado de saúde exige consentimento explícito do titular.
		if (!d.acceptPrivacy)
			throw new HTTPException(400, { message: 'É preciso aceitar a Política de Privacidade para continuar.' });
		const birth = d.birthDate.trim() || null;
		if (birth && !isoDate.safeParse(birth).success)
			throw new HTTPException(422, { message: 'Data de nascimento inválida.' });

		await completeStudentSelfFillTx({
			studentId: c.get('alunoId'),
			birthDate: birth,
			// "72,5" digitado no celular: parseDecimalBR aceita a vírgula.
			weightKg: clamp(parseDecimalBR(d.weightKg), 20, 400),
			heightCm: clamp(parseDecimalBR(d.heightCm), 100, 250),
			phone: d.phone.trim() || null,
			diagnoses: lista(d.diagnoses).map((label) => ({ label })),
			medications: lista(d.medications).map((name) => ({ name })),
			injuries: lista(d.limitations).map((region) => ({ region })),
			cardiovascularRisk: d.cardiovascularRisk,
			experienceLevel: d.experienceLevel,
			prescribedDifficulty: d.prescribedDifficulty,
			weeklySessions: d.weeklySessions,
			minutesPerSession: d.minutesPerSession,
			goals: d.goals
		});
		return c.json({ ok: true });
	});

	r.get('/aluno/:id/historico', async (c) => {
		const data = await getAlunoHistorico(c.get('alunoId'));
		if (!data) throw new HTTPException(404, { message: 'Aluno não encontrado.' });
		return c.json(data);
	});

	// Conversa 1:1 com o profissional. Abrir marca as dele como lidas.
	r.get('/aluno/:id/mensagens', async (c) => {
		const thread = await getAlunoThread(c.get('alunoId'));
		if (!thread) throw new HTTPException(404, { message: 'Conversa não encontrada.' });
		return c.json({
			professionalName: thread.professionalName,
			messages: thread.messages.map((m) => ({ id: m.id, fromRole: m.fromRole, body: m.body, createdAt: m.createdAt }))
		});
	});

	r.post('/aluno/:id/mensagens', async (c) => {
		const parsed = z
			.object({ body: z.string().trim().min(1, 'escreva uma mensagem').max(2000, 'mensagem muito longa (máx. 2000)') })
			.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) throw new HTTPException(422, { message: parsed.error.issues[0]?.message ?? 'Mensagem inválida.' });
		try {
			const m = await postAlunoMessage(c.get('alunoId'), parsed.data.body);
			return c.json({ id: m.id, fromRole: m.fromRole, body: m.body, createdAt: m.createdAt }, 201);
		} catch {
			throw new HTTPException(404, { message: 'Conversa não encontrada.' });
		}
	});

	// Manifest PWA por aluno: start_url é o link tokenizado, então o ícone
	// instalado abre direto no treino (o global abriria /dashboard → login).
	r.get('/aluno/:id/manifest.webmanifest', (c) => {
		const id = c.get('alunoId');
		const t = c.get('alunoToken');
		const startUrl = `/a/${id}${t ? `?t=${encodeURIComponent(t)}` : ''}`;
		const manifest = {
			name: 'Meu treino',
			short_name: 'Meu treino',
			description: 'Seu treino prescrito no PreceptorFISIC.',
			id: startUrl,
			start_url: startUrl,
			scope: `/a/${id}`,
			display: 'standalone',
			orientation: 'portrait',
			background_color: '#050505',
			theme_color: '#A78BFA',
			lang: 'pt-BR',
			dir: 'ltr',
			icons: [
				{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
				{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
				{ src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
			]
		};
		return c.body(JSON.stringify(manifest), 200, {
			'content-type': 'application/manifest+json',
			// Token na URL: nunca em cache compartilhado.
			'cache-control': 'private, max-age=3600'
		});
	});

	return r;
}

export const publico = new Hono<{ Variables: Vars }>();
publico.route('/', criarRotasAluno());

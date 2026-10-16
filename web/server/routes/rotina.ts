import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { requireAccess, requireProfessional, requireUser, type Vars } from '../auth';
import {
	conversationBelongsTo,
	createAppointment,
	createExercise,
	deleteAppointment,
	deleteExercise,
	getAppointmentById,
	getAppointmentsInRange,
	getCatalogFacets,
	getConversationThreads,
	getExerciseById,
	getExerciseLibrary,
	getMessagesForThread,
	getStudentsByProfessional,
	postMessage,
	searchExerciseCatalog,
	updateAppointment,
	updateExercise
} from '$lib/server/queries';
import { isUuid, toIntInRange } from '$lib/server/validation';
import { parseLocalDateTime, startOfLocalWeek } from '$lib/server/tz';
import { markThreadRead, notifyAppointment, studentBelongsTo, unreadByConversation } from '$lib/server/rotina';

/**
 * API do domínio "rotina" (exercícios, agenda, mensagens), montada em /api.
 * Toda rota confere o dono do recurso pelo professionalId da sessão, como as
 * form actions de src/routes/(app)/{exercicios,agenda,mensagens}.
 */
export const rotina = new Hono<{ Variables: Vars }>();

const guard = [requireUser, requireProfessional, requireAccess] as const;
const CATALOGO_PAGINA = 48;

function corpo<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
	const r = schema.safeParse(raw);
	if (!r.success) throw new HTTPException(422, { message: r.error.issues[0]?.message ?? 'Dados inválidos' });
	return r.data;
}
async function json(c: { req: { json: () => Promise<unknown> } }) {
	try {
		return await c.req.json();
	} catch {
		throw new HTTPException(400, { message: 'Corpo da requisição inválido' });
	}
}

/* ────────── Exercícios ────────── */

const texto = (max: number) => z.string().trim().max(max, `Texto longo demais (máx. ${max})`);
const ExercicioSchema = z.object({
	code: texto(40).optional().default(''),
	name: texto(200).min(1, 'Nome é obrigatório'),
	muscleGroup: texto(80).min(1, 'Grupo muscular é obrigatório'),
	equipment: texto(80).optional().default(''),
	level: texto(40).optional().default(''),
	pattern: texto(40).optional().default(''),
	executionNotes: texto(4000).optional().default(''),
	contraindications: z.array(texto(200)).max(50).optional().default([])
});
const vazioNulo = (s: string) => s || null;

rotina.get('/exercicios/catalogo', ...guard, async (c) => {
	const q = c.req.query('q') || undefined;
	const bodyPart = c.req.query('bp') || undefined;
	const equipment = c.req.query('eq') || undefined;
	const difficulty = c.req.query('diff') || undefined;
	let page = toIntInRange(c.req.query('page') ?? '1', { min: 1, max: 100000, fallback: 1 });
	const busca = (p: number) =>
		searchExerciseCatalog({ query: q, bodyPart, equipment, difficulty, limit: CATALOGO_PAGINA, offset: (p - 1) * CATALOGO_PAGINA });
	let [{ items, total }, facets] = await Promise.all([busca(page), getCatalogFacets()]);
	// Página além do fim (URL antiga, filtro encolheu): volta pra última válida.
	const max = Math.max(1, Math.ceil(total / CATALOGO_PAGINA));
	if (page > max && total > 0) {
		page = max;
		({ items } = await busca(page));
	}
	return c.json({ items, total, facets, page, pageSize: CATALOGO_PAGINA });
});

rotina.get('/exercicios/meus', ...guard, async (c) =>
	c.json({ exercises: await getExerciseLibrary(c.get('professional').id) })
);

rotina.post('/exercicios', ...guard, async (c) => {
	const d = corpo(ExercicioSchema, await json(c));
	const id = await createExercise({
		professionalId: c.get('professional').id,
		code: d.code || undefined,
		name: d.name,
		muscleGroup: d.muscleGroup,
		equipment: d.equipment || undefined,
		level: d.level || undefined,
		pattern: d.pattern || undefined,
		executionNotes: d.executionNotes || undefined,
		contraindications: d.contraindications.filter(Boolean)
	});
	return c.json({ id }, 201);
});

rotina.get('/exercicios/:id', ...guard, async (c) => {
	const ex = await getExerciseById(c.req.param('id'), c.get('professional').id);
	if (!ex) throw new HTTPException(404, { message: 'Exercício não encontrado' });
	return c.json({ exercise: ex });
});

rotina.put('/exercicios/:id', ...guard, async (c) => {
	const pid = c.get('professional').id;
	const id = c.req.param('id');
	if (!(await getExerciseById(id, pid))) throw new HTTPException(404, { message: 'Exercício não encontrado' });
	const d = corpo(ExercicioSchema, await json(c));
	// null (não undefined) para poder LIMPAR o campo na edição.
	await updateExercise({
		exerciseId: id,
		professionalId: pid,
		code: vazioNulo(d.code),
		name: d.name,
		muscleGroup: d.muscleGroup,
		equipment: vazioNulo(d.equipment),
		level: vazioNulo(d.level),
		pattern: vazioNulo(d.pattern),
		executionNotes: vazioNulo(d.executionNotes),
		contraindications: d.contraindications.filter(Boolean)
	});
	return c.json({ ok: true });
});

rotina.delete('/exercicios/:id', ...guard, async (c) => {
	const pid = c.get('professional').id;
	const id = c.req.param('id');
	if (!(await getExerciseById(id, pid))) throw new HTTPException(404, { message: 'Exercício não encontrado' });
	await deleteExercise(id, pid);
	return c.json({ ok: true });
});

/* ────────── Agenda ────────── */

const TIPOS = ['treino', 'avaliacao', 'reabilitacao', 'consulta'] as const;
const SessaoSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data é obrigatória'),
	time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário é obrigatório'),
	studentId: z.string().nullable().optional().default(null),
	type: z.enum(TIPOS, { errorMap: () => ({ message: 'Tipo inválido' }) }),
	duration: z.number({ invalid_type_error: 'Duração inválida' }).int('Duração inválida').min(15, 'Duração mínima de 15 min').max(240, 'Duração máxima de 240 min'),
	label: texto(200).optional().default(''),
	notes: texto(4000).optional().default('')
});
const EdicaoSchema = SessaoSchema.extend({ status: z.enum(['scheduled', 'completed', 'cancelled']) });

/** Valida aluno e data como as actions do SvelteKit. Devolve startsAt (horário de Brasília). */
async function validarSessao(d: z.infer<typeof SessaoSchema>, professionalId: string) {
	const studentId = d.studentId || null;
	if (studentId && !isUuid(studentId)) throw new HTTPException(400, { message: 'Aluno inválido' });
	// Parse em horário de Brasília: o server roda em UTC (C14/C29).
	const startsAt = parseLocalDateTime(`${d.date}T${d.time}`);
	if (!startsAt) throw new HTTPException(422, { message: 'Data inválida' });
	// Ownership: o aluno vem do cliente; confere antes de anexar ou mandar e-mail.
	if (studentId && !(await studentBelongsTo(studentId, professionalId)))
		throw new HTTPException(403, { message: 'Aluno não encontrado' });
	return { studentId, startsAt };
}

const alunosDoProf = async (pid: string) =>
	(await getStudentsByProfessional(pid)).map((s) => ({ id: s.id, name: s.name }));

rotina.get('/agenda', ...guard, async (c) => {
	// ?semana=0 é a atual; -1 a anterior; +1 a próxima. Segunda 00:00 de Brasília.
	const semana = toIntInRange(c.req.query('semana') ?? '0', { min: -104, max: 104, fallback: 0 });
	const start = startOfLocalWeek(new Date(Date.now() + semana * 7 * 86_400_000));
	const end = new Date(start.getTime() + 7 * 86_400_000);
	const appointments = await getAppointmentsInRange(c.get('professional').id, start, end);
	return c.json({ appointments, weekStart: start.toISOString(), weekEnd: end.toISOString(), semana });
});

rotina.get('/agenda/alunos', ...guard, async (c) => c.json({ students: await alunosDoProf(c.get('professional').id) }));

rotina.post('/agenda', ...guard, async (c) => {
	const prof = c.get('professional');
	const d = corpo(SessaoSchema, await json(c));
	const { studentId, startsAt } = await validarSessao(d, prof.id);
	// Typo de ano criaria sessão invisível e e-mail de sessão passada. 24h de folga.
	if (startsAt.getTime() < Date.now() - 24 * 60 * 60 * 1000)
		throw new HTTPException(422, { message: 'A data da sessão está no passado. Confira o ano e o dia.' });
	const id = await createAppointment({
		professionalId: prof.id,
		studentId,
		startsAt,
		durationMinutes: d.duration,
		type: d.type,
		label: d.label || undefined,
		notes: d.notes || undefined
	});
	if (studentId)
		await notifyAppointment({ studentId, professionalName: prof.name, startsAt, durationMinutes: d.duration, type: d.type, label: d.label || null });
	return c.json({ id }, 201);
});

rotina.get('/agenda/:id', ...guard, async (c) => {
	const pid = c.get('professional').id;
	const appt = await getAppointmentById(c.req.param('id'), pid);
	if (!appt) throw new HTTPException(404, { message: 'Sessão não encontrada' });
	return c.json({ appointment: appt, students: await alunosDoProf(pid) });
});

rotina.put('/agenda/:id', ...guard, async (c) => {
	const prof = c.get('professional');
	const id = c.req.param('id');
	const d = corpo(EdicaoSchema, await json(c));
	const { studentId, startsAt } = await validarSessao(d, prof.id);
	// Estado anterior (do banco, não do cliente) para detectar remarcação/cancelamento.
	const before = await getAppointmentById(id, prof.id);
	if (!before) throw new HTTPException(404, { message: 'Sessão não encontrada' });
	await updateAppointment({
		appointmentId: id,
		professionalId: prof.id,
		studentId,
		startsAt,
		durationMinutes: d.duration,
		type: d.type,
		status: d.status,
		label: d.label || null,
		notes: d.notes || null
	});
	const remarcada = d.status === 'scheduled' && before.startsAt.getTime() !== startsAt.getTime();
	const cancelada = d.status === 'cancelled' && before.status !== 'cancelled';
	if ((remarcada || cancelada) && studentId)
		await notifyAppointment({
			studentId,
			professionalName: prof.name,
			startsAt,
			durationMinutes: d.duration,
			type: d.type,
			label: d.label || null,
			variant: cancelada ? 'cancelada' : 'remarcada'
		});
	return c.json({ ok: true, notificado: Boolean((remarcada || cancelada) && studentId) });
});

rotina.delete('/agenda/:id', ...guard, async (c) => {
	const pid = c.get('professional').id;
	const id = c.req.param('id');
	if (!(await getAppointmentById(id, pid))) throw new HTTPException(404, { message: 'Sessão não encontrada' });
	await deleteAppointment(id, pid);
	return c.json({ ok: true });
});

/* ────────── Mensagens ────────── */

rotina.get('/mensagens', ...guard, async (c) => {
	const threads = await getConversationThreads(c.get('professional').id);
	const unread = await unreadByConversation(threads.map((t) => t.id));
	return c.json({ threads: threads.map((t) => ({ ...t, unread: unread.get(t.id) ?? 0 })) });
});

rotina.get('/mensagens/:id', ...guard, async (c) => {
	const pid = c.get('professional').id;
	const id = c.req.param('id');
	// Conversa alheia ou id inválido: 404 (não vaza existência).
	if (!(await conversationBelongsTo(id, pid))) throw new HTTPException(404, { message: 'Conversa não encontrada' });
	return c.json({ messages: await getMessagesForThread(id, pid) });
});

/** Abrir a conversa marca as mensagens do aluno como lidas (como o load do SvelteKit). */
rotina.post('/mensagens/:id/lido', ...guard, async (c) => {
	if (!(await markThreadRead(c.req.param('id'), c.get('professional').id)))
		throw new HTTPException(404, { message: 'Conversa não encontrada' });
	return c.json({ ok: true });
});

rotina.post('/mensagens/:id', ...guard, async (c) => {
	const d = corpo(z.object({ body: texto(4000).min(1, 'Escreva a mensagem') }), await json(c));
	try {
		const m = await postMessage(c.req.param('id'), d.body, 'professional', c.get('professional').id);
		return c.json({ message: m }, 201);
	} catch {
		throw new HTTPException(404, { message: 'Conversa não encontrada' });
	}
});

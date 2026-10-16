import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { requireAdmin, requireProfessional, requireUser, type Vars } from '../auth';
import {
	createLead,
	deleteLead,
	getAllFeedback,
	getAllLeads,
	getLeadById,
	getLeadCountsByStage,
	updateLead,
	updateLeadStage
} from '$lib/server/queries';
import { parseLocalDateTime } from '$lib/server/tz';
import { gerarLinkRecuperacao, listarContasComFranquia, resumirFeedbacks } from '$lib/server/crm';

/**
 * API do domínio "crm" (só admin), montada em /api (ver app.ts).
 * Toda rota passa por requireUser → requireProfessional → requireAdmin: o
 * front esconde o menu, mas quem decide é aqui. Leads são compartilhados
 * entre os admins (não há dono por professionalId), como no SvelteKit.
 */
export const crm = new Hono<{ Variables: Vars }>();

const STAGES = ['visitante', 'cadastrou', 'ativou_aluno', 'trial', 'pagante', 'cancelado', 'perdido'] as const;
const SOURCES = ['instagram', 'indicacao', 'anuncio', 'site', 'whatsapp', 'outro'] as const;

const opcional = z
	.string()
	.trim()
	.max(2000)
	.optional()
	.nullable()
	.transform((v) => (v ? v : null));

const leadBody = z.object({
	name: z.string().trim().min(1, 'nome obrigatório').max(200),
	phone: opcional,
	email: opcional,
	source: z.enum(SOURCES, { errorMap: () => ({ message: 'fonte inválida' }) }).default('outro'),
	stage: z.enum(STAGES, { errorMap: () => ({ message: 'estágio inválido' }) }).default('visitante'),
	notes: opcional,
	/** Valor cru do <input type="datetime-local">, interpretado como horário de Brasília. */
	nextFollowUpAt: z.string().optional().nullable(),
	lostReason: opcional
});

async function corpo<T extends z.ZodTypeAny>(req: { json: () => Promise<unknown> }, schema: T): Promise<z.infer<T>> {
	const raw = await req.json().catch(() => {
		throw new HTTPException(400, { message: 'Corpo inválido' });
	});
	const r = schema.safeParse(raw);
	if (!r.success) throw new HTTPException(422, { message: r.error.issues[0]?.message ?? 'Dados inválidos' });
	return r.data;
}

function ip(h: (n: string) => string | undefined) {
	return h('x-forwarded-for')?.split(',')[0]?.trim() ?? h('x-real-ip') ?? null;
}

crm
	// Painel e funil usam a mesma leitura.
	.get('/crm', requireUser, requireProfessional, requireAdmin, async (c) => {
		const [leads, counts] = await Promise.all([getAllLeads(), getLeadCountsByStage()]);
		return c.json({ leads, counts });
	})
	.post('/crm/leads', requireUser, requireProfessional, requireAdmin, async (c) => {
		const b = await corpo(c.req, leadBody);
		const lead = await createLead({
			name: b.name,
			phone: b.phone,
			email: b.email,
			source: b.source,
			stage: b.stage,
			notes: b.notes,
			nextFollowUpAt: parseLocalDateTime(b.nextFollowUpAt ?? ''),
			professionalId: c.get('professional').id
		});
		return c.json({ id: lead.id }, 201);
	})
	.get('/crm/leads/:id', requireUser, requireProfessional, requireAdmin, async (c) => {
		const lead = await getLeadById(c.req.param('id'));
		if (!lead) throw new HTTPException(404, { message: 'Lead não encontrado' });
		return c.json({ lead });
	})
	.put('/crm/leads/:id', requireUser, requireProfessional, requireAdmin, async (c) => {
		const b = await corpo(c.req, leadBody);
		const updated = await updateLead(c.req.param('id'), {
			name: b.name,
			phone: b.phone,
			email: b.email,
			source: b.source,
			stage: b.stage,
			notes: b.notes,
			nextFollowUpAt: parseLocalDateTime(b.nextFollowUpAt ?? ''),
			lostReason: b.stage === 'perdido' || b.stage === 'cancelado' ? b.lostReason : null
		});
		if (!updated) throw new HTTPException(404, { message: 'Lead não encontrado' });
		return c.json({ ok: true });
	})
	.patch('/crm/leads/:id/estagio', requireUser, requireProfessional, requireAdmin, async (c) => {
		const b = await corpo(c.req, z.object({ stage: z.enum(STAGES, { errorMap: () => ({ message: 'estágio inválido' }) }) }));
		const updated = await updateLeadStage(c.req.param('id'), b.stage);
		if (!updated) throw new HTTPException(404, { message: 'Lead não encontrado' });
		return c.json({ ok: true });
	})
	.delete('/crm/leads/:id', requireUser, requireProfessional, requireAdmin, async (c) => {
		const ok = await deleteLead(c.req.param('id'));
		if (!ok) throw new HTTPException(404, { message: 'Lead não encontrado' });
		return c.json({ ok: true });
	})
	.get('/crm/contas', requireUser, requireProfessional, requireAdmin, async (c) => {
		return c.json({ contas: await listarContasComFranquia() });
	})
	.post('/crm/contas/link', requireUser, requireProfessional, requireAdmin, async (c) => {
		const b = await corpo(c.req, z.object({ email: z.string().max(320) }));
		const origem = c.req.header('origin') || new URL(c.req.url).origin;
		const r = await gerarLinkRecuperacao({
			email: b.email,
			origem,
			adminId: c.get('professional').id,
			ipAddress: ip((n) => c.req.header(n)),
			userAgent: c.req.header('user-agent')?.slice(0, 200) ?? null
		});
		if (!r.ok) throw new HTTPException(r.status, { message: r.error });
		return c.json({ email: r.email, resetUrl: r.resetUrl });
	})
	.get('/crm/feedbacks', requireUser, requireProfessional, requireAdmin, async (c) => {
		return c.json({ feedbacks: await getAllFeedback() });
	})
	.post('/crm/feedbacks/resumo', requireUser, requireProfessional, requireAdmin, async (c) => {
		const r = await resumirFeedbacks();
		if (!r.ok) throw new HTTPException(r.status, { message: r.error });
		return c.json({ summary: r.summary, summarizedCount: r.summarizedCount });
	});

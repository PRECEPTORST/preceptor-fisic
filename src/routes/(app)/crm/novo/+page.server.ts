import { error, fail, redirect } from '@sveltejs/kit';
import {
	createLead,
	getProfessionalByAuthId,
	type LeadSource,
	type LeadStage
} from '$lib/server/queries';
import { parseDateOrNull } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

const VALID_STAGES: LeadStage[] = [
	'visitante',
	'cadastrou',
	'ativou_aluno',
	'trial',
	'pagante',
	'cancelado',
	'perdido'
];
const VALID_SOURCES: LeadSource[] = [
	'instagram',
	'indicacao',
	'anuncio',
	'site',
	'whatsapp',
	'outro'
];

export const load = (async ({ parent }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');
	if (!professional.isAdmin) error(403, 'acesso restrito ao time admin do Preceptor Fisic');
	return {};
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const pro = await getProfessionalByAuthId(locals.user.id);
		if (!pro?.isAdmin) return fail(403, { error: 'acesso restrito' });

		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const phone = String(data.get('phone') ?? '').trim() || null;
		const email = String(data.get('email') ?? '').trim() || null;
		const source = String(data.get('source') ?? 'outro') as LeadSource;
		const stage = String(data.get('stage') ?? 'visitante') as LeadStage;
		const notes = String(data.get('notes') ?? '').trim() || null;
		// Data livre malformada → Invalid Date, que estoura ao serializar no
		// driver (500). parseDateOrNull devolve null se não for data válida.
		const nextFollowUpAt = parseDateOrNull(data.get('nextFollowUpAt'));

		if (!name) return fail(400, { error: 'nome obrigatório', values: { name, phone, email, source, stage, notes } });
		if (!VALID_SOURCES.includes(source)) return fail(400, { error: 'fonte inválida' });
		if (!VALID_STAGES.includes(stage)) return fail(400, { error: 'estágio inválido' });

		const lead = await createLead({
			name,
			phone,
			email,
			source,
			stage,
			notes,
			nextFollowUpAt,
			professionalId: pro.id
		});

		redirect(303, `/crm/${lead.id}`);
	}
};

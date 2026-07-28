import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	getProfessionalByAuthId,
	createProfessional,
	createLeadFromSignup
} from '$lib/server/queries';
import { sendProfessionalWelcome } from '$lib/server/email';
import { normalizeCpfCnpj } from '$lib/server/cpf';
import { TRIAL_DAYS } from '$lib/server/subscription';
import { logger } from '$lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const existing = await getProfessionalByAuthId(locals.user.id);
	if (existing) redirect(303, '/dashboard');
	return {
		email: locals.user.email ?? '',
		suggestedName:
			(locals.user as { user_metadata?: { name?: string; full_name?: string } }).user_metadata
				?.full_name ??
			(locals.user as { user_metadata?: { name?: string; full_name?: string } }).user_metadata
				?.name ??
			''
	};
}) satisfies PageServerLoad;

const SpecialtyEnum = z.enum([
	'prescricao_clinica',
	'treinamento_funcional',
	'reabilitacao',
	'musculacao',
	'personal',
	'pilates',
	'outro'
]);

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'não autenticado' });
		const existing = await getProfessionalByAuthId(locals.user.id);
		// Se já existe, considera sucesso silencioso pra UX (front mostra step 3).
		if (existing) {
			return { success: true, name: existing.name };
		}

		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const cref = String(fd.get('cref') ?? '').trim() || null;
		const specialtyRaw = String(fd.get('specialty') ?? '');
		const cpfRaw = String(fd.get('cpf') ?? '');

		if (name.length < 2) return fail(400, { error: 'nome obrigatório (mínimo 2 caracteres)' });
		const specialty = SpecialtyEnum.safeParse(specialtyRaw);
		if (!specialty.success) return fail(400, { error: 'selecione uma especialidade' });

		// CPF obrigatório: é a chave do "um teste grátis por pessoa" e o que
		// evita pedir o documento de novo na hora de pagar. CREF não serve pro
		// mesmo papel porque quem ainda não se formou não tem.
		const cpfDigits = normalizeCpfCnpj(cpfRaw);
		if (!cpfDigits) {
			return fail(400, { error: 'CPF inválido. Confira os números e tente de novo.', campo: 'cpf' });
		}

		let newProId: string | null = null;
		let trialGranted = false;
		try {
			const created = await createProfessional({
				authUserId: locals.user.id,
				email: locals.user.email ?? '',
				name,
				cref,
				specialty: specialty.data,
				cpfDigits
			});
			newProId = created.id;
			trialGranted = created.trialGranted;
		} catch (e) {
			// Duplo submit: dois POSTs passam no check e o 2º insert estoura a
			// unique de auth_user_id. Se o perfil já existe, é sucesso — não
			// vaza erro cru do Postgres pro usuário.
			const raced = await getProfessionalByAuthId(locals.user.id);
			if (raced) {
				return { success: true, name: raced.name };
			}
			logger.error({ err: String(e).slice(0, 300) }, 'onboarding.create_professional.failed');
			return fail(500, { error: 'Não foi possível criar seu perfil. Tente de novo.' });
		}

		// Sincroniza no CRM admin — cria/atualiza lead no stage 'cadastrou'.
		// Fire-and-forget: falha não bloqueia o onboarding.
		if (newProId) {
			createLeadFromSignup({
				professionalId: newProId,
				name,
				email: locals.user.email ?? ''
			}).catch((err) =>
				logger.error({ err: String(err).slice(0, 200) }, 'crm.lead_from_signup.failed')
			);
		}

		// Welcome email — fire-and-forget. Falha não bloqueia o onboarding.
		const userEmail = locals.user.email;
		if (userEmail) {
			sendProfessionalWelcome({ to: userEmail, name }).catch((err) =>
				logger.error({ err: String(err).slice(0, 200) }, 'professional.welcome.send_failed')
			);
		}

		// Não redireciona — devolve sucesso pra front mostrar step 3 (próximos passos).
		// `trialGranted` false = esse CPF já teve período gratuito, então a tela
		// avisa em vez de prometer 7 dias que não existem.
		return { success: true, name, trialGranted, trialDays: TRIAL_DAYS };
	}
};

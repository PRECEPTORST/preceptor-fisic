import { redirect } from '@sveltejs/kit';
import { getProfessionalByAuthId } from '$lib/server/queries';
import { carregarSessao, rotaLivre } from '$lib/server/sessao';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, url }) => {
	if (!locals.user) {
		// Sem auth (modo design) — devolve null pro layout/páginas tratarem
		return { professional: null, user: null, sidebarCounts: null };
	}

	const professional = await getProfessionalByAuthId(locals.user.id);
	if (!professional) {
		// Auth user existe mas não tem professional record → onboarding
		redirect(303, '/onboarding');
	}

	// Sem assinatura válida, o app fica restrito ao muro (/upgrade), que mora
	// DENTRO da casca do app. hasAccess (no Institucional o membro herda o
	// acesso do dono) e as rotas livres ficam em $lib/server/sessao, que a API
	// do app React (web/server) também usa.
	const { temAcesso, ...sessao } = await carregarSessao(professional, locals.user);
	if (!temAcesso && !rotaLivre(url.pathname)) {
		redirect(303, '/upgrade');
	}

	return sessao;
}) satisfies LayoutServerLoad;

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals, url }) => {
	// Logado → dashboard. Não-logado → renderiza a landing (não redireciona pra /login).
	if (locals.session) redirect(303, '/dashboard');
	// canonical/OG saem da origem real da request — fixar o domínio no markup
	// fazia as tags apontarem pra produção antiga (abandonada), mandando o
	// Google indexar o site congelado em vez deste.
	return { origin: url.origin };
}) satisfies PageServerLoad;

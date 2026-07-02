import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Só POST: logout via GET era vulnerável a CSRF (link/redirect de terceiro
// derrubava a sessão). POST passa pelo check de origin do SvelteKit.
export const POST: RequestHandler = async ({ locals }) => {
	if (locals.supabase) await locals.supabase.auth.signOut();
	redirect(303, '/login');
};

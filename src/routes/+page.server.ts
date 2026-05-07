import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';

const SUPABASE_CONFIGURED = Boolean(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);

export const load: PageServerLoad = async ({ locals }) => {
	if (!SUPABASE_CONFIGURED) redirect(303, '/dashboard');
	if (locals.session) redirect(303, '/dashboard');
	redirect(303, '/login');
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	login: async ({ request, locals }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');

		if (!locals.supabase) {
			return fail(500, { email, error: 'Supabase não configurado. Verifique .env.local.' });
		}
		if (!email || !password) {
			return fail(400, { email, error: 'Preencha email e senha.' });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) return fail(401, { email, error: error.message });

		redirect(303, '/dashboard');
	},

	signup: async ({ request, locals }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');
		const name = String(data.get('name') ?? '');
		const cref = String(data.get('cref') ?? '');

		if (!locals.supabase) {
			return fail(500, { email, error: 'Supabase não configurado. Verifique .env.local.' });
		}
		if (!email || !password || !name) {
			return fail(400, { email, error: 'Preencha nome, email e senha.' });
		}

		const { error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: { data: { name, cref } }
		});
		if (error) return fail(400, { email, error: error.message });

		redirect(303, '/dashboard');
	}
};

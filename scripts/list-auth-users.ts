import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const r = await fetch(`${url}/auth/v1/admin/users?per_page=100`, {
	headers: { Authorization: `Bearer ${svc}`, apikey: svc }
});
const data = (await r.json()) as { users: Array<{ id: string; email?: string; created_at: string; user_metadata?: any }> };
console.log(`\nUsuários no Auth do BR: ${data.users.length}\n`);
console.table(
	data.users.map((u) => ({
		email: u.email ?? '—',
		id: u.id.slice(0, 8) + '…',
		criado: new Date(u.created_at).toLocaleDateString('pt-BR'),
		nome: u.user_metadata?.name ?? '—'
	}))
);

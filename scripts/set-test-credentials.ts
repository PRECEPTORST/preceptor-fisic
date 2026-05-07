/**
 * Confirma email + define senha do usuário matheus@studio.fit no BR
 * pra dar acesso direto sem precisar de password reset por email.
 *
 * Uso pontual — APAGAR depois de testar.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TARGET_EMAIL = 'matheus@studio.fit';
const NEW_PASSWORD = 'Preceptor2026!';

// Buscar o usuário pelo email
const list = await fetch(`${url}/auth/v1/admin/users?per_page=100`, {
	headers: { Authorization: `Bearer ${svc}`, apikey: svc }
});
const data = (await list.json()) as { users: Array<{ id: string; email?: string }> };
const user = data.users.find((u) => u.email === TARGET_EMAIL);
if (!user) {
	console.error(`✗ usuário ${TARGET_EMAIL} não encontrado`);
	process.exit(1);
}
console.log(`✓ encontrado: ${user.email} (${user.id})`);

// Update: confirma email + define senha
const upd = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
	method: 'PUT',
	headers: { Authorization: `Bearer ${svc}`, apikey: svc, 'Content-Type': 'application/json' },
	body: JSON.stringify({
		email_confirm: true,
		password: NEW_PASSWORD
	})
});
if (!upd.ok) {
	console.error(`✗ falhou: ${upd.status} ${await upd.text()}`);
	process.exit(1);
}
console.log(`✓ email confirmado`);
console.log(`✓ senha definida\n`);
console.log(`Login agora: ${TARGET_EMAIL} / ${NEW_PASSWORD}`);

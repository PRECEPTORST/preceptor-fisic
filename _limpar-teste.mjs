import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
const EMAIL = 'teste.banner.novo@example.com';
const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
// Apaga a linha professional primeiro (FK), depois o auth user.
const del = await sql`DELETE FROM professionals WHERE lower(email) = ${EMAIL} RETURNING id`;
console.log('professional removido:', del.length);
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const u = list?.users?.find((x) => x.email?.toLowerCase() === EMAIL);
if (u) { await admin.auth.admin.deleteUser(u.id); console.log('auth user removido:', u.id); }
else console.log('auth user não encontrado (já limpo)');
await sql.end();

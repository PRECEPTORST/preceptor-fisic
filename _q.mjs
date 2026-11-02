import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const supa = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const emails = ['jjjjjj@gmail.com','sdsddds@gmail.com'];
const pros = await sql`select id, auth_user_id, email from professionals where email = any(${emails})`;
const ids = pros.map(p=>p.id);

await sql.begin(async (tx) => {
  for (const t of ['training_plans','students','ai_runs','leads','audit_log']) {
    const r = await tx.unsafe(`delete from ${t} where professional_id = any($1)`, [ids]);
    if (r.count) console.log(` ${t} (por professional): ${r.count}`);
  }
  // eventos de auth ficam gravados por e-mail no payload, sem professional_id
  for (const e of emails) {
    const r = await tx`delete from audit_log where payload::text ilike ${'%'+e+'%'}`;
    if (r.count) console.log(` audit_log (${e}): ${r.count}`);
  }
  const rp = await tx`delete from professionals where id = any(${ids})`;
  console.log(' professionals:', rp.count);
});

const { data:{ users } } = await supa.auth.admin.listUsers({ perPage: 200 });
for (const p of pros) {
  const u = users.find(x=>x.id === p.auth_user_id);
  if (u) { await supa.auth.admin.deleteUser(u.id); console.log(' auth.users:', u.email); }
}

console.log('=== BANCO DEPOIS ===');
console.dir(await sql`select subscription_status, count(*)::int from professionals group by 1 order by 2 desc`, {depth:null});
console.log('=== resta algum cadastro suspeito? ===');
console.dir(await sql`select email, name from professionals
  where email like '%teste%' or email like '%trial.%' or email like '%clinica.%'
     or email like '%jjjj%' or email like '%sdsd%' or email like '%aaaa%'
     or length(name) < 4 or name ~ '(.)\1{3,}'`, {depth:null});
await sql.end();

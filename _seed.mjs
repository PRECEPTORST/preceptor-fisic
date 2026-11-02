import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl:'require', max:1 });
const supa = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

async function conta(email, nome) {
  const { data, error } = await supa.auth.admin.createUser({ email, password:'ClinicaTeste2026!x', email_confirm:true });
  if (error && !/already/i.test(error.message)) throw error;
  const uid = data?.user?.id ?? (await supa.auth.admin.listUsers({perPage:200})).data.users.find(u=>u.email===email).id;
  const [ja] = await sql`select id from professionals where auth_user_id=${uid}`;
  if (ja) return ja.id;
  const [p] = await sql`insert into professionals (auth_user_id, email, name, onboarding_completed,
    subscription_status, subscription_plan, subscription_expires_at)
    values (${uid}, ${email}, ${nome}, true, 'active', 'institucional', now() + interval '30 days')
    returning id`;
  return p.id;
}

const donoId = await conta('clinica.dono@ospreceptores.com','Dona da Clinica');
const membroId = await conta('clinica.membro@ospreceptores.com','Membro da Clinica');

// membro NÃO tem assinatura própria: é o que testa a herança
await sql`update professionals set subscription_status='trial', subscription_plan=null,
  subscription_expires_at = now() - interval '1 day', trial_started_at=null where id=${membroId}`;

const [org] = await sql`insert into organizations (name, owner_professional_id, seats, generations_limit)
  values ('Clínica Teste', ${donoId}, 3, 100) returning id, name, seats`;
await sql`update professionals set organization_id=${org.id} where id=${donoId}`;

console.log('org:', org.id, org.name, 'seats', org.seats);
console.log('dono:', donoId);
console.log('membro (sem assinatura, ainda FORA da org):', membroId);
await sql.end();

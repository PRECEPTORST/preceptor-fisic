import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supa.auth.admin.generateLink({ type: 'recovery', email: 'marco@ospreceptores.com' });
if (error) { console.error('FALHOU:', error.status, error.message); process.exit(1); }
const t = data?.properties?.hashed_token;
if (!t) { console.error('sem hashed_token'); process.exit(1); }
console.log(`https://preceptor-fisic-staging.vercel.app/recuperar/redefinir?token_hash=${encodeURIComponent(t)}&type=recovery`);

import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
// Colunas do audit
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='audit_log' ORDER BY ordinal_position`;
console.log('COLUNAS audit_log:', cols.map(c=>c.column_name).join(', '));
const rows = await sql`
  SELECT action, professional_id, created_at, payload
  FROM audit_log
  WHERE action IN ('auth.login','auth.signup','admin.password_reset_link_generated')
  ORDER BY created_at DESC LIMIT 12`;
console.log('ÚLTIMOS EVENTOS:');
for (const r of rows) console.log(` ${r.created_at?.toISOString?.().slice(0,19) ?? r.created_at} · ${r.action} · prof=${r.professional_id ?? '-'} · ${JSON.stringify(r.payload)?.slice(0,90)}`);
await sql.end();

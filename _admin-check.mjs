import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
const admins = await sql`
  SELECT email, name, is_admin,
         auth_user_id IS NOT NULL AS tem_authid,
         auth_user_id
  FROM professionals WHERE is_admin = true ORDER BY email`;
console.log('ADMINS:', JSON.stringify(admins, null, 1));
// Quantos professionals têm auth_user_id nulo?
const nulos = await sql`SELECT count(*)::int AS n FROM professionals WHERE auth_user_id IS NULL`;
console.log('professionals SEM auth_user_id:', nulos[0].n);
await sql.end();

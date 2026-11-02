import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
const cols = await sql`
  SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name='professionals' AND is_nullable='NO' AND column_default IS NULL
  ORDER BY ordinal_position`;
console.log('OBRIGATÓRIAS (notNull sem default):');
for (const c of cols) console.log('  ' + c.column_name);
await sql.end();

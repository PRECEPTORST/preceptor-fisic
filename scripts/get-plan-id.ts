import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const r = await sql<{ id: string }[]>`SELECT id FROM training_plans WHERE id::text LIKE '113d9777%' LIMIT 1`;
console.log(r[0]?.id);
await sql.end();

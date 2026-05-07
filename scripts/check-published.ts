import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });
const r = await sql<any[]>`SELECT status, published_at FROM training_plans WHERE id = '113d9777-b280-49b4-9123-e5be3fa58c55'`;
console.log(r[0]);
await sql.end();

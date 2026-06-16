import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL is required');
}

// Em serverless (Vercel) cada instância tem seu próprio pool e o runtime
// sobe N instâncias concorrentes sob carga. Com max alto, N × max estoura
// o limite de conexões do pooler do Supabase → erros "too many connections"
// intermitentes (o clássico "do nada deu Internal Server Error"). Por isso
// mantemos pool pequeno por instância. Override via DB_POOL_MAX se rodar
// num runtime persistente (long-running Node) onde um pool maior faz sentido.
const POOL_MAX = Number(env.DB_POOL_MAX ?? '') || 3;

const client = postgres(env.DATABASE_URL, {
	prepare: false,
	max: POOL_MAX,
	idle_timeout: 20,
	// Evita pendurar a request indefinidamente se o pooler estiver saturado:
	// falha rápido com erro tratável em vez de travar a função serverless.
	connect_timeout: 10
});

export const db = drizzle(client, { schema });
export { schema };

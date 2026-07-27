/**
 * Ajuste único dos acessos existentes, na virada do acesso vitalício para
 * assinatura obrigatória.
 *
 * Contexto: `hasActiveSubscription` passou a exigir data de validade. Como
 * nenhuma conta antiga tem essa data, TODAS perderiam acesso de uma vez. Este
 * script aplica a política combinada:
 *
 *   PRESERVAR  time interno e a revisora  → validade longa, seguem usando
 *   PRAZO      cadastros recentes e quem  → +1 dia, pra dar tempo de avisar
 *              já tinha usado a plataforma
 *   ENCERRAR   as demais                  → inactive, só voltam assinando
 *
 * Rode sem argumento para simular. Só grava com `--aplicar`.
 *   npx tsx scripts/ajusta-acessos.ts
 *   npx tsx scripts/ajusta-acessos.ts --aplicar
 */
import 'dotenv/config';
import pg from 'pg';

const APLICAR = process.argv.includes('--aplicar');

/** Time interno e a revisora citada na landing page. */
const PRESERVAR = [
	'matheus@studio.fit',
	'castroomath7@gmail.com',
	'annagsvr@hotmail.com'
];
const PRESERVAR_DOMINIO = '@ospreceptores.com';

/** Cadastros de hoje mais quem já tinha aluno ou geração: ganham 1 dia. */
const PRAZO_1_DIA = [
	'jpedrojesus2016@gmail.com',
	'fernandoluis764@gmail.com',
	'larah.santos74@gmail.com',
	'luizarmandofg@yahoo.com.br',
	'sakaiprof@gmail.com',
	'florianoguilherme015@gmail.com',
	'alexprofms@yahoo.com.br',
	'clayton.educfisica@hotmail.com',
	'jeanmarinho11@hotmail.com'
];

const ANOS_10 = "now() + interval '10 years'";
const UM_DIA = "now() + interval '1 day'";

async function main() {
	const client = new pg.Client({
		connectionString: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL,
		ssl: { rejectUnauthorized: false }
	});
	await client.connect();

	const { rows } = await client.query<{
		id: string;
		email: string;
		status: string;
		expira: Date | null;
		alunos: number;
		geracoes: number;
	}>(`
		select p.id, p.email, p.subscription_status status, p.subscription_expires_at expira,
		       (select count(*) from students s where s.professional_id=p.id and s.deleted_at is null)::int alunos,
		       (select count(*) from ai_runs a where a.professional_id=p.id and a.kind='plan_generation')::int geracoes
		from professionals p order by p.created_at
	`);

	const preservar: typeof rows = [];
	const prazo: typeof rows = [];
	const encerrar: typeof rows = [];

	for (const r of rows) {
		const email = (r.email ?? '').toLowerCase();
		if (PRESERVAR.includes(email) || email.endsWith(PRESERVAR_DOMINIO)) preservar.push(r);
		else if (PRAZO_1_DIA.includes(email)) prazo.push(r);
		else encerrar.push(r);
	}

	const linha = (r: (typeof rows)[number], destino: string) =>
		`  ${r.email.padEnd(34)} ${r.status.padEnd(9)} alunos:${String(r.alunos).padStart(2)} ger:${String(r.geracoes).padStart(2)}  →  ${destino}`;

	console.log(`\n${APLICAR ? '=== APLICANDO ===' : '=== SIMULAÇÃO (nada será gravado) ==='}\n`);
	console.log(`PRESERVAR (${preservar.length}) — validade de 10 anos`);
	preservar.forEach((r) => console.log(linha(r, 'ativo até 2036')));
	console.log(`\nPRAZO DE 1 DIA (${prazo.length}) — expira amanhã`);
	prazo.forEach((r) => console.log(linha(r, 'trial até amanhã')));
	console.log(`\nENCERRAR (${encerrar.length}) — só voltam assinando`);
	encerrar.forEach((r) => console.log(linha(r, 'inactive')));

	if (!APLICAR) {
		console.log('\nSimulação apenas. Para gravar: npx tsx scripts/ajusta-acessos.ts --aplicar\n');
		await client.end();
		return;
	}

	await client.query('BEGIN');
	try {
		const ids = (list: typeof rows) => list.map((r) => r.id);

		const a = await client.query(
			`update professionals set subscription_status='active', subscription_expires_at=${ANOS_10}, updated_at=now() where id = any($1)`,
			[ids(preservar)]
		);
		const b = await client.query(
			`update professionals set subscription_status='trial', subscription_expires_at=${UM_DIA}, updated_at=now() where id = any($1)`,
			[ids(prazo)]
		);
		const c = await client.query(
			`update professionals set subscription_status='inactive', subscription_expires_at=null, updated_at=now() where id = any($1)`,
			[ids(encerrar)]
		);

		await client.query('COMMIT');
		console.log(`\nGravado: ${a.rowCount} preservadas, ${b.rowCount} com prazo, ${c.rowCount} encerradas.\n`);
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('Falhou, nada foi gravado:', err);
		process.exitCode = 1;
	}
	await client.end();
}

main();

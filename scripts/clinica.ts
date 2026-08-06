/**
 * Contrato de clínica (plano Institucional): criar e renegociar.
 *
 * Existe porque vaga e cota de IA são campos SEPARADOS no banco
 * (organizations.seats e organizations.generations_limit). Contratar um
 * profissional a mais sem subir a cota junto faz a clínica inteira dividir o
 * mesmo pool — o time cresce e a capacidade não. Este script mexe nos dois na
 * MESMA transação, pra não existir o caminho onde um é alterado e o outro é
 * esquecido.
 *
 * A regra proporcional sai do próprio contrato base: 5 profissionais para 100
 * gerações, ou seja 20 por profissional. Contrato negociado fora dessa conta
 * usa --geracoes pra fixar o número na mão.
 *
 * Rode sem --aplicar para simular. Nada é gravado sem ele.
 *
 *   npx tsx scripts/clinica.ts listar
 *   npx tsx scripts/clinica.ts criar --nome "Academia X" --dono email@dela.com --profissionais 5
 *   npx tsx scripts/clinica.ts ajustar --clinica "Academia X" --profissionais 8 --aplicar
 */
// .env.local primeiro, igual ao drizzle.config.ts: é onde este projeto guarda a
// conexão. Só `dotenv/config` leria apenas o .env e o script cairia em localhost.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import pg from 'pg';

/** Contrato base do Institucional, de onde sai a proporção. */
const PROFISSIONAIS_BASE = 5;
const GERACOES_BASE = 100;
const GERACOES_POR_PROFISSIONAL = GERACOES_BASE / PROFISSIONAIS_BASE;

const APLICAR = process.argv.includes('--aplicar');

function arg(nome: string): string | undefined {
	const i = process.argv.indexOf(`--${nome}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

function numero(nome: string): number | undefined {
	const bruto = arg(nome);
	if (bruto == null) return undefined;
	const n = Number(bruto);
	if (!Number.isInteger(n) || n < 1) {
		console.error(`--${nome} precisa ser um inteiro positivo (recebi "${bruto}").`);
		process.exit(1);
	}
	return n;
}

type Clinica = {
	id: string;
	name: string;
	seats: number;
	generations_limit: number;
	per_member_generation_cap: number | null;
	dono: string;
	membros: number;
};

async function carregaClinicas(client: pg.Client, filtro?: string): Promise<Clinica[]> {
	// Aceita id ou nome (case-insensitive, parcial) pra não obrigar copiar uuid.
	const { rows } = await client.query<Clinica>(
		`select o.id, o.name, o.seats, o.generations_limit, o.per_member_generation_cap,
		        dono.email as dono,
		        (select count(*)::int from professionals m where m.organization_id = o.id) as membros
		   from organizations o
		   join professionals dono on dono.id = o.owner_professional_id
		  where $1::text is null
		     or o.id::text = $1
		     or o.name ilike '%' || $1 || '%'
		  order by o.name`,
		[filtro ?? null]
	);
	return rows;
}

function mostra(c: Clinica) {
	const porProfissional = (c.generations_limit / c.seats).toFixed(1);
	console.log(`  ${c.name}`);
	console.log(`    id             ${c.id}`);
	console.log(`    administra     ${c.dono}`);
	console.log(`    vagas          ${c.seats} (${c.membros} ocupadas)`);
	console.log(`    gerações/mês   ${c.generations_limit}  (${porProfissional} por profissional)`);
	console.log(`    teto individual ${c.per_member_generation_cap ?? 'sem teto'}`);
}

async function listar(client: pg.Client) {
	const clinicas = await carregaClinicas(client, arg('clinica'));
	if (clinicas.length === 0) {
		console.log('\nNenhuma clínica cadastrada.\n');
		return;
	}
	console.log(`\n${clinicas.length} clínica(s):\n`);
	for (const c of clinicas) {
		mostra(c);
		console.log('');
	}
}

async function criar(client: pg.Client) {
	const nome = arg('nome');
	const donoEmail = arg('dono')?.trim().toLowerCase();
	const profissionais = numero('profissionais') ?? PROFISSIONAIS_BASE;
	const geracoes = numero('geracoes') ?? profissionais * GERACOES_POR_PROFISSIONAL;

	if (!nome || !donoEmail) {
		console.error('Faltou --nome "Academia X" e/ou --dono email@dela.com');
		process.exit(1);
	}

	const { rows } = await client.query<{ id: string; name: string; organization_id: string | null }>(
		'select id, name, organization_id from professionals where email = $1',
		[donoEmail]
	);
	const dono = rows[0];
	if (!dono) {
		console.error(
			`Não existe conta com o e-mail ${donoEmail}. A pessoa precisa criar a conta dela antes — ` +
				'a clínica é vinculada a um profissional existente.'
		);
		process.exit(1);
	}
	if (dono.organization_id) {
		console.error(`${donoEmail} já pertence a uma clínica. Uma conta só participa de uma.`);
		process.exit(1);
	}

	console.log('\nVai criar:\n');
	console.log(`  clínica        ${nome}`);
	console.log(`  administra     ${dono.name} <${donoEmail}>`);
	console.log(`  vagas          ${profissionais}`);
	console.log(
		`  gerações/mês   ${geracoes}  (${(geracoes / profissionais).toFixed(1)} por profissional)`
	);

	if (!APLICAR) {
		console.log('\nSimulação. Rode de novo com --aplicar para gravar.\n');
		return;
	}

	try {
		await client.query('BEGIN');
		const { rows: criada } = await client.query<{ id: string }>(
			`insert into organizations (name, owner_professional_id, seats, generations_limit)
			 values ($1, $2, $3, $4) returning id`,
			[nome, dono.id, profissionais, geracoes]
		);
		const orgId = criada[0]!.id;
		await client.query('update professionals set organization_id = $1, updated_at = now() where id = $2', [
			orgId,
			dono.id
		]);
		await client.query('COMMIT');
		console.log(`\nCriada: ${orgId}`);
		console.log('A pessoa que administra já pode convidar a equipe em /equipe.\n');
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('Falhou, nada foi gravado:', err);
		process.exitCode = 1;
	}
}

async function ajustar(client: pg.Client) {
	const filtro = arg('clinica');
	if (!filtro) {
		console.error('Faltou --clinica "Academia X" (aceita nome parcial ou id).');
		process.exit(1);
	}

	const achadas = await carregaClinicas(client, filtro);
	if (achadas.length === 0) {
		console.error(`Nenhuma clínica encontrada para "${filtro}".`);
		process.exit(1);
	}
	if (achadas.length > 1) {
		console.error(`"${filtro}" bate com ${achadas.length} clínicas. Seja mais específico ou use o id:`);
		for (const c of achadas) console.error(`  ${c.name}  ${c.id}`);
		process.exit(1);
	}
	const c = achadas[0]!;

	const profissionais = numero('profissionais') ?? c.seats;
	// A cota acompanha as vagas por padrão. É esse acoplamento que o script existe
	// pra garantir — sem ele, a equipe cresce e a capacidade fica parada.
	const geracoes = numero('geracoes') ?? profissionais * GERACOES_POR_PROFISSIONAL;

	if (profissionais < c.membros) {
		console.error(
			`A clínica tem ${c.membros} ${c.membros === 1 ? 'profissional' : 'profissionais'} dentro; ` +
				`não dá pra deixar ${profissionais} ${profissionais === 1 ? 'vaga' : 'vagas'}. ` +
				'Remova alguém em /equipe antes de reduzir o contrato.'
		);
		process.exit(1);
	}
	if (c.per_member_generation_cap != null && c.per_member_generation_cap > geracoes) {
		console.error(
			`O teto por profissional (${c.per_member_generation_cap}) ficaria maior que a cota total ` +
				`(${geracoes}). Ajuste o teto em /equipe antes.`
		);
		process.exit(1);
	}

	console.log('\nAntes:\n');
	mostra(c);
	console.log('\nDepois:\n');
	mostra({ ...c, seats: profissionais, generations_limit: geracoes });

	if (profissionais === c.seats && geracoes === c.generations_limit) {
		console.log('\nNada muda com esses valores.\n');
		return;
	}
	if (!APLICAR) {
		console.log('\nSimulação. Rode de novo com --aplicar para gravar.\n');
		return;
	}

	try {
		await client.query('BEGIN');
		// Vaga e cota na mesma instrução: não existe estado intermediário onde uma
		// foi gravada e a outra não.
		await client.query(
			'update organizations set seats = $1, generations_limit = $2, updated_at = now() where id = $3',
			[profissionais, geracoes, c.id]
		);
		await client.query('COMMIT');
		console.log('\nContrato atualizado.\n');
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('Falhou, nada foi gravado:', err);
		process.exitCode = 1;
	}
}

async function main() {
	const comando = process.argv[2];
	if (!comando || !['listar', 'criar', 'ajustar'].includes(comando)) {
		console.log(`
Contrato de clínica (Institucional).

  listar   [--clinica <nome|id>]
  criar    --nome "Academia X" --dono email@dela.com [--profissionais N] [--geracoes N]
  ajustar  --clinica <nome|id> --profissionais N [--geracoes N]

Sem --aplicar, apenas simula.
Sem --geracoes, a cota acompanha as vagas (${GERACOES_POR_PROFISSIONAL} por profissional).
`);
		process.exit(comando ? 1 : 0);
	}

	const client = new pg.Client({
		connectionString: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL,
		ssl: { rejectUnauthorized: false }
	});
	await client.connect();

	if (comando === 'listar') await listar(client);
	else if (comando === 'criar') await criar(client);
	else await ajustar(client);

	await client.end();
}

main();

/**
 * Assinaturas no Asaas: listar e cancelar duplicatas.
 *
 * Existe por causa de um caso real: o primeiro cliente pagante ficou com DUAS
 * assinaturas ativas (clicou em assinar, abandonou a fatura, voltou no dia
 * seguinte e clicou de novo). O código já foi corrigido pra não deixar
 * acontecer de novo — este script serve pra limpar o que ficou pra trás.
 *
 * A trava que importa: por padrão o script RECUSA cancelar assinatura que já
 * teve pagamento confirmado. Cancelar a paga por engano derruba a renovação de
 * um cliente em dia, e as duas parecem idênticas na listagem (mesmo valor,
 * mesmo cliente, mesma descrição). Só a que nunca recebeu pagamento é
 * cancelável sem --forcar.
 *
 * Precisa da ASAAS_API_KEY de produção no ambiente. Ela é sensível na Vercel e
 * não pode ser lida de volta de lá, então tem que vir do .env.local ou da
 * própria variável de ambiente na hora de rodar.
 *
 *   npx tsx scripts/asaas-assinaturas.ts listar --cliente cus_000191740425
 *   npx tsx scripts/asaas-assinaturas.ts cancelar --assinatura sub_xxx
 *   npx tsx scripts/asaas-assinaturas.ts cancelar --assinatura sub_xxx --aplicar
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const APLICAR = process.argv.includes('--aplicar');
const FORCAR = process.argv.includes('--forcar');

function arg(nome: string): string | undefined {
	const i = process.argv.indexOf(`--${nome}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

const KEY = process.env.ASAAS_API_KEY ?? '';
// A chave de produção do Asaas começa com $aact_prod. Qualquer outra coisa é
// sandbox ou placeholder — avisar é melhor que agir no ambiente errado.
const BASE = KEY.includes('_prod')
	? 'https://api.asaas.com/v3'
	: 'https://api-sandbox.asaas.com/v3';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const r = await fetch(BASE + path, {
		...init,
		headers: { access_token: KEY, 'content-type': 'application/json', ...(init?.headers ?? {}) }
	});
	const txt = await r.text();
	if (!r.ok) throw new Error(`${r.status} ${txt.slice(0, 300)}`);
	return txt ? (JSON.parse(txt) as T) : ({} as T);
}

type Sub = { id: string; status: string; value: number; cycle: string; nextDueDate: string; description?: string };
type Pay = { id: string; status: string; value: number; dueDate: string; paymentDate?: string | null };

const PAGO = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);

async function pagamentos(subId: string): Promise<Pay[]> {
	const r = await api<{ data?: Pay[] }>(`/subscriptions/${subId}/payments?limit=50`);
	return r.data ?? [];
}

function resume(s: Sub, pays: Pay[]) {
	const pagos = pays.filter((p) => PAGO.has(p.status));
	console.log(`  ${s.id}`);
	console.log(`    status       ${s.status}  R$${s.value}  ${s.cycle}`);
	console.log(`    proxima      ${s.nextDueDate}`);
	console.log(`    descricao    ${s.description ?? '-'}`);
	console.log(`    pagamentos   ${pays.length} no total, ${pagos.length} confirmado(s)`);
	for (const p of pays)
		console.log(`      ${p.dueDate}  ${String(p.status).padEnd(10)} R$${p.value}${PAGO.has(p.status) ? '  ← PAGO' : ''}`);
	console.log(pagos.length > 0 ? '    ⚠ TEM PAGAMENTO CONFIRMADO — nao cancelar sem certeza\n' : '    ✓ nunca recebeu pagamento\n');
}

async function listar() {
	const cliente = arg('cliente');
	if (!cliente) {
		console.error('Faltou --cliente cus_xxxxx');
		process.exit(1);
	}
	const r = await api<{ data?: Sub[] }>(`/subscriptions?customer=${encodeURIComponent(cliente)}&limit=50`);
	const subs = r.data ?? [];
	if (subs.length === 0) {
		console.log(`\nNenhuma assinatura para ${cliente}.\n`);
		return;
	}
	console.log(`\n${subs.length} assinatura(s) de ${cliente}:\n`);
	for (const s of subs) resume(s, await pagamentos(s.id));
	const ativas = subs.filter((s) => s.status === 'ACTIVE');
	if (ativas.length > 1)
		console.log(`⚠ ${ativas.length} assinaturas ATIVAS no mesmo cliente — isso gera cobranca duplicada.\n`);
}

async function cancelar() {
	const id = arg('assinatura');
	if (!id) {
		console.error('Faltou --assinatura sub_xxxxx');
		process.exit(1);
	}
	const s = await api<Sub>(`/subscriptions/${encodeURIComponent(id)}`);
	const pays = await pagamentos(id);
	console.log('\nAssinatura alvo:\n');
	resume(s, pays);

	const temPago = pays.some((p) => PAGO.has(p.status));
	if (temPago && !FORCAR) {
		console.error(
			'RECUSADO: esta assinatura ja recebeu pagamento confirmado.\n' +
				'Cancelar a assinatura paga derruba a renovacao de um cliente em dia.\n' +
				'Se for mesmo essa, repita com --forcar.'
		);
		process.exit(1);
	}

	if (!APLICAR) {
		console.log('Simulação. Rode de novo com --aplicar para cancelar de verdade.\n');
		return;
	}

	const r = await api<{ deleted?: boolean }>(`/subscriptions/${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	console.log(r.deleted ? `\nCancelada: ${id}\n` : `\nResposta do Asaas: ${JSON.stringify(r)}\n`);
}

async function main() {
	const comando = process.argv[2];
	if (!comando || !['listar', 'cancelar'].includes(comando)) {
		console.log(`
Assinaturas no Asaas.

  listar    --cliente cus_xxxxx
  cancelar  --assinatura sub_xxxxx [--aplicar] [--forcar]

Sem --aplicar, apenas simula.
Assinatura com pagamento confirmado só é cancelada com --forcar.
`);
		process.exit(comando ? 1 : 0);
	}
	if (!KEY) {
		console.error(
			'ASAAS_API_KEY não está no ambiente.\n' +
				'Na Vercel ela é sensível e não pode ser lida de volta — coloque a chave de\n' +
				'produção no .env.local (ou passe na linha de comando) antes de rodar.'
		);
		process.exit(1);
	}
	if (!KEY.includes('_prod'))
		console.log(`\n⚠ A chave não parece de produção. Usando ${BASE}\n`);

	try {
		if (comando === 'listar') await listar();
		else await cancelar();
	} catch (e) {
		console.error('Falhou:', e instanceof Error ? e.message : String(e));
		process.exitCode = 1;
	}
}

main();

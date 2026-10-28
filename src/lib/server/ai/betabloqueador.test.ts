/**
 * O aviso de betabloqueador no prompt. A regra CARD-004 pega depois, na
 * validação, mas avisar antes evita que todo plano desses alunos nasça com
 * uma restrição amarela que o doutor tem que ler e descartar.
 */
import { describe, it, expect } from 'vitest';
import { usaBetabloqueador } from './generator';

describe('usaBetabloqueador', () => {
	const med = (...nomes: string[]) => nomes.map((name) => ({ name }));

	it.each([
		'atenolol 50mg',
		'Metoprolol 25 mg 2x/dia',
		'propranolol',
		'bisoprolol 5mg',
		'nebivolol',
		'sotalol',
		'Carvedilol 6,25mg',
		'labetalol',
		'betabloqueador (nome não informado)'
	])('reconhece %s', (m) => {
		expect(usaBetabloqueador(med(m))).toBe(true);
	});

	it.each(['losartana 50 mg', 'metformina 850 mg', 'sinvastatina 20mg', 'AAS 100mg', 'enalapril'])(
		'não confunde %s',
		(m) => {
			expect(usaBetabloqueador(med(m))).toBe(false);
		}
	);

	it('acha entre vários medicamentos', () => {
		expect(usaBetabloqueador(med('losartana', 'metformina', 'carvedilol'))).toBe(true);
	});

	it('lista vazia, null e item sem nome não quebram', () => {
		expect(usaBetabloqueador([])).toBe(false);
		expect(usaBetabloqueador(null)).toBe(false);
		expect(usaBetabloqueador(undefined)).toBe(false);
		expect(usaBetabloqueador([{}])).toBe(false);
	});
});

describe('sincronia com a regra CARD-004', () => {
	// O padrão vive em dois lugares: aqui (aviso no prompt) e no script que
	// grava a CARD-004 no banco (validação). Divergir faz o plano nascer com
	// zona de FC e só ser pego depois, virando restrição amarela em todo plano.
	it('os dois padrões aceitam e recusam os mesmos medicamentos', async () => {
		const fs = await import('node:fs');
		const script = fs.readFileSync('scripts/regra-betabloqueador.ts', 'utf8');
		// Guloso até o `];` de propósito: parar no primeiro `]` cortaria no meio
		// de uma classe de caracteres como [oai].
		const m = script.match(/const BETABLOQUEADORES = (\[.*\]);/);
		expect(m, 'não achei BETABLOQUEADORES no script').toBeTruthy();
		const padroes = (JSON.parse(m![1]!.replace(/'/g, '"')) as string[]).map(
			(p) => new RegExp(p, 'i')
		);
		const casa = (nome: string) => padroes.some((re) => re.test(nome));

		for (const nome of ['atenolol', 'sotalol', 'carvedilol', 'labetalol', 'nebivolol']) {
			expect(casa(nome), `script deveria pegar ${nome}`).toBe(true);
			expect(usaBetabloqueador([{ name: nome }]), `prompt deveria pegar ${nome}`).toBe(true);
		}
		for (const nome of ['losartana', 'metformina', 'enalapril']) {
			expect(casa(nome), `script não deveria pegar ${nome}`).toBe(false);
			expect(usaBetabloqueador([{ name: nome }]), `prompt não deveria pegar ${nome}`).toBe(false);
		}
	});
});

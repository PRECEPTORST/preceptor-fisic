/**
 * O aviso de isometria no prompt e a regra TEND-003 que cobra isso depois.
 *
 * Protege o mesmo que o teste do treino de potência: os nomes que o prompt
 * MANDA o modelo escrever precisam casar com os padrões que a regra procura.
 * Divergindo, todo plano de tendinopatia nasce com restrição amarela.
 */
import { describe, it, expect } from 'vitest';
import { sessoesComPadrao } from '../clinical/validator';
import type { TrainingPlanOutput } from '$lib/schemas/training-plan';

function padroesDaRegra(): string[] {
	const fs = require('node:fs') as typeof import('node:fs');
	const script = fs.readFileSync('scripts/regras-tendinopatia-isometrico.ts', 'utf8');
	const m = script.match(/const PADROES_ISOMETRICO = (\[[\s\S]*?\]);/);
	expect(m, 'não achei PADROES_ISOMETRICO no script').toBeTruthy();
	return JSON.parse(m![1]!.replace(/'/g, '"').replace(/,\s*\]/, ']')) as string[];
}

const ex = (name: string) => ({
	name,
	muscle_groups: [],
	sets: 5,
	reps: '45 s',
	load_guidance: 'PSE 5',
	execution_notes: 'sustentar'
});

const planoCom = (...nomes: string[]) =>
	({
		weekly_sessions: nomes.map((n, i) => ({
			label: `Treino ${i + 1}`,
			warmup: [],
			main: [ex(n), ex('Leg press 15RM')],
			cooldown: []
		}))
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any as TrainingPlanOutput;

describe('TEND-003 — aviso no prompt casa com a regra', () => {
	const padroes = padroesDaRegra();

	it.each(['Extensão de joelho isométrica', 'Agachamento espanhol'])(
		'o exemplo "%s" é reconhecido',
		(nome) => {
			expect(sessoesComPadrao(planoCom(nome), padroes)).toBe(1);
		}
	);

	it('duas sessões satisfazem o mínimo da regra', () => {
		expect(
			sessoesComPadrao(planoCom('Extensão de joelho isométrica', 'Wall sit unilateral'), padroes)
		).toBe(2);
	});

	it('treino de perna convencional não satisfaz', () => {
		expect(sessoesComPadrao(planoCom('Leg press', 'Cadeira extensora'), padroes)).toBe(0);
	});

	it('cadeira extensora isotônica não conta como isometria: é estágio 2', () => {
		expect(sessoesComPadrao(planoCom('Cadeira extensora 15RM'), padroes)).toBe(0);
	});

	it('acento não atrapalha', () => {
		expect(sessoesComPadrao(planoCom('Extensao de joelho isometrica'), padroes)).toBe(1);
	});

	it('o prompt continua mandando escrever isometria no nome', async () => {
		const fs = await import('node:fs');
		const src = fs.readFileSync('src/lib/server/ai/generator.ts', 'utf8');
		expect(src).toContain('ISOMETRIA DE QUADRÍCEPS OBRIGATÓRIA');
		expect(src).toContain('tendinopatia_patelar');
	});
});

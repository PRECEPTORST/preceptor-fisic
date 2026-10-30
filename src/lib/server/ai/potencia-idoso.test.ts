/**
 * O aviso de treino de potência no prompt e a regra IDOSO-001 que cobra isso
 * depois, na validação.
 *
 * A IDOSO-001 dizia no título "exigir treino de potência 2x/sem" e o rule_dsl
 * só proibia volume acima de 5 sessões semanais: a regra nunca checou potência.
 * Agora checa, e o prompt avisa antes, senão todo plano de idoso frágil nasce
 * com restrição amarela que o doutor tem que ler e descartar.
 *
 * O que este teste protege: os nomes de exercício que o prompt MANDA o modelo
 * escrever precisam casar com os padrões que a regra procura. Se alguém mudar
 * o exemplo no prompt ou os padrões no script, isso quebra aqui em vez de
 * quebrar silenciosamente num plano de verdade.
 */
import { describe, it, expect } from 'vitest';
import { sessoesComPadrao } from '../clinical/validator';
import type { TrainingPlanOutput } from '$lib/schemas/training-plan';

function padroesDaRegra(): string[] {
	const fs = require('node:fs') as typeof import('node:fs');
	const script = fs.readFileSync('scripts/corrige-idoso-001-vol-001.ts', 'utf8');
	// Guloso até o `];` de propósito: parar no primeiro `]` cortaria no meio de
	// uma classe de caracteres como [eê].
	const m = script.match(/const PADROES_POTENCIA = (\[[\s\S]*?\]);/);
	expect(m, 'não achei PADROES_POTENCIA no script').toBeTruthy();
	return JSON.parse(m![1]!.replace(/'/g, '"').replace(/,\s*\]/, ']')) as string[];
}

const ex = (name: string) => ({
	name,
	muscle_groups: [],
	sets: 3,
	reps: '6-8',
	load_guidance: 'PSE 6',
	execution_notes: 'concêntrica rápida, descida em 3s'
});

const planoCom = (...nomes: string[]) =>
	({
		weekly_sessions: nomes.map((n, i) => ({
			label: `Treino ${i + 1}`,
			warmup: [],
			main: [ex(n), ex('Remada baixa')],
			cooldown: []
		}))
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any as TrainingPlanOutput;

describe('IDOSO-001 — aviso no prompt casa com a regra', () => {
	const padroes = padroesDaRegra();

	// Exatamente os exemplos que o prompt do generator manda o modelo escrever.
	it.each(['Leg press de potência', 'Levantar da cadeira com potência'])(
		'o exemplo "%s" é reconhecido pela regra',
		(nome) => {
			expect(sessoesComPadrao(planoCom(nome), padroes)).toBe(1);
		}
	);

	it('"concêntrica rápida" no nome também é reconhecido', () => {
		expect(sessoesComPadrao(planoCom('Agachamento na cadeira, concêntrica rápida'), padroes)).toBe(
			1
		);
	});

	it('duas sessões com potência satisfazem o mínimo da regra', () => {
		const p = planoCom('Leg press de potência', 'Supino de potência');
		expect(sessoesComPadrao(p, padroes)).toBeGreaterThanOrEqual(2);
	});

	it('plano de força convencional não satisfaz', () => {
		expect(sessoesComPadrao(planoCom('Leg press', 'Cadeira extensora'), padroes)).toBe(0);
	});

	it('salto e pliometria não contam: o prompt proíbe e a regra não aceita', () => {
		expect(sessoesComPadrao(planoCom('Salto vertical', 'Pliometria em caixa'), padroes)).toBe(0);
	});

	it('o prompt do generator continua mandando escrever "de potência" no nome', async () => {
		const fs = await import('node:fs');
		const src = fs.readFileSync('src/lib/server/ai/generator.ts', 'utf8');
		expect(src).toContain('TREINO DE POTÊNCIA OBRIGATÓRIO');
		expect(src).toContain('de potência');
		expect(src).toMatch(/idoso_fragil|sarcopenia/);
	});
});

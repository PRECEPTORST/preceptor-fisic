/**
 * Unit tests do validator clínico.
 *
 * Testa as funções puras (filtros + parsers) sem precisar de DB.
 * Pra rodar: `npm test`
 */
import { describe, it, expect } from 'vitest';
import type { TrainingPlanOutput } from '$lib/schemas/training-plan';

// Re-export interno pra testar — ou expor as funções helper se quiser
// testar isoladamente. Por ora testamos via validatePlan que é o entry point.
import { violationToRestriction, type Violation } from './validator';

describe('violationToRestriction', () => {
	it('converte violation forbid_pattern em Restriction com source.type=rule', () => {
		const v: Violation = {
			ruleCode: 'LCA-001',
			ruleTitle: 'Pós-LCA — sem pivô',
			severity: 'red',
			description: 'descrição',
			affectedExercises: ['Salto vertical', 'Corrida com pivô'],
			violationType: 'forbid_pattern',
			details: '2 exercícios violam'
		};
		const r = violationToRestriction(v);
		expect(r.level).toBe('red');
		expect(r.source.type).toBe('rule');
		expect(r.source.rule_code).toBe('LCA-001');
		expect(r.affected_exercises).toEqual(['Salto vertical', 'Corrida com pivô']);
		expect(r.title).toContain('Pós-LCA');
		expect(r.title).toContain('Exercício contraindicado');
	});

	it('forbid_intensity inclui o detalhe da intensidade no description', () => {
		const v: Violation = {
			ruleCode: 'CARD-001',
			ruleTitle: 'Cardiopatia — RPE máx 7',
			severity: 'red',
			description: 'CARD descrição',
			affectedExercises: ['Salto'],
			violationType: 'forbid_intensity',
			details: 'rpe acima de 7 em 1 exercício(s)'
		};
		const r = violationToRestriction(v);
		expect(r.title).toContain('Intensidade acima');
		expect(r.description).toContain('CARD descrição');
		expect(r.description).toContain('rpe acima de 7');
	});

	it('require_clearance vira restriction sem affected exercises', () => {
		const v: Violation = {
			ruleCode: 'CV-RISK-001',
			ruleTitle: 'Alto risco CV',
			severity: 'red',
			description: 'Liberação obrigatória',
			affectedExercises: [],
			violationType: 'require_clearance'
		};
		const r = violationToRestriction(v);
		expect(r.affected_exercises).toEqual([]);
		expect(r.title).toContain('Liberação médica obrigatória');
	});
});

// Notas: testes de integração que dependem do DB (validatePlan completo)
// rodam via scripts/test-validator-via-db.ts e são E2E manuais.
// Aqui ficam só as funções puras 100% determinísticas.

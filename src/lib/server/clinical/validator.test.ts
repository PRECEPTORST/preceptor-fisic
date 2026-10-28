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
import {
	appliesTo,
	prescribedByHr,
	surgeriesWithAge,
	violationToRestriction,
	type ClinicalRuleRow,
	type StudentCtx,
	type Violation
} from './validator';

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

describe('appliesTo — fase pós-operatória (months_since_surgery)', () => {
	// A LCA-001 era vermelha e proibia pivô, salto e pliometria pra QUALQUER
	// aluno pós-LCA: o "≤6m" estava só no título e o rule_dsl não tinha
	// nenhuma condição de tempo. Aluno de nove meses recebia a prescrição
	// correta do guia dos doutores e o plano saía bloqueado.
	const PROC = '(lca|ligamento\s+cruzado|menisc)';

	const regra = (code: string, janela: { gte?: number; lt?: number }): ClinicalRuleRow => ({
		code,
		title: code,
		description: '',
		severity: 'yellow',
		conditionTags: ['lca_pos_cirurgico'],
		ruleDsl: {
			when: {
				condition_tags_any: ['lca_pos_cirurgico'],
				months_since_surgery: { procedure_matches: PROC, ...janela }
			}
		}
	});

	const aluno = (monthsAgo: number | null, procedure = 'Reconstrução de LCA'): StudentCtx => ({
		conditionTags: ['lca_pos_cirurgico'],
		medications: [],
		age: 30,
		cvRisk: 'baixo',
		surgeries: monthsAgo == null ? [] : [{ procedure, monthsAgo }]
	});

	const fase1 = regra('LCA-001', { lt: 6 });
	const fase2 = regra('LCA-002', { gte: 6, lt: 12 });
	const fase3 = regra('LCA-003', { gte: 12 });

	it('aos 3 meses só vale a fase 1', () => {
		expect(appliesTo(fase1, aluno(3))).toBe(true);
		expect(appliesTo(fase2, aluno(3))).toBe(false);
		expect(appliesTo(fase3, aluno(3))).toBe(false);
	});

	it('aos 9 meses a fase 1 NÃO bloqueia mais — era o bug', () => {
		expect(appliesTo(fase1, aluno(9))).toBe(false);
		expect(appliesTo(fase2, aluno(9))).toBe(true);
		expect(appliesTo(fase3, aluno(9))).toBe(false);
	});

	it('aos 18 meses vale a fase 3', () => {
		expect(appliesTo(fase1, aluno(18))).toBe(false);
		expect(appliesTo(fase2, aluno(18))).toBe(false);
		expect(appliesTo(fase3, aluno(18))).toBe(true);
	});

	it('as fases não se sobrepõem em nenhum mês', () => {
		for (const m of [0, 1, 5.9, 6, 6.1, 11.9, 12, 12.1, 24, 60]) {
			const quantas = [fase1, fase2, fase3].filter((r) => appliesTo(r, aluno(m))).length;
			expect(quantas, `${m} meses casou em ${quantas} fases`).toBe(1);
		}
	});

	it('sem data de cirurgia cai na fase mais restritiva, como hoje', () => {
		expect(appliesTo(fase1, aluno(null))).toBe(true);
		expect(appliesTo(fase2, aluno(null))).toBe(false);
		expect(appliesTo(fase3, aluno(null))).toBe(false);
	});

	it('cirurgia de outro tipo não conta como LCA', () => {
		const comApendice = aluno(9, 'Apendicectomia');
		expect(appliesTo(fase1, comApendice)).toBe(true);
		expect(appliesTo(fase2, comApendice)).toBe(false);
	});

	it('reparo de menisco casa, porque o guia trata junto', () => {
		expect(appliesTo(fase2, aluno(9, 'Reparo de menisco medial'))).toBe(true);
	});

	it('vale a cirurgia mais recente quando há mais de uma', () => {
		const revisao: StudentCtx = {
			...aluno(null),
			surgeries: [
				{ procedure: 'Reconstrução de LCA', monthsAgo: 40 },
				{ procedure: 'Revisão de LCA', monthsAgo: 3 }
			]
		};
		expect(appliesTo(fase1, revisao)).toBe(true);
		expect(appliesTo(fase3, revisao)).toBe(false);
	});

	it('regex inválido na regra não derruba a validação do plano', () => {
		const quebrada = regra('LCA-X', { gte: 6 });
		quebrada.ruleDsl.when.months_since_surgery!.procedure_matches = '([';
		expect(() => appliesTo(quebrada, aluno(9))).not.toThrow();
		expect(appliesTo(quebrada, aluno(9))).toBe(false);
	});
});

describe('surgeriesWithAge', () => {
	it('descarta cirurgia sem data em vez de tratar como hoje', () => {
		const r = surgeriesWithAge({ surgeries: [{ procedure: 'LCA' }] } as never);
		expect(r).toEqual([]);
	});

	it('descarta data ilegível e data no futuro', () => {
		const amanha = new Date(Date.now() + 86_400_000).toISOString();
		const r = surgeriesWithAge({
			surgeries: [
				{ procedure: 'LCA', date: 'ontem' },
				{ procedure: 'Menisco', date: amanha }
			]
		} as never);
		expect(r).toEqual([]);
	});

	it('calcula os meses de uma data válida', () => {
		const seisMeses = new Date(Date.now() - 183 * 86_400_000).toISOString();
		const r = surgeriesWithAge({ surgeries: [{ procedure: 'LCA', date: seisMeses }] } as never);
		expect(r).toHaveLength(1);
		expect(r[0]!.monthsAgo).toBeCloseTo(6, 0);
	});
});

describe('prescribedByHr — intensidade prescrita por frequência cardíaca', () => {
	// O guia da Anna: quem usa betabloqueador não pode ter o aeróbio prescrito
	// por FC, porque o remédio achata a resposta e a zona sai errada.
	it.each([
		'FC 110-120 bpm',
		'60-70%FCmáx (150-167bpm)',
		'70% FCR',
		'Karvonen 60-80%',
		'manter na zona de FC 2',
		'FC de reserva 50 a 60%',
		'140 bpm',
		'FC-alvo 130'
	])('pega "%s"', (t) => {
		expect(prescribedByHr(t)).toBe(true);
	});

	it.each([
		'PSE 6-7',
		'Peso corporal',
		'70% 1RM',
		'2-3 kg em cada mão',
		'Teste da fala',
		'Monitorar FC durante a sessão',
		'Acompanhar FC e PA',
		undefined,
		''
	])('não pega "%s"', (t) => {
		expect(prescribedByHr(t)).toBe(false);
	});

	it('monitorar FC não é prescrever por FC — é a distinção da CARD-004', () => {
		expect(prescribedByHr('Monitorar FC')).toBe(false);
		expect(prescribedByHr('FC 130 bpm')).toBe(true);
	});
});

describe('appliesTo — medications_any', () => {
	// Mesmos padrões de scripts/regra-betabloqueador.ts. As barras são DUPLAS:
	// em string JS, '\w' vira só "w" e '\b' vira backspace, e aí a regex não
	// casa com atenolol nenhum.
	const BETA = ['\\w*[oai]lol\\b'];

	const regra: ClinicalRuleRow = {
		code: 'CARD-004',
		title: 'Betabloqueador',
		description: '',
		severity: 'yellow',
		conditionTags: [],
		ruleDsl: { when: { medications_any: BETA }, forbid: { intensity_prescribed_by_hr: true } }
	};

	const comRemedio = (...meds: string[]): StudentCtx => ({
		conditionTags: ['populacao_geral'],
		age: 60,
		cvRisk: 'baixo',
		medications: meds,
		surgeries: []
	});

	it.each([
		'atenolol 50mg',
		'Metoprolol 25 mg 2x/dia',
		'propranolol',
		'bisoprolol',
		'Carvedilol 6,25mg',
		'labetalol'
	])('dispara com %s', (m) => {
		expect(appliesTo(regra, comRemedio(m))).toBe(true);
	});

	it.each(['losartana 50 mg', 'metformina 850 mg', 'sinvastatina', 'AAS 100mg'])(
		'não dispara com %s',
		(m) => {
			expect(appliesTo(regra, comRemedio(m))).toBe(false);
		}
	);

	it('basta um medicamento da lista entre vários', () => {
		expect(appliesTo(regra, comRemedio('losartana', 'metformina', 'atenolol'))).toBe(true);
	});

	it('sem medicamento nenhum, não dispara', () => {
		expect(appliesTo(regra, comRemedio())).toBe(false);
	});

	it('vale pra qualquer aluno, não só cardiopata — a regra não tem tags', () => {
		const hipertenso: StudentCtx = {
			...comRemedio('atenolol'),
			conditionTags: ['hipertensao_estagio_1']
		};
		expect(appliesTo(regra, hipertenso)).toBe(true);
	});

	it('regex inválido não derruba a validação', () => {
		const quebrada: ClinicalRuleRow = {
			...regra,
			ruleDsl: { when: { medications_any: ['(['] } }
		};
		expect(() => appliesTo(quebrada, comRemedio('atenolol'))).not.toThrow();
		expect(appliesTo(quebrada, comRemedio('atenolol'))).toBe(false);
	});
});

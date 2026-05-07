import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { validatePlan, deriveStudentCtxFromHealth } from '../src/lib/server/clinical/validator.js';

// Plano sintético com vários problemas — pra demonstrar detecções
const badPlan: any = {
	summary: 'Plano de teste com violações intencionais.',
	progression_strategy: 'Test progression strategy text long enough to pass min length validation.',
	weekly_sessions: [
		{
			label: 'Treino A · Pliometria',
			focus: 'Potência',
			duration_minutes: 60,
			warmup: [],
			main: [
				{ name: 'Salto pliométrico', sets: 4, reps: '10', rest_seconds: 60, load_guidance: 'RPE 9', muscle_groups: ['quadríceps'], execution_notes: 'pular alto', contraindications: [], source_refs: [] },
				{ name: 'Corrida lateral em pivô', sets: 3, reps: '20m', rest_seconds: 30, load_guidance: 'RPE 8', muscle_groups: ['adutor'], execution_notes: 'mudanças de direção', contraindications: [], source_refs: [] },
				{ name: 'Agachamento com Valsalva 95% 1RM', sets: 5, reps: '3', rest_seconds: 180, load_guidance: '95% 1RM', muscle_groups: ['quadríceps'], execution_notes: 'segurar respiração', contraindications: [], source_refs: [] }
			],
			cooldown: []
		}
	],
	monitoring_parameters: [{ parameter: 'Sensação geral', frequency: 'pós-treino', source_refs: [] }],
	assessment_protocols: [],
	restrictions: []
};

console.log('━ TESTE 1: aluno LCA pós-cirúrgico ━');
const lcaCtx = deriveStudentCtxFromHealth(['lca_pos_cirurgico'], 30, { cardiovascularRisk: 'baixo' } as any);
const v1 = await validatePlan(badPlan, lcaCtx);
console.log(`${v1.length} violações detectadas:`);
for (const v of v1) {
	console.log(`  [${v.severity.toUpperCase()}] ${v.ruleCode} · ${v.violationType}`);
	console.log(`    afetados: ${v.affectedExercises.join(', ') || '(plano todo)'}`);
	console.log(`    detalhes: ${v.details ?? '—'}`);
}

console.log('\n━ TESTE 2: aluno hipertenso ━');
const htaCtx = deriveStudentCtxFromHealth(['hipertensao_estagio_2'], 50, { cardiovascularRisk: 'moderado' } as any);
const v2 = await validatePlan(badPlan, htaCtx);
console.log(`${v2.length} violações detectadas:`);
for (const v of v2) {
	console.log(`  [${v.severity.toUpperCase()}] ${v.ruleCode} · ${v.violationType}`);
	console.log(`    detalhes: ${v.details ?? '—'}`);
}

console.log('\n━ TESTE 3: aluno cardiopata com plano de RPE 9 (proibido > 7) ━');
const cardCtx = deriveStudentCtxFromHealth(['cardiopatia_isquemica'], 60, { cardiovascularRisk: 'alto' } as any);
const v3 = await validatePlan(badPlan, cardCtx);
console.log(`${v3.length} violações detectadas:`);
for (const v of v3) {
	console.log(`  [${v.severity.toUpperCase()}] ${v.ruleCode} · ${v.violationType}`);
	console.log(`    detalhes: ${v.details ?? '—'}`);
}

process.exit(0);

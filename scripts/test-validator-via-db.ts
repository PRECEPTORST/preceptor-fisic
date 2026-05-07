/**
 * Cria temporariamente um plano sintético com violações intencionais,
 * roda re-validate via fetch, vê quantas violações o engine pega,
 * e remove o plano no fim.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const PRO = 'e353b60c-42db-42d5-922e-b0dac8f2c8d2';
const STUDENT_LCA = 'dc02543e-b69a-4a91-bed1-220698bf4b14'; // José Jonas (tem LCA)

const badPlanData = {
	summary: 'Plano TESTE com violações intencionais para verificar o engine de validação clínica.',
	progression_strategy: 'Test progression strategy text long enough to pass min length validation.',
	weekly_sessions: [
		{
			label: 'Treino A · Pliometria',
			focus: 'Potência',
			duration_minutes: 60,
			warmup: [],
			main: [
				{ name: 'Salto pliométrico vertical', sets: 4, reps: '10', rest_seconds: 60, load_guidance: 'RPE 9', muscle_groups: ['quadríceps'], execution_notes: 'saltar com força máxima', contraindications: [], source_refs: [] },
				{ name: 'Corrida com pivô lateral', sets: 3, reps: '20m', rest_seconds: 30, load_guidance: 'RPE 8', muscle_groups: ['adutor'], execution_notes: 'mudanças bruscas', contraindications: [], source_refs: [] },
				{ name: 'Agachamento Valsalva máxima', sets: 5, reps: '3', rest_seconds: 180, load_guidance: '95% 1RM', muscle_groups: ['quadríceps'], execution_notes: 'segurar respiração', contraindications: [], source_refs: [] }
			],
			cooldown: []
		}
	],
	monitoring_parameters: [{ parameter: 'Sensação geral', frequency: 'pós-treino', source_refs: [] }],
	assessment_protocols: [],
	restrictions: []
};

// Insere
console.log('▸ criando plano sintético em status=generated…');
const [inserted] = await sql<{ id: string }[]>`
	INSERT INTO training_plans (student_id, professional_id, status, plan_data, plan_summary, restrictions)
	VALUES (${STUDENT_LCA}, ${PRO}, 'generated', ${badPlanData as any}, ${badPlanData.summary}, '[]'::jsonb)
	RETURNING id
`;
const planId = inserted.id;
console.log(`  plan_id: ${planId}\n`);

// Roda revalidate
console.log('▸ rodando re-validate via API…');
// Fake auth via cookies — assumimos sessão ativa no dev server
const r = await fetch(`http://localhost:5173/planos/${planId}?/revalidate`, {
	method: 'POST',
	body: new FormData(),
	headers: {
		// Pegamos cookies da sessão ativa do dev (preview tab)
		Cookie: process.env.PREVIEW_COOKIE ?? ''
	}
});
console.log(`  status: ${r.status}`);
const body = await r.text();
console.log(`  resp:   ${body.slice(0, 300)}`);

// Lê do banco pra ver as restrictions adicionadas
const [final] = await sql<any[]>`SELECT restrictions FROM training_plans WHERE id = ${planId}`;
console.log(`\n▸ restrições adicionadas pelo validator:`);
const rules = (final.restrictions ?? []).filter((r: any) => r.source?.type === 'rule');
for (const r of rules) {
	console.log(`  [${r.level}] ${r.title}`);
	console.log(`    rule_code: ${r.source.rule_code}`);
	console.log(`    afetados:  ${(r.affected_exercises ?? []).join(', ') || '(plano todo)'}`);
}

// Limpa
await sql`DELETE FROM training_plans WHERE id = ${planId}`;
console.log(`\n✓ plano de teste removido. ${rules.length} violações detectadas pelo engine.`);

await sql.end();

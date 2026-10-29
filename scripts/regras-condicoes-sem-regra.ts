/**
 * Regras para condições que estavam na taxonomia e não tinham regra nenhuma.
 *
 * Eram 19 de 42. O aluno era marcado com a condição, o plano era gerado, e
 * nada checava nada.
 *
 * ── Critério para entrar aqui ──────────────────────────────────────────────
 *
 * Só entra regra que tenha FONTE na base de conhecimento. Rodei as perguntas
 * de cada condição pelo mesmo caminho do RAG e escrevi só onde voltou material
 * clínico de verdade. Inventar limiar (glicemia de corte, carga de tendão,
 * ângulo de amplitude) seria fabricar autoridade, que é exatamente o que
 * derruba o argumento da auditoria.
 *
 * NÃO escrevi, por falta de fonte na base — precisa de documento dos doutores:
 *   diabetes_descompensado   a ADA que temos cobre tratamento de cetoacidose,
 *                            não quando adiar o treino.
 *   dor_lombar_cronica       a busca devolve conteúdo de criança e adolescente;
 *                            não há capítulo de lombalgia indexado.
 *   tendinopatia_patelar     nada na base.
 *   pcd                      nada na base.
 *   doenca_hepatica_*        nada na base.
 *   idoso_robusto            depende de avaliação funcional, não de diagnóstico.
 *   crianca / adolescente    a tag vem da IDADE, não de label — precisa de
 *                            mudança em quem chama a derivação.
 *
 * Idempotente. Uso: tsx scripts/regras-condicoes-sem-regra.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import type { RuleDSL } from '../src/lib/server/db/schema';

const DRY = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, {
	prepare: false
});

const F_AEROBIO = 'Guia de Treinamento Aeróbio — PreceptorFISIC (2026)';
const F_ACSM = 'Diretrizes do ACSM — 10ª edição';
const F_LCA = 'Guia de Reabilitação do LCA e Menisco — PreceptorFISIC (2026)';

type Regra = {
	code: string;
	title: string;
	description: string;
	severity: 'red' | 'yellow';
	tags: string[];
	fontes: string[];
	dsl: RuleDSL;
};

const REGRAS: Regra[] = [
	{
		// O guia da Anna diz isso duas vezes, na seção de IC e na de pós-AVC:
		// "Na presença de fibrilação atrial, usar apenas o esforço percebido,
		// como a PSE (11 a 14 em uma escala de 6 a 20) ou um teste de fala."
		code: 'FA-001',
		title: 'Fibrilação atrial — não prescrever intensidade por frequência cardíaca',
		description:
			'Na fibrilação atrial o ritmo é irregular e a FC não guarda relação estável com o esforço, então zona-alvo por FCmáx, %FCR ou Karvonen não vale. Prescrever por percepção de esforço (PSE 11 a 14 na escala de 6 a 20) ou teste da fala. Monitorar a FC segue indicado como acompanhamento, não como alvo.',
		severity: 'yellow',
		tags: ['fibrilacao_atrial'],
		fontes: [F_AEROBIO, F_ACSM],
		dsl: {
			when: { condition_tags_any: ['fibrilacao_atrial'] },
			forbid: { intensity_prescribed_by_hr: true },
			require: { monitoring: ['PSE'] }
		}
	},
	{
		code: 'PARK-001',
		title: 'Parkinson — FITT e monitoramento por percepção de esforço',
		description:
			'Recomendação FITT do ACSM para doença de Parkinson: aeróbio 3 dias/semana em intensidade moderada (40 a 59% da FCR; PSE 12 a 13 na escala de 6 a 20); resistência 2 a 3 dias/semana; flexibilidade 2 a 3 dias/semana, com prática diária mais eficaz. Usar a PSE para monitorar durante o esforço. Incluir trabalho de controle neuromotor, equilíbrio e tarefas da vida diária.',
		severity: 'yellow',
		tags: ['parkinson_leve', 'parkinson_moderada'],
		fontes: [`${F_ACSM}, p. 603-605`],
		dsl: {
			when: { condition_tags_any: ['parkinson_leve', 'parkinson_moderada'] },
			forbid: { intensity_above: { metric: 'rpe', value: 7 } },
			require: { monitoring: ['PSE', 'equilíbrio'] }
		}
	},
	{
		// Mesma lógica da AVC-001, que já existia: instabilidade postural é o
		// que define o estágio moderado, e queda é o desfecho que importa.
		code: 'PARK-002',
		title: 'Parkinson moderado — equilíbrio com supervisão',
		description:
			'A partir do estágio moderado há instabilidade postural e risco aumentado de queda. Exercícios de equilíbrio e trabalho unipodal exigem supervisão direta e apoio disponível. Progredir equilíbrio antes de aumentar demanda aeróbia.',
		severity: 'yellow',
		tags: ['parkinson_moderada'],
		fontes: [`${F_ACSM}, p. 603-605`],
		dsl: {
			when: { condition_tags_any: ['parkinson_moderada'] },
			forbid: {
				exercise_patterns: ['(?<!supervisionad[oa]\\s)(?:equil[íi]brio|unipodal)\\s+sem\\s+apoio']
			}
		}
	},
	{
		code: 'EM-001',
		title: 'Esclerose múltipla — fadiga e calor',
		description:
			'Separar a fadiga central da EM da fadiga periférica do exercício; acompanhar com instrumento próprio quando houver. Evitar sobreaquecimento, que piora os sintomas de forma transitória: preferir ambiente fresco, hidratar e considerar resfriamento. Atenção a quem restringe líquidos por questões de controle urinário. Ajustar volume nos dias de fadiga em vez de suspender o programa.',
		severity: 'yellow',
		tags: ['esclerose_multipla'],
		fontes: [`${F_ACSM}, p. 591`],
		dsl: {
			when: { condition_tags_any: ['esclerose_multipla'] },
			require: { monitoring: ['fadiga', 'temperatura'] }
		}
	},
	{
		// Quem terminou o tratamento não pode carregar a restrição da ONC-001
		// (PSE ≤ 6), que travaria um sobrevivente saudável na intensidade leve.
		code: 'ONC-002',
		title: 'Pós-câncer — progressão retomada, sem o teto do tratamento ativo',
		description:
			'Sobrevivente fora de tratamento ativo não segue o teto de intensidade da fase de quimio ou radio. Retomar progressão gradual rumo às recomendações gerais de adulto, atento a fadiga relacionada ao câncer, perda de massa e força residuais e sequelas do tratamento (neuropatia, linfedema, cardiotoxicidade). Monitorar fadiga e tolerância entre sessões.',
		severity: 'yellow',
		tags: ['pos_cancer'],
		fontes: [F_ACSM],
		dsl: {
			when: { condition_tags_any: ['pos_cancer'] },
			require: { monitoring: ['fadiga'] }
		}
	},
	{
		code: 'LCA-004',
		title: 'LCA em tratamento conservador — estabilidade antes de pivô',
		description:
			'Sem reconstrução, a estabilidade depende inteiramente do controle neuromuscular. Priorizar força de quadríceps, isquiotibiais e glúteos, controle de valgo dinâmico e propriocepção antes de qualquer gesto de pivô, desaceleração brusca ou mudança de direção. Episódios de falseio, derrame recorrente ou perda de extensão exigem reavaliação. Não é o mesmo protocolo da reconstrução: as fases por tempo de cirurgia (LCA-001 a LCA-003) não se aplicam aqui.',
		severity: 'yellow',
		tags: ['lca_tratamento_conservador'],
		fontes: [F_LCA, 'Lesão de LCA e menisco (Culvenor et al., 2022)'],
		dsl: {
			when: { condition_tags_any: ['lca_tratamento_conservador'] },
			forbid: { exercise_patterns: ['\\bpivô\\b', '\\bpiv[oô]\\b', '\\bcorrida\\s+lateral\\b'] },
			require: { monitoring: ['derrame', 'estabilidade'] }
		}
	},
	{
		code: 'OBE-002',
		title: 'Obesidade grau I e II — volume antes de intensidade',
		description:
			'Baixo nível de aptidão torna difícil sustentar o volume necessário, então a prioridade inicial é acumular volume e aderência, com progressão de duração antes de progressão de intensidade. Relação dose-resposta entre volume e desfecho. Preferir modalidades de menor impacto articular enquanto o peso corporal for a principal sobrecarga.',
		severity: 'yellow',
		tags: ['obesidade_grau_1', 'obesidade_grau_2'],
		fontes: [`${F_ACSM}, p. 501`],
		dsl: {
			when: { condition_tags_any: ['obesidade_grau_1', 'obesidade_grau_2'] },
			forbid: { intensity_above: { metric: 'rpe', value: 8 } }
		}
	}
];

console.log('━ ANTES — condições sem nenhuma regra ativa');
const antes = await sql<Array<{ tag: string }>>`
	SELECT c.tag FROM condition_taxonomy c
	WHERE NOT EXISTS (
		SELECT 1 FROM clinical_rules r, jsonb_array_elements_text(r.condition_tags) t(tag)
		WHERE r.active AND t.tag = c.tag)
	ORDER BY c.tag`;
console.log(`  ${antes.length}: ${antes.map((r) => r.tag).join(', ')}`);

if (DRY) {
	console.log('\n━ FICARIA');
	for (const r of REGRAS) {
		console.log(`  [${r.severity}] ${r.code} — ${r.title}`);
		console.log(`      tags: ${r.tags.join(', ')} · fontes: ${r.fontes.join(' | ')}`);
	}
	console.log('\n--dry-run: nada gravado.');
	await sql.end();
	process.exit(0);
}

// Toda tag citada tem que existir na taxonomia. Foi esse descasamento que
// deixou gestante e DPOC sem disparar por meses.
const todasTags = [...new Set(REGRAS.flatMap((r) => r.tags))];
const existentes = (
	await sql<
		Array<{ tag: string }>
	>`SELECT tag FROM condition_taxonomy WHERE tag = ANY(${sql.array(todasTags)})`
).map((r) => r.tag);
const inexistentes = todasTags.filter((t) => !existentes.includes(t));
if (inexistentes.length > 0) {
	console.error(`\nABORTADO: tags fora da taxonomia: ${inexistentes.join(', ')}`);
	await sql.end();
	process.exit(1);
}

for (const r of REGRAS) {
	await sql`
		INSERT INTO clinical_rules (code, title, description, condition_tags, rule_dsl, severity, source_refs, active)
		VALUES (${r.code}, ${r.title}, ${r.description}, ${sql.json(r.tags)}, ${sql.json(r.dsl)},
		        ${r.severity}::severity, ${sql.json(r.fontes)}, true)
		ON CONFLICT (code) DO UPDATE SET
			title = EXCLUDED.title, description = EXCLUDED.description,
			condition_tags = EXCLUDED.condition_tags, rule_dsl = EXCLUDED.rule_dsl,
			severity = EXCLUDED.severity, source_refs = EXCLUDED.source_refs,
			active = true, version = clinical_rules.version + 1, updated_at = now()`;
	console.log(`✓ ${r.code}`);
}

const [{ n: torto }] = await sql<Array<{ n: number }>>`
	SELECT count(*)::int n FROM clinical_rules WHERE active AND jsonb_typeof(rule_dsl) <> 'object'`;
if (torto > 0) {
	console.error(`\nFALHOU: ${torto} regra(s) com rule_dsl gravado como string`);
	await sql.end();
	process.exit(1);
}

console.log('\n━ DEPOIS — condições sem nenhuma regra ativa');
const depois = await sql<Array<{ tag: string }>>`
	SELECT c.tag FROM condition_taxonomy c
	WHERE NOT EXISTS (
		SELECT 1 FROM clinical_rules r, jsonb_array_elements_text(r.condition_tags) t(tag)
		WHERE r.active AND t.tag = c.tag)
	ORDER BY c.tag`;
console.log(`  ${depois.length}: ${depois.map((r) => r.tag).join(', ')}`);
console.log(
	`\nOK — ${antes.length} → ${depois.length} sem regra. Total: ${(await sql`SELECT count(*)::int n FROM clinical_rules WHERE active`)[0]!.n} regras ativas.`
);
await sql.end();

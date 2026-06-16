/**
 * Schema autoritativo do output da IA pra geração de plano de treino.
 * Usado por `generateObject` — se a IA retorna fora desse formato, retenta automaticamente.
 *
 * NUNCA fazer JSON.parse manual. NUNCA aceitar planos sem source_refs em recomendações críticas.
 */
import { z } from 'zod';

/**
 * chunk_id/source_id ficam como string livre (não z.string().uuid()): no
 * caminho de inference, o modelo legitimamente preenche source_id com uma
 * referência não-UUID (ex: "ACSM 2022"). Exigir UUID fazia o schema
 * rejeitar o plano inteiro com "No object generated: response did not match
 * schema". Quando type=rag_chunk a gente AINDA exige chunk_id presente
 * (regra abaixo) e o consumidor filtra UUIDs reais antes de cruzar com
 * knowledge_chunks.id.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sourceRefSchema = z
	.object({
		type: z.enum(['guideline', 'rag_chunk', 'rule', 'inference']),
		chunk_id: z.string().optional(),
		source_id: z.string().optional(),
		rule_code: z.string().optional(),
		page_number: z.number().int().optional(),
		note: z.string().optional()
	})
	.refine(
		(v) => {
			// Quando declarar rag_chunk, OBRIGATÓRIO ter chunk_id e ser UUID válido —
			// rag_chunk só faz sentido se o id for resolvível em knowledge_chunks.
			if (v.type === 'rag_chunk') return Boolean(v.chunk_id) && UUID_RE.test(v.chunk_id!);
			// Inference precisa de note explicativo.
			if (v.type === 'inference') return Boolean(v.note && v.note.length >= 10);
			// Rule precisa de rule_code.
			if (v.type === 'rule') return Boolean(v.rule_code);
			return true;
		},
		{
			message:
				'rag_chunk requer chunk_id (UUID), inference requer note (>=10 chars), rule requer rule_code'
		}
	);

export const exerciseSchema = z.object({
	// Schema enxuto: cada exercício menor = LLM mais ágil. min(40) em
	// execution_notes forçava parágrafo por exercício, com 20+ exercícios
	// no plano isso somava muito output token. min(10) deixa o modelo ser
	// conciso quando faz sentido (ex: bodyweight simples).
	name: z.string().min(2).max(400),
	/**
	 * external_id do exercise_catalog (ExerciseDB Pro) quando o exercício
	 * foi escolhido do catálogo. Preencher SEMPRE que o nome casar com
	 * algum item disponibilizado no prompt — habilita exibição de vídeo +
	 * instruções traduzidas na ficha do aluno. Pra exercícios fora do
	 * catálogo (custom/aquecimento improvisado), deixar undefined.
	 */
	catalog_id: z.string().regex(/^\d{4,5}$/).optional(),
	muscle_groups: z.array(z.string()).default([]),
	sets: z.number().int().min(1).max(20),
	reps: z.string().min(1).max(200),
	load_guidance: z.string().min(2).max(400),
	rest_seconds: z.number().int().min(0).max(900),
	tempo: z.string().optional(),
	// min baixo de propósito: uma cue clínica curta ("Controle escapular") é
	// válida. min(10) rejeitava o plano INTEIRO por uma nota tersa de 1 dos
	// 20+ exercícios — causa comum de "Geração falhou" sem motivo real.
	execution_notes: z.string().min(3).max(3000),
	contraindications: z.array(z.string()).default([]),
	source_refs: z.array(sourceRefSchema).default([]),

	// ── Campos da ficha de prescrição (modelo impresso). Todos opcionais:
	//    planos antigos continuam válidos; o gerador novo preenche-os.
	/** Coluna "Intensidade" — formato curto de % de carga, ex: "80/60% Máx", "85%", "50/75%". */
	intensity: z.string().max(60).optional(),
	/** Coluna "Séries" quando é esquema (ex: "2/2", "3/3"). Sem isso, usa `sets`. */
	series_label: z.string().max(40).optional(),
	/** Coluna "Cadência" — tempo de execução, ex: "2/2", "1/3". */
	cadence: z.string().max(40).optional(),
	/** Coluna "Ação muscular". */
	muscle_action: z.enum(['isotonica', 'isometrica', 'auxotonico', 'isocinetica']).optional(),
	/** Coluna "Amplitude de movimento", ex: "90°", "Full", "90° de flexão do cotovelo". */
	range_of_motion: z.string().max(120).optional(),
	/** Coluna "Pausa" em texto livre, ex: "40s/1min". Sem isso, formata `rest_seconds`. */
	rest_label: z.string().max(40).optional()
});
export type Exercise = z.infer<typeof exerciseSchema>;

/**
 * Prescrição aeróbia — tabela "Meio · Método · Pausa · Intensidade · Volume"
 * do modelo. Separada das sessões de força (weekly_sessions).
 */
export const aerobicPrescriptionSchema = z.object({
	/** "Meio" — ex: "Esteira", "Corrida na Rua", "Bike". */
	means: z.string().min(2).max(200),
	/** Frequência semanal, ex: "2x semana". Exibida junto do meio. */
	weekly_frequency: z.string().max(60).optional(),
	/** "Método" — ex: "Contínuo", "Intervalado". */
	method: z.string().min(2).max(120),
	/** "Pausa" — ex: "-", "1min". */
	pause: z.string().max(60).default('-'),
	/** "Intensidade" — ex: "60-70%Fcmáx (150-167bpm)". */
	intensity: z.string().min(2).max(200),
	/** "Volume" — ex: "50min", "8km". */
	volume: z.string().min(1).max(120),
	observations: z.string().max(600).optional()
});
export type AerobicPrescription = z.infer<typeof aerobicPrescriptionSchema>;

export const sessionSchema = z.object({
	label: z.string().min(2).max(300),
	day_of_week: z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']).optional(),
	focus: z.string().min(2).max(300),
	duration_minutes: z.number().int().min(15).max(240),
	warmup: z.array(exerciseSchema).default([]),
	main: z.array(exerciseSchema).min(3),
	cooldown: z.array(exerciseSchema).default([]),
	/** Linha "Observações" no rodapé da tabela de força, ex: "Executar até 1-2 reps de reserva." */
	observations: z.string().max(600).optional()
});

export const monitoringParameterSchema = z.object({
	parameter: z.string().min(2).max(200),
	frequency: z.string().min(2).max(300),
	alert_threshold: z.string().optional(),
	source_refs: z.array(sourceRefSchema).default([])
});

export const assessmentProtocolSchema = z.object({
	test_name: z.string().min(2).max(300),
	when: z.string().min(2).max(300),
	source_refs: z.array(sourceRefSchema).default([])
});

export const restrictionSchema = z.object({
	level: z.enum(['red', 'yellow', 'green']),
	title: z.string().min(2).max(400),
	description: z.string().min(20).max(2500),
	affected_exercises: z.array(z.string()).default([]),
	suggestion: z.string().optional(),
	source: sourceRefSchema
});

export const trainingPlanSchema = z.object({
	summary: z.string().min(80).max(2000),
	/** Objetivo do programa em 1-2 frases, exibido na capa da prescrição. */
	objective: z.string().max(800).optional(),
	/** Duração total do programa em semanas (pra calcular o período na capa). Default tratado no consumidor: 16. */
	program_weeks: z.number().int().min(1).max(104).optional(),
	progression_strategy: z.string().min(120).max(3000),
	// Cap em 7 sessões — alinhado à preferência do aluno (1x a 7x/semana).
	// Hobby ainda tem 60s pra gerar tudo, mas com salvamento de partial
	// no abort + schema enxuto (execution_notes.min(10)) o orçamento dá.
	// LLM é instruído via prompt a usar EXATAMENTE weeklySessions, então
	// raramente bate o teto.
	weekly_sessions: z.array(sessionSchema).min(1).max(7),
	/** Prescrição aeróbia (página "Treino Aeróbio" do modelo). */
	aerobic_prescriptions: z.array(aerobicPrescriptionSchema).default([]),
	// Monitoring relaxado pra .default([]) (era min(1)). LLM emite esses
	// campos POR ÚLTIMO; quando aborta no timeout, o partial até as sessões
	// ainda é válido e o plano vai pra `generated` em vez de `failed`.
	monitoring_parameters: z.array(monitoringParameterSchema).default([]),
	assessment_protocols: z.array(assessmentProtocolSchema).default([]),
	restrictions: z.array(restrictionSchema).default([])
});
export type TrainingPlanOutput = z.infer<typeof trainingPlanSchema>;

export const generatePlanInputSchema = z.object({
	notes: z.string().max(2000).optional()
});
export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>;

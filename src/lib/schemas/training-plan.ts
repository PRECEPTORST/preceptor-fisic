/**
 * Schema autoritativo do output da IA pra geração de plano de treino.
 * Usado por `generateObject` — se a IA retorna fora desse formato, retenta automaticamente.
 *
 * NUNCA fazer JSON.parse manual. NUNCA aceitar planos sem source_refs em recomendações críticas.
 */
import { z } from 'zod';

export const sourceRefSchema = z
	.object({
		type: z.enum(['guideline', 'rag_chunk', 'rule', 'inference']),
		chunk_id: z.string().uuid().optional(),
		source_id: z.string().uuid().optional(),
		rule_code: z.string().optional(),
		page_number: z.number().int().optional(),
		note: z.string().optional()
	})
	.refine(
		(v) => {
			// Quando declarar rag_chunk, OBRIGATÓRIO ter chunk_id (UUID exato).
			if (v.type === 'rag_chunk') return Boolean(v.chunk_id);
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
	name: z.string().min(2).max(400),
	muscle_groups: z.array(z.string()).default([]),
	sets: z.number().int().min(1).max(20),
	reps: z.string().min(1).max(200),
	load_guidance: z.string().min(2).max(400),
	rest_seconds: z.number().int().min(0).max(900),
	tempo: z.string().optional(),
	execution_notes: z.string().min(40).max(3000),
	contraindications: z.array(z.string()).default([]),
	source_refs: z.array(sourceRefSchema).default([])
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const sessionSchema = z.object({
	label: z.string().min(2).max(300),
	day_of_week: z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']).optional(),
	focus: z.string().min(2).max(300),
	duration_minutes: z.number().int().min(15).max(240),
	warmup: z.array(exerciseSchema).default([]),
	main: z.array(exerciseSchema).min(3),
	cooldown: z.array(exerciseSchema).default([])
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
	progression_strategy: z.string().min(120).max(3000),
	weekly_sessions: z.array(sessionSchema).min(1).max(7),
	monitoring_parameters: z.array(monitoringParameterSchema).min(1),
	assessment_protocols: z.array(assessmentProtocolSchema).default([]),
	restrictions: z.array(restrictionSchema).default([])
});
export type TrainingPlanOutput = z.infer<typeof trainingPlanSchema>;

export const generatePlanInputSchema = z.object({
	notes: z.string().max(2000).optional()
});
export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>;

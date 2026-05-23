/**
 * Ingest dos exercícios faltantes do exercise_catalog (980/1324 → 1324).
 *
 * Mesma lógica do ingest-exercise-catalog.mjs, mas filtra pros external_ids
 * que NÃO estão no DB e processa só esses. Idempotente.
 *
 * Roda: node scripts/ingest-missing-exercises.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
	console.error('✗ env faltando (SUPABASE/GEMINI)');
	process.exit(1);
}

const JSON_PATH = 'data/exerciseData_complete.json';
const BUCKET = 'exercise-videos';
const BATCH = 20;
const MODEL = process.env.AI_MODEL_FAST ?? 'gemini-2.5-flash';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const google = createGoogleGenerativeAI({ apiKey: GEMINI_KEY });
const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
console.log(`▸ JSON: ${raw.length} exercícios`);

const existing = new Set();
{
	const pageSize = 1000;
	for (let from = 0; ; from += pageSize) {
		const { data, error } = await sb
			.from('exercise_catalog')
			.select('external_id')
			.range(from, from + pageSize - 1);
		if (error) { console.error('✗ erro lendo DB:', error.message); process.exit(1); }
		for (const r of data ?? []) existing.add(r.external_id);
		if (!data || data.length < pageSize) break;
	}
}
console.log(`▸ DB: ${existing.size} já ingeridos`);

const missing = raw.filter((e) => !existing.has(e.id));
console.log(`▸ faltam: ${missing.length}\n`);
if (missing.length === 0) { console.log('✓ nada a fazer.'); process.exit(0); }

const translationSchema = z.object({
	items: z.array(z.object({
		id: z.string(), name: z.string(), description: z.string(), instructions: z.array(z.string())
	}))
});

async function translateBatch(batch) {
	const payload = batch.map((e) => ({
		id: e.id, name: e.name, description: e.description ?? '', instructions: e.instructions ?? []
	}));
	const { object } = await generateObject({
		model: google(MODEL),
		schema: translationSchema,
		system:
			'Você traduz dados de exercícios físicos de inglês para português do Brasil. ' +
			'Use terminologia técnica de educação física brasileira (ex: "barbell" = "barra", ' +
			'"dumbbell" = "halter", "cable" = "polia/cabo", "deadlift" = "levantamento terra", ' +
			'"squat" = "agachamento", "bench press" = "supino"). Mantenha o id EXATO. ' +
			'Traduza name, description e cada item de instructions. Tom: instrutivo, claro, ' +
			'direto. Sem emoji. Mantenha números de passo se houver.',
		prompt:
			'Traduza estes exercícios pra PT-BR, devolvendo o mesmo array com id intacto:\n\n' +
			JSON.stringify(payload),
		maxRetries: 2,
		abortSignal: AbortSignal.timeout(60_000)
	});
	return object.items;
}

let translated = 0, upserted = 0, failed = 0;
const startMs = Date.now();

for (let i = 0; i < missing.length; i += BATCH) {
	const batch = missing.slice(i, i + BATCH);
	const trMap = new Map();
	try {
		const tr = await translateBatch(batch);
		for (const t of tr) trMap.set(t.id, t);
		translated += tr.length;
	} catch (err) {
		console.error(`\n  ✗ tradução batch ${i}: ${String(err).slice(0, 200)}`);
		for (const e of batch) trMap.set(e.id, { id: e.id, name: e.name, description: e.description ?? '', instructions: e.instructions ?? [] });
	}
	const rows = batch.map((e) => {
		const t = trMap.get(e.id) ?? {};
		return {
			external_id: e.id,
			name: t.name ?? e.name,
			name_en: e.name,
			body_part: e.bodyPart,
			target_muscle: e.target,
			secondary_muscles: e.secondaryMuscles ?? [],
			equipment: e.equipment ?? null,
			difficulty: e.difficulty ?? null,
			category: e.category ?? null,
			instructions: t.instructions ?? e.instructions ?? [],
			instructions_en: e.instructions ?? [],
			description: t.description ?? e.description ?? null,
			video_url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${e.id}.mp4`
		};
	});
	const { error } = await sb.from('exercise_catalog').upsert(rows, { onConflict: 'external_id' });
	if (error) { failed += rows.length; console.error(`\n  ✗ upsert batch ${i}: ${error.message}`); }
	else upserted += rows.length;
	const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
	process.stdout.write(`\r  ${Math.min(i + BATCH, missing.length)}/${missing.length} · ${translated} trad · ${upserted} DB · ${elapsed}s   `);
}

console.log(`\n\n✓ ${upserted} ingeridos, ${failed} falhas`);

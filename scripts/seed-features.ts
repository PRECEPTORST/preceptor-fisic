/**
 * Seed das 3 features novas: exercise_library, messages, appointments.
 * Idempotente — usa ON CONFLICT DO NOTHING quando possível.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL_DIRECT!, { prepare: false });

const PRO_EMAIL = 'matheus@studio.fit';
const [pro] = await sql<{ id: string }[]>`SELECT id FROM professionals WHERE email = ${PRO_EMAIL} LIMIT 1`;
if (!pro) {
	console.error('✗ professional não encontrado');
	process.exit(1);
}
const proId = pro.id;
console.log(`▸ professional: ${proId}\n`);

const studentRows = await sql<{ id: string; name: string }[]>`SELECT id, name FROM students WHERE professional_id = ${proId} ORDER BY created_at LIMIT 10`;
console.log(`  alunos: ${studentRows.length}\n`);

// ────────── EXERCISE LIBRARY ──────────
console.log('▸ exercise_library…');
const EXERCISES = [
	{ code: 'EX001', name: 'Agachamento livre', muscle: 'Membros inferiores', equip: 'Barra', level: 'avancado', pattern: 'Squat' },
	{ code: 'EX002', name: 'Agachamento goblet', muscle: 'Membros inferiores', equip: 'Halter', level: 'iniciante', pattern: 'Squat' },
	{ code: 'EX003', name: 'Leg press 45°', muscle: 'Membros inferiores', equip: 'Máquina', level: 'intermediario', pattern: 'Squat' },
	{ code: 'EX004', name: 'Cadeira extensora', muscle: 'Membros inferiores', equip: 'Máquina', level: 'iniciante', pattern: 'Isolado' },
	{ code: 'EX005', name: 'Mesa flexora', muscle: 'Membros inferiores', equip: 'Máquina', level: 'iniciante', pattern: 'Isolado' },
	{ code: 'EX006', name: 'Stiff com barra', muscle: 'Posterior', equip: 'Barra', level: 'intermediario', pattern: 'Hinge' },
	{ code: 'EX007', name: 'Bom dia', muscle: 'Posterior', equip: 'Barra', level: 'avancado', pattern: 'Hinge' },
	{ code: 'EX008', name: 'Levantamento terra', muscle: 'Posterior', equip: 'Barra', level: 'avancado', pattern: 'Hinge' },
	{ code: 'EX009', name: 'Supino reto', muscle: 'Peito', equip: 'Barra', level: 'intermediario', pattern: 'Push' },
	{ code: 'EX010', name: 'Supino inclinado halteres', muscle: 'Peito', equip: 'Halter', level: 'intermediario', pattern: 'Push' },
	{ code: 'EX011', name: 'Crucifixo no banco', muscle: 'Peito', equip: 'Halter', level: 'iniciante', pattern: 'Isolado' },
	{ code: 'EX012', name: 'Remada curvada', muscle: 'Costas', equip: 'Barra', level: 'intermediario', pattern: 'Pull' },
	{ code: 'EX013', name: 'Puxada alta frente', muscle: 'Costas', equip: 'Polia', level: 'iniciante', pattern: 'Pull' },
	{ code: 'EX014', name: 'Remada baixa neutra', muscle: 'Costas', equip: 'Polia', level: 'iniciante', pattern: 'Pull' },
	{ code: 'EX015', name: 'Desenvolvimento militar', muscle: 'Ombros', equip: 'Barra', level: 'avancado', pattern: 'Push' },
	{ code: 'EX016', name: 'Elevação lateral', muscle: 'Ombros', equip: 'Halter', level: 'iniciante', pattern: 'Isolado' },
	{ code: 'EX017', name: 'Prancha frontal', muscle: 'Core', equip: 'Peso corporal', level: 'iniciante', pattern: 'Anti-ext' },
	{ code: 'EX018', name: 'Dead bug', muscle: 'Core', equip: 'Peso corporal', level: 'iniciante', pattern: 'Anti-ext' },
	{ code: 'EX019', name: 'Pallof press', muscle: 'Core', equip: 'Polia', level: 'intermediario', pattern: 'Anti-rot' },
	{ code: 'EX020', name: 'Mobilidade · cat-cow', muscle: 'Mobilidade', equip: 'Solo', level: 'iniciante', pattern: 'Mob' }
];
for (const ex of EXERCISES) {
	await sql`
		INSERT INTO exercise_library (professional_id, code, name, muscle_group, equipment, level, pattern, uses)
		VALUES (${proId}, ${ex.code}, ${ex.name}, ${ex.muscle}, ${ex.equip}, ${ex.level}, ${ex.pattern}, ${Math.floor(Math.random() * 200) + 50})
		ON CONFLICT DO NOTHING
	`;
}
const [exCount] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM exercise_library WHERE professional_id = ${proId}`;
console.log(`  exercise_library: ${exCount!.n}\n`);

// ────────── CONVERSATIONS + MESSAGES ──────────
console.log('▸ conversations + messages…');
for (const s of studentRows) {
	const [conv] = await sql<{ id: string }[]>`
		INSERT INTO conversations (professional_id, student_id, last_message_at, unread_count)
		VALUES (${proId}, ${s.id}, now(), ${Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0})
		ON CONFLICT (professional_id, student_id) DO UPDATE SET last_message_at = excluded.last_message_at
		RETURNING id
	`;
	if (!conv) continue;

	const sample = [
		{ role: 'student', body: 'Boa tarde, professor!', at: 'now() - interval \'10 min\'' },
		{ role: 'student', body: 'Acabei o treino. Fiz 3x12 conforme combinado.', at: 'now() - interval \'9 min\'' },
		{ role: 'student', body: 'Mas senti que tava bem leve, quase 18 reps na última.', at: 'now() - interval \'9 min\'' },
		{ role: 'student', body: 'Posso aumentar a carga?', at: 'now() - interval \'8 min\'' }
	];
	for (const m of sample) {
		await sql.unsafe(
			`INSERT INTO messages (conversation_id, from_role, body, created_at) VALUES ('${conv.id}', '${m.role}', $1, ${m.at})`,
			[m.body]
		);
	}
}
const [mCount] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.professional_id = ${proId}`;
console.log(`  messages: ${mCount!.n}\n`);

// ────────── APPOINTMENTS ──────────
console.log('▸ appointments…');
const now = new Date();
const today9 = new Date(now);
today9.setHours(9, 0, 0, 0);

if (studentRows[0] && studentRows[1]) {
	const slots = [
		{ student: studentRows[0].id, start: new Date(today9), dur: 60, type: 'treino', label: 'Treino A · Push' },
		{ student: studentRows[1].id, start: new Date(today9.getTime() + 90 * 60_000), dur: 60, type: 'avaliacao', label: 'Avaliação física' },
		{ student: studentRows[0].id, start: new Date(today9.getTime() + 24 * 60 * 60_000), dur: 60, type: 'treino', label: 'Treino B · Pull' },
		{ student: studentRows[1].id, start: new Date(today9.getTime() + 24 * 60 * 60_000 + 90 * 60_000), dur: 60, type: 'reabilitacao', label: 'Reabilitação · LCA' },
		{ student: studentRows[0].id, start: new Date(today9.getTime() + 2 * 24 * 60 * 60_000), dur: 60, type: 'treino', label: 'Treino C · Legs' }
	];
	for (const slot of slots) {
		await sql`
			INSERT INTO appointments (professional_id, student_id, starts_at, duration_minutes, type, label, status)
			VALUES (${proId}, ${slot.student}, ${slot.start}, ${slot.dur}, ${slot.type}, ${slot.label}, 'scheduled')
			ON CONFLICT DO NOTHING
		`;
	}
}
const [aCount] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM appointments WHERE professional_id = ${proId}`;
console.log(`  appointments: ${aCount!.n}\n`);

console.log('✅ seed concluído.');
await sql.end();

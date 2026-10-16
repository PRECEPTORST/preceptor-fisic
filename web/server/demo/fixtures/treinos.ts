// Fixtures do modo demo do domínio "treinos". Chave "MÉTODO /caminho" (aceita :param). Dados fictícios.
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const ex = (name: string, mg: string[], sets = 3, reps = '8-12', extra: Record<string, unknown> = {}) => ({
	name,
	muscle_groups: mg,
	sets,
	reps,
	rest_seconds: 60,
	source_refs: [],
	...extra
});

const planData = {
	summary: 'Treino de força em 3 sessões para hipertrofia com cuidado no joelho direito (condromalácia leve).',
	objective: 'Promover hipertrofia preservando a articulação do joelho.',
	program_weeks: 12,
	restrictions: [
		{
			level: 'red',
			title: 'Agachamento profundo com dor patelar',
			description: 'Evitar flexão de joelho acima de 90° com carga enquanto houver dor.',
			affected_exercises: ['Agachamento livre'],
			source: { type: 'rule', rule_code: 'R07' }
		},
		{
			level: 'yellow',
			title: 'Hipertensão controlada',
			description: 'Evitar manobra de Valsalva; monitorar PSE.',
			affected_exercises: [],
			source: { type: 'rag_chunk', chunk_id: 'c1' }
		}
	],
	weekly_sessions: [
		{
			label: 'Treino A · Inferiores',
			focus: 'Membros inferiores e core',
			day_of_week: 'seg',
			duration_minutes: 60,
			warmup: [ex('Bicicleta ergométrica', ['cardio'], 1, '8 min')],
			main: [
				ex('Agachamento livre', ['quadríceps', 'glúteos'], 4, '8-10', { load_guidance: 'PSE 7', catalog_id: '0043' }),
				ex('Cadeira flexora', ['isquiotibiais']),
				ex('Elevação pélvica', ['glúteos'], 3, '12')
			],
			cooldown: [ex('Alongamento de quadríceps', ['quadríceps'], 1, '30s')]
		},
		{
			label: 'Treino B · Superiores',
			focus: 'Empurrar e puxar',
			day_of_week: 'qua',
			duration_minutes: 55,
			main: [ex('Supino reto com halteres', ['peitoral', 'tríceps'], 4, '8-12', { intensity: '70% 1RM' }), ex('Remada baixa', ['dorsais', 'bíceps'])]
		}
	],
	aerobic_prescriptions: [
		{ means: 'Caminhada', weekly_frequency: '2x', method: 'Contínuo', intensity: 'PSE 4-5', volume: '30 min' }
	]
};

const sourceMap = {
	c1: { chunkId: 'c1', sourceId: 's1', title: 'Exercise and hypertension position stand', organization: 'acsm', year: 2019, pageNumber: 12, excerpt: 'Resistance training is recommended at moderate intensity avoiding breath holding.' }
};
const catalogMap = {
	'0043': { externalId: '0043', name: 'Agachamento livre', nameEn: 'barbell squat', videoUrl: null, instructions: ['Pés na largura dos ombros.', 'Desça até 90°.'], bodyPart: 'pernas', targetMuscle: 'quadríceps', equipment: 'barra', difficulty: 'intermediate' }
};

const plano = (id: string, status: string) => ({
	id,
	studentName: 'Carla Mendes',
	studentId: 'demo-3',
	status,
	isActive: status === 'published' || status === 'generated',
	createdAt: dias(-3),
	publishedAt: status === 'published' ? dias(-2) : null,
	planData,
	sourceMap,
	catalogMap
});

const lista = [
	['plano-1', 'Carla Mendes', 'demo-3', 'generated', 3],
	['plano-2', 'Ana Paula Souza', 'demo-1', 'published', 4],
	['plano-3', 'Bruno Lima', 'demo-2', 'generating', 0],
	['plano-4', 'Diego Rocha', 'demo-4', 'archived', 3],
	['plano-5', 'Elisa Prado', 'demo-5', 'failed', 0]
].map(([id, studentName, studentId, status, sessionsTotal], i) => ({
	id,
	title: `Plano de ${studentName}`.slice(0, 80),
	description: null,
	studentName,
	studentId,
	status,
	isActive: status === 'published' || status === 'generated',
	createdAt: dias(-i * 9),
	publishedAt: null,
	sessionsTotal
}));

const statusDe = (path: string) => String(lista.find((p) => path.includes(`/${p.id}`))?.status ?? "generated");
const ok = { ok: true, validation: { violations: 0, bySeverity: {}, rules: [] } };

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
	'GET /treinos': { plans: lista },
	'GET /treinos/:id/status': (p: string) => ({
		id: 'plano-3',
		status: 'generating',
		progress: (Math.floor(Date.now() / 1000) * 7) % 95,
		phase: 'montando sessões',
		error: null,
		generated: false,
		failed: false,
		partial: { summary: planData.summary, weekly_sessions: planData.weekly_sessions.slice(0, 1), path: p }
	}),
	'GET /treinos/:id/catalogo': {
		total: 3,
		items: [
			{ id: 'cat-1', externalId: '0043', name: 'Leg press 45°', bodyPart: 'pernas', targetMuscle: 'quadríceps', equipment: 'máquina', difficulty: 'beginner', hasVideo: true },
			{ id: 'cat-2', externalId: '0044', name: 'Agachamento no banco', bodyPart: 'pernas', targetMuscle: 'quadríceps', equipment: 'peso corporal', difficulty: 'beginner', hasVideo: false },
			{ id: 'cat-3', externalId: '0045', name: 'Cadeira extensora', bodyPart: 'pernas', targetMuscle: 'quadríceps', equipment: 'máquina', difficulty: 'beginner', hasVideo: true }
		]
	},
	'GET /treinos/:id/sessoes/:idx': {
		plan: { id: 'plano-1', studentId: 'demo-3', studentName: 'Carla Mendes', sourceMap },
		session: planData.weekly_sessions[0],
		idx: 0,
		recentLogs: [
			{ id: 'l1', sessionDate: dias(-2), sessionLabel: 'Treino A · Inferiores', perceivedEffort: 7, exercisesDone: [{ name: 'Agachamento livre', sets_done: 4, load_used: '40kg', reps_done: '10', intensity_used: 65 }] }
		],
		videoMap: {}
	},
	'GET /treinos/:id/imprimir': {
		plan: plano('plano-2', 'published'),
		professional: { name: 'Profissional Demo', specialty: 'prescricao_clinica', cref: '000000-G/SP' },
		student: { name: 'Carla Mendes', birthDate: '1992-03-14' },
		goals: ['hipertrofia']
	},
	'GET /treinos/:id': (p: string) => ({ plan: plano(p.split('/').pop() ?? 'plano-1', statusDe(p)) }),
	'POST /treinos/:id/revalidar': { validation: { violations: 1, bySeverity: { high: 1 }, rules: ['R07'] } },
	'POST /treinos/:id/exercicios/trocar': { ...ok, newName: 'Leg press 45°' },
	'POST /treinos/:id/exercicios': { ...ok, newName: 'Cadeira extensora' },
	'POST /treinos/:id/:acao': ok,
	'POST /treinos/:id/exercicios/:acao': ok,
	'POST /treinos/:id/restricoes/:index/resolver': {},
	'PATCH /treinos/:id/exercicios': ok,
	'DELETE /treinos/:id': {},
	'GET /alunos/:id/prescricao': {
		student: { id: 'demo-3', name: 'Carla Mendes', birthDate: '1992-03-14' },
		diagnoses: ['Hipertensão arterial', 'Condromalácia patelar'],
		medications: ['Losartana 50mg'],
		limitations: ['Joelho direito · dor ao agachar'],
		goals: ['hipertrofia'],
		equipment: ['dumbbell', 'leverage machine'],
		cota: { usado: 7, limite: 30 },
		weeklySessions: 3,
		minutesPerSession: 60
	},
	'POST /alunos/:id/gerar': { planId: 'plano-3' },
	'POST /alunos/:id/manual': { planId: 'plano-1' }
};

// Fixtures do modo demo do domínio "publico" (app do aluno). Dados fictícios.
// Abra /a/demo-aluno?t=demo com VITE_DEMO=1.
const ID = 'demo-aluno';
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const ex = (name: string, sets: number, reps: string, extra: Record<string, unknown> = {}) => ({
	name,
	sets,
	reps,
	rest_seconds: 60,
	load_guidance: 'PSE 6-7',
	muscle_groups: ['quadríceps'],
	execution_notes: 'Desça controlando, joelho alinhado com a ponta do pé.',
	contraindications: [],
	source_refs: [],
	...extra
});

const sessoes = [
	{
		label: 'Treino A · Inferiores',
		focus: 'Força de membros inferiores',
		day_of_week: 'seg',
		duration_minutes: 50,
		main: [
			ex('Agachamento no smith', 3, '8-12', { intensity: '70% Máx' }),
			ex('Leg press 45°', 3, '10'),
			ex('Prancha', 3, '30s', { muscle_groups: ['core'], contraindications: ['Pare se sentir dor lombar'] })
		]
	},
	{
		label: 'Treino B · Superiores',
		focus: 'Empurrar e puxar',
		day_of_week: 'qua',
		duration_minutes: 45,
		main: [ex('Remada baixa', 3, '12'), ex('Supino com halteres', 3, '10'), ex('Flexão de braço', 2, '8')]
	},
	{
		label: 'Treino C · Condicionamento',
		focus: 'Circuito leve',
		day_of_week: 'sex',
		duration_minutes: 40,
		main: [ex('Bicicleta ergométrica', 1, '10 min'), ex('Afundo', 3, '10'), ex('Elevação pélvica', 3, '12')]
	}
];

const planData = {
	summary: 'Plano de 8 semanas',
	restrictions: [
		{ level: 'yellow', title: 'Hipertensão controlada', description: 'Evite prender a respiração (Valsalva) nas séries.', affected_exercises: [] },
		{ level: 'red', title: 'Dor no joelho direito', description: 'Pare o agachamento se a dor passar de 3 em 10.', affected_exercises: [] }
	],
	weekly_sessions: sessoes
};

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
	'GET /aluno/:id': {
		student: { id: ID, name: 'Marina Costa', weightKg: 64, heightCm: 165 },
		professional: { name: 'Rafael Prado', cref: 'CREF 012345-G/SP' },
		plan: { id: 'demo-plano', planData },
		streakDays: 4,
		sessionsThisWeek: 2,
		weeklyTarget: 3,
		videoByCatalogId: {},
		unreadMessages: 1
	},
	'GET /aluno/:id/treino/:idx': (path: string) => {
		const idx = Number(path.split('/').pop()) || 0;
		return {
			student: { id: ID, name: 'Marina Costa' },
			sessionIdx: idx,
			session: sessoes[idx] ?? sessoes[0],
			videoMap: {}
		};
	},
	'POST /aluno/:id/treino/:idx': { ok: true, sessionId: 'demo-sessao' },
	'GET /aluno/:id/completar': {
		student: { id: ID, name: 'Marina Costa', birthDate: '1992-03-14', profileCompletedAt: null },
		professional: { name: 'Rafael Prado' },
		healthProfile: { diagnoses: [{ label: 'hipertensão' }], medications: [], injuries: [{ region: 'joelho direito' }], cardiovascularRisk: 'moderado' },
		preferences: { goals: ['forca'], weeklySessions: 3, minutesPerSession: 50, experienceLevel: 'intermediario', prescribedDifficulty: 'media' }
	},
	'POST /aluno/:id/completar': { ok: true },
	'GET /aluno/:id/historico': {
		student: { id: ID, name: 'Marina Costa' },
		total: 3,
		sessions: [
			{ id: 'h1', sessionDate: dias(0), sessionLabel: 'Treino A · Inferiores', perceivedEffort: 7, observations: 'Joelho tranquilo hoje.', exercisesDone: [{ completed: true }, { completed: true }, { completed: true }] },
			{ id: 'h2', sessionDate: dias(-2), sessionLabel: 'Treino C · Condicionamento', perceivedEffort: 6, observations: null, exercisesDone: [{ completed: true }, { completed: false }, { completed: true }] },
			{ id: 'h3', sessionDate: dias(-5), sessionLabel: 'Treino B · Superiores', perceivedEffort: null, observations: null, exercisesDone: [] }
		]
	},
	'GET /aluno/:id/mensagens': {
		professionalName: 'Rafael Prado',
		messages: [
			{ id: 'm1', fromRole: 'professional', body: 'Oi, Marina! Como foi o treino de segunda?', createdAt: dias(-1) },
			{ id: 'm2', fromRole: 'student', body: 'Foi bem, senti só um pouco o joelho no agachamento.', createdAt: dias(-1) }
		]
	},
	'POST /aluno/:id/mensagens': { id: 'm3', fromRole: 'student', body: 'Mensagem enviada (demo)', createdAt: dias(0) }
};

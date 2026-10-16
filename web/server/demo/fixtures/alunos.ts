// Fixtures do modo demo do domínio "alunos". Chave "MÉTODO /caminho" (aceita :param). Dados fictícios.
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const base = [
	['Ana Paula Souza', 'Hipertrofia', 'hipertrofia', true, 92, 3, 1, 'feminino'],
	['Bruno Lima', 'Emagrecimento', 'emagrecimento', true, 40, 4, 6, 'masculino'],
	['Carla Mendes', 'Reabilitação', 'reabilitacao', true, 75, 3, 2, 'feminino'],
	['Diego Rocha', 'Cardio', 'condicionamento_cardiovascular', false, 0, null, null, 'masculino'],
	['Elisa Prado', 'Hipertrofia', 'hipertrofia', true, 100, 5, 0, 'feminino']
] as const;

const lista = base.map(([name, goal, , planActive, adherence, weeklyTarget, daysSinceLast, sex], i) => ({
	id: `demo-${i + 1}`,
	name,
	birthDate: `19${88 - i}-05-10`,
	age: 38 - i,
	sex,
	weightKg: 70 + i,
	heightCm: 170,
	goal,
	planTitle: planActive ? `Plano ${goal}` : null,
	planActive,
	weeklyTarget,
	adherence,
	sessions7: weeklyTarget ? Math.round((adherence / 100) * weeklyTarget) : 0,
	last: daysSinceLast == null ? null : dias(-daysSinceLast),
	daysSinceLast,
	streak: 3,
	maxRpe7: i === 1 ? 9 : 6,
	lastObs: i === 2 ? 'Senti dor no joelho no agachamento' : null,
	status: planActive ? 'active' : 'paused'
}));

function ficha(path: string) {
	const id = path.split('/')[3] ?? 'demo-1';
	const i = Math.max(0, lista.findIndex((s) => s.id === id));
	const s = lista[i]!;
	const goalId = base[i]![2];
	const semanas = Array.from({ length: 12 }, (_, w) => ({
		weekStart: dias(-7 * (12 - w)).slice(0, 10),
		weekLabel: `${String(1 + w).padStart(2, '0')}/set`,
		tonnage: i === 3 ? 0 : 3000 + w * 180,
		repVolume: 400 + w * 10,
		internalLoad: i === 3 ? 0 : 900 + w * 30 + (w === 11 ? 600 : 0),
		sessions: i === 3 ? 0 : 3,
		avgRpe: 6
	}));
	return {
		detail: {
			student: {
				id: s.id,
				professionalId: 'demo-prof',
				name: s.name,
				birthDate: s.birthDate,
				sex: s.sex,
				weightKg: s.weightKg,
				heightCm: s.heightCm,
				phone: '(11) 98765-4321',
				email: 'aluno@exemplo.com',
				linkTokenVersion: 1,
				profileCompletedAt: i === 3 ? null : dias(-90),
				createdAt: dias(-120),
				updatedAt: dias(-2),
				deletedAt: null
			},
			healthProfile: {
				studentId: s.id,
				cardiovascularRisk: i === 1 ? 'moderado' : 'baixo',
				diagnoses: i === 1 ? [{ label: 'Hipertensão estágio 1' }, { label: 'Cardiopatia leve' }] : [{ label: 'Asma leve' }],
				medications: i === 1 ? [{ name: 'Losartana', dose: '50 mg', frequency: '1x/dia' }] : [],
				injuries: i === 2 ? [{ region: 'Joelho direito', notes: 'menisco operado em 2023' }] : []
			},
			preferences: {
				studentId: s.id,
				goals: [goalId],
				weeklySessions: s.weeklyTarget ?? 3,
				minutesPerSession: 60,
				experienceLevel: 'intermediario',
				prescribedDifficulty: 'media',
				trainingSplit: 'auto'
			},
			plans: s.planActive
				? [
						{ id: `plano-${i}-a`, title: `Plano ${s.goal}`, isActive: true, createdAt: dias(-20), sessionsTotal: 3, status: 'published' },
						{ id: `plano-${i}-b`, title: 'Plano anterior', isActive: false, createdAt: dias(-80), sessionsTotal: 3, status: 'archived' }
					]
				: [],
			assessments: [
				{ id: 'av1', assessedAt: dias(-10), bodyFatPct: 22.4, bmi: 24.9, restingHr: 68, bloodPressureSystolic: 122, bloodPressureDiastolic: 80, notes: 'Boa progressão' },
				{ id: 'av2', assessedAt: dias(-50), bodyFatPct: null, bmi: 25.6, restingHr: 72, bloodPressureSystolic: null, bloodPressureDiastolic: null, notes: null }
			],
			lastWeights: [74, 73.5, 73, 72.4, s.weightKg],
			progress: {
				weight: { values: [74, 73, s.weightKg], current: s.weightKg, first: 74, deltaPct: ((s.weightKg - 74) / 74) * 100 },
				bmi: { values: [25.6, 25.2, 24.9], current: 24.9, first: 25.6, deltaPct: -2.7 },
				bodyFat: { values: [24, 22.4], current: 22.4, first: 24, deltaPct: -6.7 },
				restingHr: { values: [72, 68], current: 68, first: 72, deltaPct: -5.6 },
				bpSystolic: { values: [], current: null, first: null, deltaPct: null }
			}
		},
		alunoUrl: `http://localhost:5174/a/${s.id}?t=demo`,
		fillUrl: `http://localhost:5174/a/${s.id}/completar?t=demo`,
		loadEvolution: { weeks: semanas, hasData: i !== 3, externalMetric: 'tonnage', totalSessions: i === 3 ? 0 : 36 },
		recentSessions:
			i === 3
				? []
				: [
						{ id: 's1', date: dias(-1), label: 'Treino A', perceivedEffort: 8, durationMinutes: 55, doneCount: 6, totalCount: 6, observations: i === 2 ? 'Senti dor no joelho no agachamento' : null },
						{ id: 's2', date: dias(-3), label: 'Treino B', perceivedEffort: 6, durationMinutes: 50, doneCount: 5, totalCount: 6, observations: null }
					]
	};
}

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
	'GET /alunos': { students: lista },
	'GET /alunos/equipe': {
		equipe: [
			{ id: 'demo-prof', name: 'Profissional Demo' },
			{ id: 'demo-prof-2', name: 'Fernanda Dias' }
		],
		euId: 'demo-prof'
	},
	'POST /alunos': { mode: 'completo', id: 'demo-1' },
	'GET /alunos/:id': ficha,
	'PUT /alunos/:id': { ok: true },
	'DELETE /alunos/:id': { ok: true },
	'POST /alunos/:id/link/revogar': { ok: true },
	'POST /alunos/:id/link/reenviar': { sentTo: 'aluno@exemplo.com' },
	'PUT /alunos/:id/risco-cv': { level: 'moderado' },
	'POST /alunos/:id/avaliacoes': { id: 'av-demo' }
};

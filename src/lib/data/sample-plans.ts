export type PlanTemplate = {
	id: string;
	name: string;
	category: string;
	weeks: number;
	sessions: number;
	level: string;
	uses: number;
	updated: string;
	tags: string[];
};

export const PLAN_TEMPLATES: PlanTemplate[] = [
	{ id: 'rec-lca', name: 'Reabilitação · LCA pós-cirúrgico', category: 'Reabilitação', weeks: 16, sessions: 64, level: 'Progressivo', uses: 24, updated: '03.05.2026', tags: ['joelho', 'pós-op', 'CREFITO'] },
	{ id: 'rec-hd', name: 'Hérnia de disco lombar L4-L5', category: 'Reabilitação', weeks: 12, sessions: 48, level: 'Conservador', uses: 18, updated: '28.04.2026', tags: ['coluna', 'core'] },
	{ id: 'card-fase2', name: 'Cardiopatia · fase II', category: 'Cardio clínico', weeks: 8, sessions: 24, level: 'Supervisionado', uses: 12, updated: '20.04.2026', tags: ['FCmax', 'PSE'] },
	{ id: 'card-fase3', name: 'Cardiopatia · fase III manutenção', category: 'Cardio clínico', weeks: 12, sessions: 36, level: 'Independente', uses: 9, updated: '15.04.2026', tags: ['aeróbico'] },
	{ id: 'idoso-quedas', name: 'Idoso · prevenção de quedas', category: 'Idoso', weeks: 10, sessions: 30, level: 'Funcional', uses: 15, updated: '10.04.2026', tags: ['equilíbrio', 'força'] },
	{ id: 'preg-1tri', name: 'Pré-natal · 1º trimestre', category: 'Gestante', weeks: 12, sessions: 24, level: 'Adaptado', uses: 7, updated: '05.04.2026', tags: ['low-impact'] },
	{ id: 'pregpos', name: 'Pós-parto · diástase abdominal', category: 'Gestante', weeks: 10, sessions: 30, level: 'Progressivo', uses: 11, updated: '01.04.2026', tags: ['core', 'assoalho pélvico'] },
	{ id: 'dor-ombro', name: 'Dor crônica de ombro · manguito', category: 'Dor crônica', weeks: 8, sessions: 24, level: 'Conservador', uses: 14, updated: '28.03.2026', tags: ['ombro', 'mobilidade'] },
	{ id: 'hipert', name: 'Hipertrofia geral · iniciante', category: 'Performance', weeks: 12, sessions: 48, level: 'Progressivo', uses: 32, updated: '20.03.2026', tags: ['saúde geral'] }
];

export const PLAN_CATEGORIES = ['Todos', 'Reabilitação', 'Cardio clínico', 'Idoso', 'Gestante', 'Dor crônica', 'Performance'];

export type PlanExercise = {
	id: string;
	name: string;
	sets: number;
	reps: string;
	rest: number;
	intensity: 'Leve' | 'Moderado' | 'Alto';
	equipment: string[];
	form?: string;
	notes?: string;
};

export type PlanSession = {
	name: string;
	day: string;
	duration: number;
	type: string;
	exercises: PlanExercise[];
};

export type FullPlan = {
	id: string;
	title: string;
	description: string;
	duration: number;
	durationUnit: 'semanas';
	startDate: string;
	endDate: string;
	isActive: boolean;
	objectives: string[];
	notes?: string;
	sessions: PlanSession[];
};

export const SAMPLE_PLAN: FullPlan = {
	id: 'p1',
	title: 'Hipertrofia · Push/Pull/Legs · Bloco 2',
	description: 'Bloco de 12 semanas com progressão linear, foco em volume mecânico e tensão controlada na lombar.',
	duration: 12,
	durationUnit: 'semanas',
	startDate: '2026-04-01',
	endDate: '2026-06-23',
	isActive: true,
	objectives: ['Hipertrofia de membros superiores', 'Manutenção de gordura corporal'],
	notes: 'Aluna apresenta lombalgia crônica leve — evitar sobrecarga axial em deadlift convencional. Substituído por trap-bar.',
	sessions: [
		{
			name: 'Treino A · Push', day: 'Segunda', duration: 62, type: 'Hipertrofia',
			exercises: [
				{ id: 'ex1', name: 'Supino reto barra', sets: 4, reps: '8-10', rest: 90, intensity: 'Alto', equipment: ['Barra olímpica', 'Banco reto'], form: 'Escápulas retraídas e deprimidas. Descer a barra na altura do mamilo, controle excêntrico de 2s.', notes: 'Progredir 2.5kg quando completar todas as reps.' },
				{ id: 'ex2', name: 'Supino inclinado halter', sets: 3, reps: '10-12', rest: 75, intensity: 'Moderado', equipment: ['Halteres', 'Banco inclinado 30°'] },
				{ id: 'ex3', name: 'Crucifixo polia alta', sets: 3, reps: '12-15', rest: 60, intensity: 'Moderado', equipment: ['Polia dupla'] },
				{ id: 'ex4', name: 'Desenvolvimento militar', sets: 4, reps: '8-10', rest: 90, intensity: 'Alto', equipment: ['Barra olímpica'] },
				{ id: 'ex5', name: 'Elevação lateral halter', sets: 4, reps: '12-15', rest: 45, intensity: 'Leve', equipment: ['Halteres'] },
				{ id: 'ex6', name: 'Tríceps polia corda', sets: 3, reps: '12-15', rest: 60, intensity: 'Moderado', equipment: ['Polia alta', 'Corda'] },
				{ id: 'ex7', name: 'Tríceps francês halter', sets: 3, reps: '10-12', rest: 60, intensity: 'Moderado', equipment: ['Halter'] }
			]
		},
		{
			name: 'Treino B · Pull', day: 'Quarta', duration: 58, type: 'Hipertrofia',
			exercises: [
				{ id: 'ex8', name: 'Remada baixa polia', sets: 4, reps: '8-10', rest: 90, intensity: 'Alto', equipment: ['Polia baixa', 'Triângulo'] },
				{ id: 'ex9', name: 'Puxada frontal', sets: 4, reps: '10-12', rest: 75, intensity: 'Moderado', equipment: ['Polia alta', 'Barra'] },
				{ id: 'ex10', name: 'Remada curvada barra', sets: 3, reps: '8-10', rest: 90, intensity: 'Alto', equipment: ['Barra olímpica'], form: 'Tronco a 45°, lombar neutra. Puxar até o umbigo.', notes: 'Atenção à lombar — usar cinto se necessário.' },
				{ id: 'ex11', name: 'Rosca direta barra', sets: 3, reps: '10-12', rest: 60, intensity: 'Moderado', equipment: ['Barra W'] },
				{ id: 'ex12', name: 'Rosca martelo', sets: 3, reps: '12', rest: 45, intensity: 'Leve', equipment: ['Halteres'] },
				{ id: 'ex13', name: 'Face pull', sets: 3, reps: '15', rest: 45, intensity: 'Leve', equipment: ['Polia alta', 'Corda'] }
			]
		},
		{
			name: 'Treino C · Legs', day: 'Sexta', duration: 70, type: 'Hipertrofia',
			exercises: [
				{ id: 'ex14', name: 'Agachamento livre', sets: 4, reps: '6-8', rest: 120, intensity: 'Alto', equipment: ['Barra', 'Rack'] },
				{ id: 'ex15', name: 'Leg press 45°', sets: 4, reps: '10-12', rest: 90, intensity: 'Alto', equipment: ['Leg press'] },
				{ id: 'ex16', name: 'Stiff trap-bar', sets: 3, reps: '8-10', rest: 90, intensity: 'Moderado', equipment: ['Trap-bar'], notes: 'Substituição do deadlift convencional por restrição lombar.' },
				{ id: 'ex17', name: 'Cadeira extensora', sets: 3, reps: '12-15', rest: 60, intensity: 'Moderado', equipment: ['Cadeira extensora'] },
				{ id: 'ex18', name: 'Mesa flexora', sets: 3, reps: '12-15', rest: 60, intensity: 'Moderado', equipment: ['Mesa flexora'] },
				{ id: 'ex19', name: 'Panturrilha em pé', sets: 4, reps: '15-20', rest: 45, intensity: 'Leve', equipment: ['Smith machine'] }
			]
		}
	]
};

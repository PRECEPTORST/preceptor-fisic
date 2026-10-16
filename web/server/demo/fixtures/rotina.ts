// Fixtures do modo demo do domínio "rotina". Chave "MÉTODO /caminho" (aceita :param).
// Ordem importa: caminhos fixos (/meus, /alunos, /lido) antes dos com :id.
const agora = Date.now();
const h = (dias: number, hora: number, min = 0) => {
	const d = new Date(agora + dias * 86_400_000);
	d.setHours(hora, min, 0, 0);
	return d.toISOString();
};
const segunda = (() => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return d;
})();
const naSemana = (dia: number, hora: number, min = 0) => {
	const d = new Date(segunda);
	d.setDate(d.getDate() + dia);
	d.setHours(hora, min);
	return d.toISOString();
};

const alunos = [
	{ id: 'demo-1', name: 'Ana Paula Souza' },
	{ id: 'demo-2', name: 'Bruno Lima' },
	{ id: 'demo-3', name: 'Carla Mendes' }
];

const catalogo = [
	['Agachamento livre', 'upper legs', 'quadríceps', 'barbell', 'intermediate'],
	['Supino reto', 'chest', 'peitoral', 'barbell', 'intermediate'],
	['Remada curvada', 'back', 'dorsais', 'barbell', 'advanced'],
	['Prancha', 'waist', 'abdômen', 'body weight', 'beginner'],
	['Elevação lateral', 'shoulders', 'deltoide', 'dumbbell', 'beginner'],
	['Rosca direta', 'upper arms', 'bíceps', 'dumbbell', 'beginner']
].map(([name, bodyPart, targetMuscle, equipment, difficulty], i) => ({
	id: `cat-${i + 1}`,
	externalId: `ext-${i + 1}`,
	name,
	nameEn: name,
	bodyPart,
	targetMuscle,
	secondaryMuscles: ['core'],
	equipment,
	difficulty,
	category: 'strength',
	instructions: ['Posicione-se.', 'Execute o movimento controlado.', 'Volte devagar.'],
	description: 'Exercício de demonstração.',
	videoUrl: null
}));

const meus = [
	['EX001', 'Agachamento búlgaro', 'Membros inferiores', 'Halter', 'intermediario', 'Lunge', 12],
	['EX002', 'Ponte de glúteo', 'Posterior', 'Solo', 'iniciante', 'Hinge', 30],
	['EX003', 'Face pull', 'Ombros', 'Polia', 'intermediario', 'Pull', 4]
].map(([code, name, muscleGroup, equipment, level, pattern, uses], i) => ({
	id: `ex-${i + 1}`,
	professionalId: 'demo-prof',
	code,
	name,
	muscleGroup,
	equipment,
	level,
	pattern,
	description: null,
	executionNotes: 'Controle a descida em 3 segundos.',
	videoUrl: null,
	contraindications: i === 0 ? ['dor no joelho'] : [],
	uses,
	createdAt: h(-30, 9),
	updatedAt: h(-2, 9)
}));

const sessoes = [
	[0, 7, 0, 60, 'treino', 'scheduled', 'Ana Paula Souza', null],
	[0, 9, 30, 60, 'avaliacao', 'completed', 'Bruno Lima', 'Reavaliação'],
	[1, 9, 0, 60, 'treino', 'scheduled', 'Carla Mendes', null],
	[1, 9, 30, 45, 'reabilitacao', 'scheduled', 'Ana Paula Souza', 'Joelho'],
	[3, 18, 0, 60, 'consulta', 'cancelled', 'Bruno Lima', null],
	[4, 12, 0, 30, 'treino', 'scheduled', null, 'Bloqueio: almoço']
].map(([dia, hora, min, dur, type, status, studentName, label], i) => ({
	id: `ag-${i + 1}`,
	professionalId: 'demo-prof',
	studentId: studentName ? (alunos.find((a) => a.name === studentName)?.id ?? null) : null,
	startsAt: naSemana(dia as number, hora as number, min as number),
	durationMinutes: dur,
	type,
	label,
	notes: null,
	status,
	createdAt: h(-5, 9),
	updatedAt: h(-5, 9),
	studentName
}));

const conversas = [
	{ id: 'cv-1', studentId: 'demo-3', studentName: 'Carla Mendes', last: 'Senti dor no joelho no agachamento', lastAt: h(0, 8, 12), unread: 2, online: false },
	{ id: 'cv-2', studentId: 'demo-1', studentName: 'Ana Paula Souza', last: 'Fechou, obrigada!', lastAt: h(-1, 19), unread: 0, online: false }
];
const msgs = (conversationId: string) => [
	{ id: `${conversationId}-1`, conversationId, fromRole: 'professional', body: 'Como foi o treino de ontem?', createdAt: h(-1, 18), readAt: null },
	{ id: `${conversationId}-2`, conversationId, fromRole: 'student', body: 'Senti dor no joelho no agachamento', createdAt: h(0, 8, 12), readAt: null }
];
const ok = { ok: true };

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
	'GET /exercicios/catalogo': {
		items: catalogo,
		total: catalogo.length,
		page: 1,
		pageSize: 48,
		facets: {
			total: 1324,
			bodyParts: [
				{ value: 'upper legs', count: 220 },
				{ value: 'back', count: 180 },
				{ value: 'chest', count: 160 },
				{ value: 'waist', count: 120 }
			],
			equipment: [{ value: 'barbell', count: 300 }]
		}
	},
	'GET /exercicios/meus': { exercises: meus },
	'POST /exercicios': { id: 'ex-novo' },
	'GET /exercicios/:id': (p: string) => ({ exercise: meus.find((x) => p.endsWith(x.id)) ?? meus[0] }),
	'PUT /exercicios/:id': ok,
	'DELETE /exercicios/:id': ok,

	'GET /agenda': { appointments: sessoes, weekStart: segunda.toISOString(), weekEnd: new Date(segunda.getTime() + 7 * 86_400_000).toISOString(), semana: 0 },
	'GET /agenda/alunos': { students: alunos },
	'POST /agenda': { id: 'ag-novo' },
	'GET /agenda/:id': (p: string) => ({ appointment: sessoes.find((x) => p.endsWith(x.id)) ?? sessoes[0], students: alunos }),
	'PUT /agenda/:id': { ok: true, notificado: true },
	'DELETE /agenda/:id': ok,

	'GET /mensagens': { threads: conversas },
	'GET /mensagens/aluno/:id': (p: string) => ({ conversa: conversas.find((c) => p.endsWith(c.studentId)) ?? null }),
	'POST /mensagens/:id/lido': ok,
	'GET /mensagens/:id': (p: string) => ({ messages: msgs(p.split('/').pop() ?? 'cv-1') }),
	'POST /mensagens/:id': { message: { id: 'm-novo', body: 'ok', fromRole: 'professional', createdAt: new Date().toISOString() } }
};

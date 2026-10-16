import { fixtures as fx_alunos } from './fixtures/alunos';
import { fixtures as fx_treinos } from './fixtures/treinos';
import { fixtures as fx_rotina } from './fixtures/rotina';
import { fixtures as fx_conta } from './fixtures/conta';
import { fixtures as fx_crm } from './fixtures/crm';
import { fixtures as fx_publico } from './fixtures/publico';
// Fixtures do modo demo. Chave: "MÉTODO /caminho" (aceita :param). Dados fictícios.
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const alunos = [
	['Ana Paula Souza', 'Hipertrofia', true, 92, 3, 1, null],
	['Bruno Lima', 'Emagrecimento', true, 40, 4, 6, null],
	['Carla Mendes', 'Reabilitação de joelho', true, 75, 3, 2, 'Senti dor no joelho no agachamento'],
	['Diego Rocha', 'Condicionamento', false, 0, null, null, null],
	['Elisa Prado', 'Hipertrofia', true, 100, 5, 0, null]
].map(([name, goal, planActive, adherence, weeklyTarget, daysSinceLast, lastObs], i) => ({
	id: `demo-${i + 1}`,
	name,
	birthDate: '1990-05-10',
	age: 30 + i,
	sex: i % 2 ? 'M' : 'F',
	weightKg: 70 + i,
	heightCm: 170,
	goal,
	planTitle: planActive ? `Plano ${goal}` : null,
	planActive,
	weeklyTarget,
	adherence,
	sessions7: weeklyTarget ? Math.round(((adherence as number) / 100) * (weeklyTarget as number)) : 0,
	last: daysSinceLast == null ? null : dias(-(daysSinceLast as number)),
	daysSinceLast,
	streak: 3,
	maxRpe7: i === 1 ? 9 : 6,
	lastObs,
	status: planActive ? 'active' : 'paused'
}));

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
	...fx_alunos, ...fx_treinos, ...fx_rotina, ...fx_conta, ...fx_crm, ...fx_publico,
	'GET /sessao': {
		professional: {
			id: 'demo-prof',
			name: 'Profissional Demo',
			email: 'demo@preceptorfisic.com.br',
			cref: 'CREF 000000-G/SP',
			specialty: 'Treinamento',
			avatarUrl: null,
			isAdmin: true,
			organizationId: null
		},
		user: { id: 'demo-user', email: 'demo@preceptorfisic.com.br' },
		temAcesso: true,
		isOrgOwner: true,
		trial: { diasRestantes: 4, label: '4 dias de teste' },
		sidebarCounts: { students: 5, unreadMessages: 2, newLeads: 3 }
	},
	'GET /dashboard': {
		students: alunos,
		stats: {
			activeStudents: 4,
			totalStudents: 5,
			totalPlans: 7,
			activePlans: 4,
			sessionsThisWeek: 14,
			assessmentsLogged: 9,
			heatmap: Array.from({ length: 182 }, (_, i) => ((i * 7) % 5) - 1 > 0 ? ((i * 7) % 5) - 1 : 0),
			heatmapMax: 3,
			upcomingAppointments: [
				{ id: 'ap1', startsAt: dias(1), title: 'Reavaliação', studentName: 'Ana Paula Souza' },
				{ id: 'ap2', startsAt: dias(3), title: null, studentName: 'Bruno Lima' }
			]
		},
		attention: [
			{ studentId: 'demo-2', name: 'Bruno Lima', severity: 'alta', kind: 'pse_alto', message: 'PSE 9 nos últimos 7 dias', action: { label: 'Abrir ficha', href: '/alunos/demo-2' } },
			{ studentId: 'demo-3', name: 'Carla Mendes', severity: 'media', kind: 'observacao', message: 'Escreveu uma observação', detail: 'Senti dor no joelho no agachamento', action: { label: 'Abrir ficha', href: '/alunos/demo-3' } },
			{ studentId: 'demo-4', name: 'Diego Rocha', severity: 'media', kind: 'sem_plano', message: 'Sem plano em vigor', action: { label: 'Gerar plano', href: '/alunos/demo-4/gerar' } }
		]
	}
};

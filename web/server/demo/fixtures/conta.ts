// Fixtures do modo demo do domínio "conta". Chave "MÉTODO /caminho" (aceita :param). Dados fictícios.
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
	'PUT /configuracoes/perfil': { ok: true },
	'GET /assinatura': {
		nome: 'Profissional Demo',
		email: 'demo@preceptorfisic.com.br',
		plano: 'trial',
		expiraEm: dias(4),
		billingEnabled: true,
		situacao: 'trial',
		diasDeTrial: 4,
		precisaCpf: false
	},
	'POST /assinatura': { pendente: true },
	'GET /upgrade': { temAcesso: false, usouTrial: true, acervo: { alunos: 5, planos: 7, publicados: 4 }, nome: 'Profissional' },
	'GET /feedback': {
		mine: [
			{ id: 'fb1', category: 'sugestao', message: 'Seria ótimo filtrar a agenda por aluno.', page: 'agenda', createdAt: dias(-3) },
			{ id: 'fb2', category: 'bug', message: 'O vídeo do agachamento não carregou.', page: null, createdAt: dias(-10) }
		]
	},
	'POST /feedback': { ok: true },
	'GET /equipe': {
		org: { id: 'org-demo', name: 'Clínica Movimento', seats: 5, generationsLimit: 100, perMemberGenerationCap: 30 },
		membros: [
			{ id: 'demo-prof', name: 'Profissional Demo', email: 'demo@preceptorfisic.com.br', cref: 'CREF 000000-G/SP', is_owner: true, alunos: 5, planos: 7, geracoes: 12, noCiclo: 6 },
			{ id: 'demo-prof-2', name: 'Rafaela Nunes', email: 'rafaela@exemplo.com', cref: null, is_owner: false, alunos: 3, planos: 2, geracoes: 4, noCiclo: 2 }
		],
		convites: [{ id: 'cv1', email: 'joao@exemplo.com', expiresAt: dias(5), createdAt: dias(-2) }],
		alunos: [
			{ id: 'demo-1', nome: 'Ana Paula Souza', responsavel: 'Profissional Demo', responsavel_id: 'demo-prof', criado_em: dias(-40), planos: 1 },
			{ id: 'demo-6', nome: 'Marcos Teixeira', responsavel: 'Rafaela Nunes', responsavel_id: 'demo-prof-2', criado_em: dias(-12), planos: 0 }
		],
		usadasNoCiclo: 8,
		cicloDesde: dias(-9)
	},
	'POST /equipe/convites': { convite: { email: 'novo@exemplo.com', url: 'http://localhost:5174/convite/demo-token' } },
	'DELETE /equipe/membros/:id': { ok: true },
	'PUT /equipe/teto': { ok: true },
	'GET /convite/:token': {
		situacao: 'valido',
		clinica: 'Clínica Movimento',
		convidado: 'demo@preceptorfisic.com.br',
		voce: { nome: 'Profissional Demo', email: 'demo@preceptorfisic.com.br' }
	},
	'POST /convite/:token/aceitar': { ok: true, clinica: 'Clínica Movimento' },
	'GET /onboarding': { email: 'demo@preceptorfisic.com.br', jaTemPerfil: false },
	'POST /onboarding': { ok: true, name: 'Profissional Demo', trialGranted: true, trialDays: 7 },
	'POST /recuperar/redefinir': { ok: true }
};

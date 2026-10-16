// Fixtures do modo demo do domínio "crm". Chave "MÉTODO /caminho" (aceita :param). Dados fictícios.
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const LEADS = (
  [
    ['Pedro Henrique', 'instagram', 'visitante', '(11) 98888-1111', null, -1, 'Quer começar segunda.', -1],
    ['Mariana Costa', 'indicacao', 'cadastrou', null, 'mariana@exemplo.com', 2, null, -3],
    ['Rafael Nunes', 'anuncio', 'ativou_aluno', '(21) 97777-2222', 'rafa@exemplo.com', -4, 'Indicação da Beatriz.', -12],
    ['Juliana Alves', 'site', 'trial', '(31) 96666-3333', 'ju@exemplo.com', 1, null, -5],
    ['Thiago Moreira', 'whatsapp', 'pagante', '(35) 99148-1514', 'thiago@exemplo.com', null, 'Plano anual.', -40],
    ['Beatriz Lopes', 'instagram', 'pagante', null, 'bia@exemplo.com', null, null, -60],
    ['Gustavo Reis', 'outro', 'cancelado', '(41) 95555-4444', null, null, null, -90],
    ['Larissa Faria', 'anuncio', 'perdido', null, 'lari@exemplo.com', -2, null, -20],
    ['Caio Martins', 'instagram', 'visitante', null, null, null, null, -2]
  ] as const
).map(([name, source, stage, phone, email, follow, notes, criado], i) => ({
  id: `lead-${i + 1}`,
  name,
  phone,
  email,
  source,
  stage,
  notes,
  nextFollowUpAt: follow == null ? null : dias(follow),
  subjectProfessionalId: stage === 'pagante' ? `prof-${i}` : null,
  lostReason: stage === 'perdido' ? 'Preço alto' : null,
  createdAt: dias(criado),
  updatedAt: dias(Math.min(0, criado + 3))
}));

const COUNTS = Object.fromEntries(
  ['visitante', 'cadastrou', 'ativou_aluno', 'trial', 'pagante', 'cancelado', 'perdido'].map((s) => [
    s,
    LEADS.filter((l) => l.stage === s).length
  ])
);

const CONTAS = [
  ['Ana Prado', 'ana@exemplo.com', 'CREF 012345-G/SP', false, 'active', 'essencial', 20, 20, 30],
  ['Bruno Teixeira', 'bruno@exemplo.com', null, false, 'trial', 'trial', 2, 5, 2],
  ['Clínica Movimento', 'contato@movimento.com', 'CREF 054321-PJ/MG', false, 'active', 'institucional', null, null, 200],
  ['Diana Rocha', 'diana@exemplo.com', 'CREF 098765-G/RJ', false, 'active', 'pro_legacy', 60, 80, -2],
  ['Equipe Preceptor', 'time@preceptorfisic.com.br', null, true, 'active', null, 20, 20, 365],
  ['Fábio Silva', 'fabio@exemplo.com', null, false, 'past_due', 'basico', 10, 10, -5]
].map(([name, email, cref, isAdmin, status, plano, alunos, ger, expira], i) => ({
  id: `conta-${i + 1}`,
  name,
  email,
  cref,
  isAdmin,
  subscriptionStatus: status,
  subscriptionPlan: plano,
  subscriptionExpiresAt: dias(expira as number),
  createdAt: dias(-30 * (i + 1)),
  limites: { students: alunos, generations: ger },
  planoLabel:
    plano == null
      ? null
      : ({ essencial: 'Essencial', trial: 'Teste', institucional: 'Institucional', pro_legacy: 'Pro', basico: 'Basico' } as Record<string, string>)[plano as string],
  planoLegado: plano === 'pro_legacy'
}));

const FEEDBACKS = [
  ['Ana Prado', 'bug', 'O botão de salvar treino some no celular.', '/treinos/novo', -1],
  ['Bruno Teixeira', 'sugestao', 'Queria exportar o plano em PDF para o aluno.', '/alunos/demo-1', -2],
  [null, 'duvida', 'Como convido outro profissional para a clínica?', '/equipe', -4],
  ['Diana Rocha', 'elogio', 'A geração de **planos** ficou muito boa!', null, -6],
  ['Fábio Silva', 'outro', 'Seria bom ter modo claro.', '/configuracoes', -9]
].map(([authorName, category, message, page, d], i) => ({
  id: `fb-${i + 1}`,
  authorName,
  authorEmail: null,
  category,
  message,
  page,
  createdAt: dias(d as number)
}));

export const fixtures: Record<string, unknown | ((path: string) => unknown)> = {
  'GET /crm': { leads: LEADS, counts: COUNTS },
  'POST /crm/leads': { id: 'lead-1' },
  'GET /crm/leads/:id': (path: string) => ({
    lead: LEADS.find((l) => path.endsWith(`/${l.id}`)) ?? LEADS[0]
  }),
  'PUT /crm/leads/:id': { ok: true },
  'PATCH /crm/leads/:id/estagio': { ok: true },
  'DELETE /crm/leads/:id': { ok: true },
  'GET /crm/contas': { contas: CONTAS },
  'POST /crm/contas/link': {
    email: 'ana@exemplo.com',
    resetUrl: 'http://localhost:5174/recuperar/redefinir?token_hash=demo&type=recovery'
  },
  'GET /crm/feedbacks': { feedbacks: FEEDBACKS },
  'POST /crm/feedbacks/resumo': {
    summary:
      '1. **Temas principais**\n- Exportação e uso no celular (2 feedbacks)\n\n2. **Bugs reportados**\n- Botão de salvar treino some no celular\n\n3. **Sugestões mais pedidas**\n- Exportar plano em PDF\n\n4. **Top 3 ações recomendadas**\n- Corrigir o botão no mobile\n- Exportar PDF\n- Documentar o convite da clínica',
    summarizedCount: FEEDBACKS.length
  }
};

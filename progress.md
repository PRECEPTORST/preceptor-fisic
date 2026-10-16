# progress — auditoria e reconstrução do Preceptor Fisic

**Tarefa:** auditar o preceptor-fisic e reconstruí-lo no padrão do Cockpit.
**Decisões do Matheus (16/10/2026):**
- O PR 1 blinda o SvelteKit; o PR 2 reconstrói em React.
- "Pode seguir automaticamente, só vai me dando relatório em cada checkpoint."

## Concluído
- **PR 1 (#42), mergeado:** RLS revogada em produção, webhook Asaas, CI e código morto. Relatório em `docs/AUDITORIA-2026-10.md`.
- **PR 2 (`feat/web-react`), checkpoint 2:** base do app React em `web/` (ADR `docs/decisions/0001-web-react.md`), login, visão geral, modo demo e job de CI.

## Pedido novo (16/10): redesign completo
O pedido passou a incluir redesign com as mesmas cores, uma nova forma de trabalhar, e a reauditoria e reconstrução da landing.
- O brief está em `docs/design/REDESIGN.md`, junto com os componentes compartilhados (commit 0a13deb).
- A auditoria da landing está em `docs/AUDITORIA-LANDING-2026-10.md`. Os números foram conferidos no banco de produção.
- Um 7º agente está reconstruindo a landing (`rotasLanding`, prerender para SEO).

## Em andamento (checkpoint 3)
São 6 agentes em paralelo, cada um num worktree com a própria branch:
- alunos
- treinos
- rotina (exercícios, agenda, mensagens)
- conta
- crm
- público (app do aluno, landing, legal)

O coordenador revisa cada diff, roda a verificação e faz o merge em `feat/web-react`.

## Pendências conhecidas
- Montar `rotasForaDoShell` (conta) no App.tsx e trocar o `/` → `/dashboard` pela landing (público).
- Bundle inicial de 607 KB: separar em chunks (lazy por domínio).
- Teste ponta a ponta com o banco real: falta o `.env.local` (DATABASE_URL), que o Matheus precisa fornecer, ou um projeto Vercel de staging com as envs.
- Corte de produção: decisão à parte (ADR 0001, seção Corte).
- Auditoria S4, S5 e S6.

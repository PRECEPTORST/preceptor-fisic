# progress — auditoria e reconstrução do Preceptor Fisic

**Tarefa:** auditar o preceptor-fisic e reconstruí-lo no padrão do Cockpit (UI/UX e desenvolvimento).
**Decisão do Matheus (16/10/2026):** o PR 1 blinda o SvelteKit atual; o PR 2, separado, reconstrói em Vite + React + TS + shadcn.
**Relatório:** `docs/AUDITORIA-2026-10.md`.

## Concluído (PR 1)
- S1: RLS e grants revogados em produção (`fzhymjjxjinvngrncgwu`), com o SQL versionado em 0008.
- S2 e S3: webhook Asaas com regras puras e testes.
- CI bloqueia tipos, roda build e roda e2e em todo PR.
- Código morto do ACSM removido.

## Próximo passo
1. S4, S5 e S6 (ver a auditoria, seção 7).
2. PR 2: scaffold `apps/web` (Vite + React + TS estrito), copiando do cockpit os tokens, theme, queryClient, EmptyState, StatusChip e ErrorBoundary. A API do servidor sai das form actions e vira rotas REST explícitas.

# Auditoria Preceptor Fisic — outubro 2026

Base de comparação: Cockpit v2 (`cockpit-v2/ponte-cockpit/apps/cockpit-web`), stack
Vite + React 18 + TS estrito + shadcn/ui + Tailwind + React Query + Supabase (ADR 0013).

## 1. Segurança e dinheiro (corrigir antes de qualquer reconstrução)

| # | Sev. | Achado | Evidência |
|---|---|---|---|
| S1 | Crítico | Profissional logado consegue editar a própria linha pelo PostgREST e virar `is_admin` ou assinante ativo. O app nunca usa PostgREST. | `drizzle/post-migration/0001-rls.sql:20-24` (policy `for all`, nenhum REVOKE) |
| S2 | Alto | Estorno ou atraso do ebook cancela ou rebaixa a assinatura. | `src/routes/api/webhooks/asaas/+server.ts:113` (o ebook só é filtrado em ACTIVATE) |
| S3 | Alto | Evento antigo derruba cobrança nova, e a renovação conta a partir de hoje, não da expiração atual. | mesmo arquivo `:168-207` |
| S4 | Alto | `organizations` e `organization_invites` estão sem RLS versionado. | `drizzle/manual/0011_organizations.sql` |
| S5 | Médio | `CPF_SECRET` e `ALUNO_LINK_SECRET` saem da service key: se ela for rotacionada, os CPFs ficam ilegíveis. | `src/lib/server/cpf.ts:30-35`, `aluno-token.ts:22-30` |
| S6 | Médio | O rate limit fica em memória por instância. Onboarding e recuperação de senha não têm limite. | `src/lib/server/rate-limit.ts` |

## 2. Engenharia

- O CI não trava erro de tipo (`ci.yml:46`, `continue-on-error`). Não há lint nem build. O e2e nunca roda em PR, porque a condição `changed_files` é um número.
- Drift: o journal do drizzle vai só até a `0002`; 18 SQLs são aplicados fora dele.
- Arquivos gigantes: `queries.ts` com 3066 linhas, `ai/generator.ts` com 1667, `schema.ts` com 970.
- Código morto: `clinical/cv-risk.ts` e `server/clinical/cv-risk-service.ts` (ACSM).
- `requireAdmin` está duplicado nas actions do CRM.
- Os 14 testes cobrem só funções puras. O webhook, a checagem de dono e a de admin estão sem teste.

## 3. UI/UX

- Tokens: a varredura automática apontou 20 tokens inexistentes, mas na conferência quase todos são variáveis locais da página (`assinatura`, `guia`, `imprimir`, `toast`). Elas duplicam o design system com outra paleta (o `guia` usa navy e violeta). Só `--r-md` estava de fato quebrado, e foi corrigido.
- O foco de teclado foi removido em 10 campos (`outline:none`), e `focus-visible` aparece só 5 vezes. A linha do dashboard é uma `div` clicável.
- Há 84 hex inline, 82 rgba, 1.091 `style=` e 53 gradientes, o que quebra a regra do próprio README.
- Os primitives estão subusados: 98 `<button>` nativos e `.chip` e `.eyebrow` recriados em 8 ou mais arquivos.
- Telas gigantes: landing com 2056 linhas, `planos/[id]` com 1462 (e 5 `window.confirm`), `alunos/[id]` com 1074.
- 41 de 43 páginas não têm estado de carregamento, e só existe um `+error`.
- A navegação chama de "Planos" tanto o plano de treino quanto o plano comercial. `/assinatura` fica fora do shell, `/upgrade` é só uma passagem, e o menu mobile não tem Equipe nem Assinatura.
- No app do aluno, só 2 de 18 botões têm rótulo. O `--ink-3` como texto tem contraste de cerca de 2,3:1.

## 4. O que funcionou no Cockpit e vale portar

- Tokens semânticos (`bg`, `ink`, `signal`, `positive`, `warning`, `negative`), com o claro como padrão e o escuro por classe, e as fontes vendorizadas.
- Fontes Instrument Sans e IBM Plex Mono.
- `EmptyState`, `StatusChip`, `ErrorBoundary`, e em toda tela o padrão skeleton, depois erro com `refetch`, depois vazio.
- `queryClient` único, chaves de query literais, `useRealtimeInvalidate` com debounce e `paginarTudo`.
- Lógica em `lib/*.ts` pura, com teste ao lado.
- TS estrito com `noUncheckedIndexedAccess`, e o build passa pelo `typecheck`.
- CI `branch-atualizada`, ritual de deploy com scripts, ADRs e invariantes numerados, e a regra "diagnóstico antes de correção".

Lacunas do Cockpit que não devem ser copiadas como se fossem padrão: zod e react-hook-form estão instalados mas não são usados, e não existe paleta de comandos.

## 5. O que está bem feito

A checagem de dono está em todas as actions de `(app)`, e a de admin em cada action do CRM. O link do aluno usa HMAC com versão. O `?next=` não permite open redirect. O webhook tem dedupe e compara o token em tempo constante. O Sentry remove dados sensíveis, e os headers de segurança estão configurados.

## 6. Feito neste PR (PR 1 — blindagem)

- S1: a escrita do PostgREST (`anon`/`authenticated`) foi revogada **em produção** no dia 16/10/2026 (`drizzle/post-migration/0008`). Conferido depois: só SELECT continua, filtrado pela RLS.
- S2 e S3: as regras do webhook foram para `src/lib/server/asaas-regras.ts`, com teste. Estorno e atraso do ebook não tocam mais na assinatura. Evento de assinatura que não é a vigente é ignorado. A renovação soma a partir da expiração vigente.
- CI: o check de tipos passou a bloquear (0 erros hoje), entrou um passo de build, e o e2e roda em todo PR. O `vercel.json` usa `npm ci`.
- O código morto do ACSM foi removido, e o token `--r-md` corrigido.

## 7. Pendente

- **S4:** em produção, `organizations` e `organization_invites` têm RLS ativa sem policy (deny), então estão seguras. Falta versionar no repositório.
- **S5:** tornar `CPF_SECRET` obrigatório. Antes, é preciso confirmar que ele está definido na Vercel, senão os CPFs já cifrados ficam ilegíveis.
- **S6:** rate limit persistente (Postgres ou Upstash) e throttle no onboarding e na recuperação de senha.
- **PR 2:** reconstruir em Vite + React + TS + shadcn no padrão do Cockpit (seção 4), resolvendo a navegação, os estados de tela, a acessibilidade e as telas gigantes da seção 3.

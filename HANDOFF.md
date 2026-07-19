# Handoff — Preceptor Fisic

Guia rápido pra um dev assumir o projeto. Complementa o [`README.md`](README.md)
(setup base, design system, telas) e o [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
(backup/restore/deploy/rollback). **Leia isto primeiro** — tem armadilhas que os
outros docs não cobrem (ou cobrem desatualizado).

## Stack

SvelteKit 2 · Svelte 5 (runes) · Tailwind 4 · Drizzle ORM · Supabase (Postgres,
região BR `sa-east-1`) · Vercel AI SDK (Gemini) · deploy `@sveltejs/adapter-vercel`.

## Setup local (rápido)

Node 20+ (testado no 26). O README pede pnpm, mas **npm funciona** normalmente.

```bash
gh repo clone PRECEPTORSTUDIO/preceptor-fisic
cd preceptor-fisic
npm install
cp .env.example .env.local     # e preencher (ver abaixo)
npm run dev                     # http://localhost:5173
```

Login de teste (profissional admin): `matheus@studio.fit`.

### `.env.local` — o que preencher

Pegue no painel do Supabase (projeto BR) e no Google AI Studio. **Nunca commite
este arquivo** (está no `.gitignore`).

| Var | Onde | Obrigatória? |
|---|---|---|
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Sim |
| `DATABASE_URL` / `DATABASE_URL_DIRECT` | Supabase → Database → Connection string | Sim |
| `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com/apikey | Só p/ geração de plano (IA) |
| `RESEND_API_KEY` / `RESEND_FROM` | Resend | Opcional (dev loga em vez de enviar) |

### ⚠️ Armadilhas de conexão (custam horas se não souber)

1. **Não use a conexão DIRETA do Supabase.** `db.<ref>.supabase.co` **não
   resolve no DNS** na maioria das redes. Use sempre o **pooler**:
   `aws-1-sa-east-1.pooler.supabase.com`, usuário `postgres.<ref>`,
   **porta 6543 (transaction)** pro runtime e **5432 (session)** pra migrations.
2. **"Modo design" precisa de `DATABASE_URL`.** `src/lib/server/db/index.ts`
   lança no import se `DATABASE_URL` estiver ausente. Pra rodar a UI sem banco,
   use um dummy: `DATABASE_URL='postgresql://ci:ci@localhost:5432/ci'`. Sem
   sessão só `/` e `/dashboard` renderizam (mock em `src/lib/data/sample-students.ts`).
3. **Modelo do Gemini:** o default é `gemini-flash-latest` (alias). **Não** volte
   pra `gemini-2.5-flash` fixo — o Google bloqueia esse snapshot pra chaves/
   projetos NOVOS ("no longer available to new users"). Override por
   `AI_MODEL_FAST` / `AI_MODEL_PRIMARY` se precisar.

### Testes / qualidade

```bash
npm run test      # vitest (inclui os testes clínicos em src/lib/clinical/)
npm run check     # svelte-check (tipos)
```

O CI (GitHub Actions) roda `test` + `check` + Playwright e2e a cada PR.

## 🚨 Situação do deploy (LEIA)

**O auto-deploy da produção está QUEBRADO desde 2026-07-03.** O repositório foi
movido pra a org `PRECEPTORSTUDIO` e a integração Vercel↔GitHub se desfez —
nenhum commit novo da `main` está indo pra produção (`preceptor-fisic.vercel.app`
está congelada no commit `e3920b9`). O que o README/OPERATIONS dizem sobre
"Vercel deploya automaticamente no push" está **desatualizado**.

**Pra religar (precisa de acesso à Vercel do dono do projeto):**
Vercel → projeto → Settings → Git → reconectar/reimportar `PRECEPTORSTUDIO/preceptor-fisic`
→ depois um "Redeploy" da `main`. Aí os deploys automáticos voltam.

**Ambiente de validação (workaround):** enquanto a prod não volta, há um deploy
de staging numa conta Vercel separada (`preceptor-fisic-staging.vercel.app`) que
reflete a `main`. Não é a produção oficial — só pra validar/demonstrar.

## Onde está o código-chave

- **Risco cardiovascular (feature recente):**
  - `src/lib/clinical/sbc-risk.ts` — calculadora da SBC: **Escore de Risco Global**
    (Framingham 2008 / D'Agostino). Função pura + testes. Coeficientes conferidos
    com o pacote `CVrisk`.
  - `src/lib/components/SbcRiskCalculator.svelte` — a calculadora (2 modos:
    `submitName` = campo de formulário no cadastro; sem ele = botão "aplicar" na ficha).
  - Fluxo: o risco é **definido no cadastro** (`src/routes/(app)/alunos/novo/`),
    **exibido** na ficha (`.../alunos/[id]/`), e **usado pela IA** (o generator
    injeta o risco no prompt).
- **Geração de plano (IA):** `src/lib/server/ai/generator.ts` (RAG + Gemini +
  persistência + auditoria). Modelo via env (default `gemini-flash-latest`).
- **Queries:** `src/lib/server/queries.ts` (tudo que toca o DB passa por aqui).
- **Schema:** `src/lib/server/db/schema.ts`.

### Código morto (pode remover)

O motor de risco **ACSM** antigo — `src/lib/clinical/cv-risk.ts` e
`src/lib/server/clinical/cv-risk-service.ts` — não é mais usado (foi substituído
pela calculadora SBC). Só os próprios testes o referenciam. Pode ser removido
numa limpeza.

## Pendências / próximos passos

1. **Validação clínica** dos limiares do risco CV por um profissional CREF
   (Matheus) antes de exposição ampla a pacientes. É ferramenta de apoio, não
   diagnóstico.
2. **Persistir os lipídios** (colesterol total / HDL) como campos na avaliação
   física — hoje entram na calculadora mas não são salvos. Exige migration.
3. **Remover o código ACSM morto** (acima).
4. **Religar o deploy de produção** (seção acima).
5. **Rotacionar segredos** que circularam fora de canais seguros.

## Convenções

Código e comentários em **PT-BR**. Design system dark-mode com tokens em
`src/app.css` (ver "Regras inegociáveis" no README — nada de hex inline, todo
número em mono/tabular-nums). Trabalhe em branch + PR; a `main` é protegida por CI.

# ADR 0001: app novo em Vite + React + TS, no padrão do Cockpit

Data: 16/10/2026. Decisão do Matheus: "mudar de SvelteKit para TypeScript num PR separado", seguindo o que deu certo no Cockpit.

## Decisão

- **Front:** `web/`, com Vite, React 18, TS estrito, Tailwind 3, shadcn/ui, React Query 5 e react-router 6. É a stack do Cockpit (ADR 0013 de lá).
- **API:** Hono em `web/server/`, rodando como uma Vercel Function, montada com o Build Output API v3.
  - A regra de negócio que já existe em `src/lib/server` (Drizzle, gerador de IA, Asaas, e-mail, clínica) é reaproveitada sem cópia. O esbuild resolve `$lib`, e os `$env/*` passam por um shim que lê `process.env`.
  - As form actions do SvelteKit viram rotas REST explícitas em `/api/*`.
- **Auth:** o supabase-js no browser guarda a sessão e a API recebe `Authorization: Bearer <jwt>`. A API valida o token com `auth.getUser(jwt)` e carrega o `professional`. O PostgREST continua fechado para escrita (ver o 0008 da auditoria).
- **Design:** a estrutura vem do Cockpit (tokens semânticos, camada shadcn, `EmptyState`/`StatusChip`/`ErrorBoundary`, e em toda tela o padrão skeleton, depois erro com refetch, depois vazio). A identidade é a do Fisic: Geist e lavanda, com o escuro como padrão e o claro opcional.
- **Corte:** o SvelteKit segue em produção até haver paridade. O `web/` sobe num projeto Vercel separado (staging) e a troca de domínio é uma decisão à parte.

## Consequências

- Durante a migração há dois fronts. O servidor é um só (`src/lib/server`), então a regra de negócio não diverge.
- A landing perde o SSR. Ela será pré-renderizada como HTML estático no build, porque é a única página que precisa de SEO.
- Toda página nova nasce com teste da lógica pura ao lado (`*.test.ts`) e com checagem de dono em toda rota da API.

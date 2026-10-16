# web: app React do Preceptor Fisic

Decisão em [`docs/decisions/0001-web-react.md`](../docs/decisions/0001-web-react.md). Stack e padrões do Cockpit v2, identidade do Fisic.

```bash
npm ci && npm ci --prefix web
cd web
VITE_DEMO=1 npm run dev    # http://localhost:5174 com fixtures (sem banco, sem sessão)
npm run dev                # API real: precisa do ../.env.local (mesmas chaves do SvelteKit)
npm run typecheck && npm test && npm run build
```

Para ver uma tela no celular, use `http://localhost:5174/__dev/mobile.html?b=/rota`: são dois iframes de 390px. A pasta `public/__dev/` só existe localmente e é ignorada pelo git.

## Regras (valem para toda tela)

1. **Regra de negócio fica no servidor que já existe.** A API (`server/routes/<domínio>.ts`) chama funções de `$lib/server/*` (queries, organization, ai…). Não reescreva SQL que já existe. Se faltar uma função, crie em `src/lib/server` (o SvelteKit também passa a poder usar).
2. **Toda rota da API confere o dono do recurso** (`professionalId` do `c.get('professional')`), do mesmo jeito que a form action correspondente do SvelteKit. Use os middlewares `requireUser → requireProfessional → requireAccess`, mais `requireAdmin` no CRM. Valide a entrada com zod. Erros saem em pt-BR como `{ error }`, com o status certo (400/401/402/403/404/409/422/429).
3. **Telas:**
   - Use `PageHeader`.
   - Use `QueryState` (skeleton no formato final, depois erro com "Tentar de novo", depois `EmptyState`) em toda leitura.
   - Use `useMutation` com `toast.success`/`toast.error` em primeira pessoa ("Não consegui salvar: …"), e invalide as chaves afetadas.
4. **Chaves do React Query** são arrays literais exportadas pela página, por exemplo `["aluno", id]`.
5. **Design:**
   - Só tokens (`bg`, `bg-elevated`, `ink`, `ink-soft`, `ink-mute`, `line`, `brand`, `positive`, `warning`, `negative`, `info`).
   - Nada de hex, `style=` com cor, ou gradiente.
   - Todo número usa a classe `num`; o rótulo pequeno usa `eyebrow`.
   - Componentes vêm de `src/components/ui` (shadcn). Nada de `window.confirm`: use `AlertDialog`.
6. **Acessibilidade:**
   - Todo campo tem `Label` (`htmlFor`).
   - Todo botão só com ícone tem `aria-label`.
   - Item clicável é `Link` ou `button`, nunca `div` com onClick.
   - Não remova o foco visível.
7. **Mobile primeiro.** Confira em 390px. Tabela larga vira lista de cards abaixo de `md`.
8. **Lógica pura em `src/lib/*.ts`, com `*.test.ts` ao lado.**
9. **Modo demo:** cada rota nova da API ganha uma fixture em `server/demo/fixtures/<domínio>.ts`, com dados fictícios.
10. **Paridade:** antes de portar uma tela, leia o `+page.svelte` e o `+page.server.ts` dela em `src/routes`. Nenhuma função some sem decisão registrada no PR.

## Onde cada domínio mora

| Domínio | Rotas (front) | API | Telas |
|---|---|---|---|
| alunos | `src/rotas/alunos.tsx` | `server/routes/alunos.ts` | `src/pages/alunos/` |
| treinos | `src/rotas/treinos.tsx` | `server/routes/treinos.ts` | `src/pages/treinos/` |
| rotina | `src/rotas/rotina.tsx` | `server/routes/rotina.ts` | exercícios, agenda, mensagens |
| conta | `src/rotas/conta.tsx` | `server/routes/conta.ts` | configurações, assinatura, upgrade, feedback, guia, equipe, convite, onboarding, recuperar |
| crm | `src/rotas/crm.tsx` | `server/routes/crm.ts` | CRM admin |
| publico | `src/rotas/publico.tsx` | `server/routes/publico.ts` | app do aluno `/a/:id`, landing, legal, apresentação |

As rotas de `publico` ficam **fora** do shell do profissional; as demais ficam dentro dele.

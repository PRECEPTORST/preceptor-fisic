# Redesign do Preceptor Fisic: UI, UX e forma de trabalhar

Pedido do Matheus (16/10/2026): "Quero redesign também, mantendo as cores. Reconstrução da UI/UX e da forma de trabalhar."

Este brief **manda** sobre o layout do SvelteKit. Paridade de **funções** é obrigatória; paridade de **layout** não. Regras técnicas em `web/README.md`.

---

## 1. O problema da forma de trabalhar atual

O trabalho do profissional é sempre a mesma linha (o próprio guia de uso descreve):

**cadastro clínico → avaliação → risco CV → gerar/montar plano → revisar restrições → publicar → acompanhar (aderência, PSE, mensagens) → reavaliar**

No app atual essa linha está espalhada em páginas soltas: `/alunos/[id]`, `/alunos/[id]/avaliacao`, `/alunos/[id]/gerar`, `/planos/[id]`, `/mensagens`. O profissional precisa lembrar qual é o próximo passo e navegar até ele. Há ainda duas listas de alunos (dashboard e `/alunos`), e "Planos" tem dois sentidos.

## 2. Princípios do redesign

1. **O aluno é o centro.** A ficha do aluno vira o espaço de trabalho dele, e todas as etapas da linha acontecem ali, sem trocar de contexto.
2. **Sempre um próximo passo.** Toda ficha mostra a etapa atual da jornada e um botão primário com a próxima ação ("Gerar plano", "Revisar 2 restrições", "Publicar", "Registrar reavaliação").
3. **A visão geral é a fila do dia.** Ela mostra o que precisa de ação e não repete listas.
4. **Ação em painel, não em página.** Editar exercício, trocar exercício, nova avaliação e novo compromisso abrem em `Sheet` (lateral no desktop, de baixo no celular) sobre o contexto. Uma página nova só vale para fluxo longo (cadastro, geração).
5. **Teclado e busca.** `⌘K` / `Ctrl+K` abre a paleta global: buscar aluno, ir para qualquer tela, ações rápidas ("Novo aluno", "Gerar plano para…").
6. **A segurança clínica fica visível.** As restrições do plano são uma checklist de publicação sempre à vista no editor. Publicar fica bloqueado com o motivo escrito, nunca escondido.
7. **Mesmas cores, menos ruído.** Os tokens de hoje continuam. Fica proibido: gradiente, ornamento, glow, chip colorido por enfeite. A lavanda aparece só em ação primária, seleção, foco e no passo atual.

## 3. Arquitetura de informação (menu)

| Item | Rota | O que é |
|---|---|---|
| Visão geral | `/dashboard` | Fila do dia (atenção, agenda de hoje, números) |
| Alunos | `/alunos` | Lista com busca, filtros e o estado da jornada por aluno |
| Treinos | `/treinos` | Todos os planos, filtrados por status (rascunho, em revisão, publicado, arquivado) |
| Exercícios | `/exercicios` | Catálogo e "meus exercícios" em abas da mesma tela |
| Mensagens | `/mensagens` | Caixa de entrada; a conversa também aparece dentro da ficha |
| Agenda | `/agenda` | Semana, com lista no mobile |
| Equipe | `/equipe` | Só para o dono da clínica |
| Conta | Guia, Assinatura, Feedback, Configurações | Rodapé do menu |
| CRM | `/crm` | Só admin |

## 4. Telas-chave

### 4.1 Ficha do aluno (`/alunos/:id`): o espaço de trabalho

```
┌──────────────────────────────────────────────────────────────┐
│ ← Alunos                                                     │
│ (AV) Ana Paula Souza · 34a · Hipertrofia   [Mensagem] [⋯]    │
│ Risco CV: moderado · Plano: Hipertrofia A/B · ativo          │
│                                                              │
│ JORNADA  ●Cadastro ●Avaliação ●Risco ◉Plano ○Revisão ○Pub.   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Próximo passo: revisar 2 restrições do plano  [Revisar →]│ │
│ └──────────────────────────────────────────────────────────┘ │
│ [Resumo] [Treino] [Avaliações] [Clínico] [Mensagens]         │
└──────────────────────────────────────────────────────────────┘
```

- **Componente `JornadaAluno`** (`web/src/components/JornadaAluno.tsx`): recebe o estado e mostra as etapas e o CTA do próximo passo. A regra pura de qual é a etapa atual e qual é o próximo passo fica em `web/src/lib/jornada.ts`, com teste (já criado; o domínio alunos alimenta).
- **Abas:**
  - **Resumo:** sinais de atenção do aluno, aderência e PSE de 7 dias, última sessão, último registro.
  - **Treino:** o plano em vigor, resumido, com "Abrir editor" e o histórico de planos.
  - **Avaliações:** linha do tempo, com "Nova avaliação" em `Sheet` e comparação de números com a anterior.
  - **Clínico:** o perfil clínico e a calculadora de risco CV.
  - **Mensagens:** a conversa com o aluno, embutida.
- **Ações secundárias** ficam no menu `⋯`: editar dados, link do aluno (copiar, reenviar e-mail, revogar), arquivar.

### 4.2 Editor de treino (`/treinos/:id`)

- **Desktop, duas colunas:** à esquerda as sessões (A, B, C…) e os blocos (aquecimento, principal, volta à calma); à direita, a **checklist de publicação** fixa:
  - restrições em vermelho, amarelo e verde, com o motivo e a fonte;
  - "Assumir responsabilidade e liberar";
  - o botão Publicar e o motivo do bloqueio.
- **Celular:** a checklist vira uma barra fixa embaixo ("2 restrições · Revisar") que abre em `Sheet`.
- **Linha do exercício:**
  - nome, séries × repetições, descanso e intensidade, todos em `num`;
  - ações Vídeo, Trocar, Editar e Excluir num menu de linha;
  - reordenar com botões ↑/↓ acessíveis por teclado.
- Editar e Trocar abrem `Sheet` com a busca do catálogo. Excluir e Arquivar pedem confirmação em `AlertDialog`.
- **Geração em andamento:** o plano aparece ao vivo, com o status e o tempo estimado ("15 a 30 s"), e nada some se a pessoa sair da tela.

### 4.3 Gerar plano (`/alunos/:id/gerar`)

É um fluxo em **3 passos numa página só**:
1. Contexto que a IA vai usar, editável (condições, medicações, equipamento, observação profissional).
2. Parâmetros (divisão, frequência, nível).
3. Gerar, com stream ao vivo, e ao terminar ir direto para o editor.

Mostra a cota restante (franquia do plano), escrita com `num`.

### 4.4 Visão geral (já feita, é a referência)

Mostra a fila "Precisa de atenção", os números, a atividade e os próximos 7 dias, e não repete a lista de alunos.

### 4.5 Listas (alunos, treinos, leads, contas)

- **Componente `DataList`** (`web/src/components/DataList.tsx`): tabela no desktop e cards empilhados abaixo de `md`. A linha inteira é um `Link`.
- Barra de filtros com busca e filtros segmentados (`ToggleGroup`). Os filtros ficam **na URL** (`?q=&status=`), para valer no voltar e no compartilhar.
- O vazio diferencia "nenhum cadastro" (com CTA) de "nenhum resultado para o filtro" (com "Limpar filtros").

### 4.6 Formulários

- **Componente `FormSection`:** título em eyebrow, descrição curta, campos em grid de 1 coluna no celular e 2 no desktop.
- **Componente `FormActions`:** barra fixa no rodapé da tela com Cancelar e Salvar. O Salvar mostra estado de carregando e fica desabilitado enquanto envia.
- O erro aparece **no campo** (`aria-invalid` + mensagem ligada por `aria-describedby`) e também num resumo no topo, se houver mais de um.
- Ao sair com alterações não salvas, pedir confirmação (`useAvisoSaida`).

### 4.7 Mensagens (`/mensagens`)

Caixa de entrada em duas colunas no desktop (conversas | conversa) e em pilha no celular. Abrir uma conversa marca como lida e atualiza o badge do menu (invalide `["sessao"]`).

### 4.8 App do aluno (`/a/:id`)

- Feito para o **celular, na academia, com uma mão**.
- Navegação embaixo: Hoje, Histórico, Mensagens.
- **Hoje:** um card grande com o treino do dia e o botão "Começar treino".
- **Execução:** um exercício por vez, com vídeo, séries com steppers grandes (≥ 48px), descanso com timer, e PSE em escala visual de 0 a 10 com rótulos. Termina com observação opcional e "Concluir".
- Safe-area e alvos ≥ 44px. Funciona no tablet sem ficar preso numa coluna de 460px.

### 4.9 CRM

- **Leads:** kanban por etapa no desktop (mover por menu, sem depender de arrastar) e lista agrupada no celular.
- **Contas:** `DataList` com plano, franquia e situação.

### 4.10 Conta

- **Configurações:** abas Perfil, Registro profissional, Aparência e Conta.
- **Assinatura:** plano atual, uso da franquia com barra e `num`, e cards de plano com o mensal e o anual lado a lado.
- **Upgrade:** uma frase do que aconteceu, o plano recomendado e um CTA. Sem tela de preço genérica.

## 5. Linguagem visual (mesmas cores)

| | Regra |
|---|---|
| Cores | Só os tokens do `web/src/index.css`. Lavanda = ação, seleção, foco, passo atual. As semânticas só aparecem em estado. |
| Superfícies | Fundo `bg`. Card `bg-elevated` + `border-line` + `rounded-lg` (12px) + `shadow-card`. Nada de card dentro de card: use divisória (`divide-line`). |
| Tipografia | Título de página `text-h4`, seção `text-h6`, corpo `text-body` (14), apoio `text-caption`, rótulo `eyebrow` (mono 11, caixa alta). Número sempre `num`. |
| Espaço | Escala de 4px. Entre seções `space-y-6`; dentro de card `p-5`; linhas de lista `py-3`. |
| Densidade | Controles de 36 a 40px no desktop e ≥ 44px de toque no celular. |
| Ícones | lucide, 16px (`size-4`), cor `ink-mute`; `brand` só no ativo. |
| Movimento | Entrada de conteúdo com `animate-soft-fade` (≤ 240ms). Hover só com cor. `Sheet` e `Dialog` usam a animação padrão do shadcn. Respeitar `prefers-reduced-motion` (já está global). |
| Texto | pt-BR, frases curtas, verbo no botão ("Gerar plano", não "OK"). Erro em primeira pessoa e com a saída ("Não consegui salvar. Confira a internet e tente de novo."). |

## 6. Componentes compartilhados (use, não recrie)

- `PageHeader`, `QueryState`, `SkeletonLista`, `EmptyState`, `StatusChip`, `Avatar`, `BrandMark`
- `DataList`: tabela e cards responsivos
- `FormSection`, `FormActions`: formulário com barra fixa
- `ConfirmDialog`: confirmação destrutiva em `AlertDialog`
- `JornadaAluno` + `lib/jornada.ts`: jornada e próximo passo
- `Stat`: número com rótulo
- `useFiltrosUrl`: filtros na query string
- `CommandPalette` (⌘K): fica no shell; cada domínio registra comandos em `web/src/lib/comandos.ts`

Para receber estes componentes na sua branch: `git fetch origin feat/web-react && git merge origin/feat/web-react`.

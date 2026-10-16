import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// Manual de uso. No Svelte tinha paleta própria (navy/violeta); aqui só tokens.

type Tom = "dica" | "cuidado" | "clinico";
const TOM: Record<Tom, { cls: string; Icone: typeof Info }> = {
  dica: { cls: "border-info/40 bg-info-soft", Icone: Info },
  cuidado: { cls: "border-warning/40 bg-warning-soft", Icone: AlertTriangle },
  clinico: { cls: "border-negative/40 bg-negative-soft", Icone: ShieldAlert },
};

function Aviso({ tom, rotulo, children }: { tom: Tom; rotulo: string; children: ReactNode }) {
  const { cls, Icone } = TOM[tom];
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4", cls)}>
      <Icone className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
      <p className="text-body text-ink-soft">
        <strong className="mr-1 text-ink">{rotulo}.</strong>
        {children}
      </p>
    </div>
  );
}

const Tela = ({ children }: { children: ReactNode }) => (
  <span className="rounded border border-line bg-bg-subtle px-1.5 py-0.5 font-mono text-caption text-ink">{children}</span>
);
const H3 = ({ children }: { children: ReactNode }) => <h3 className="pt-2 text-body-lg font-semibold text-ink">{children}</h3>;
const Lista = ({ itens }: { itens: ReactNode[] }) => (
  <ul className="list-disc space-y-1 pl-5 marker:text-ink-mute">
    {itens.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ul>
);

type Secao = { id: string; eyebrow: string; titulo: string; corpo: ReactNode };

const SECOES: Secao[] = [
  {
    id: "s1",
    eyebrow: "Visão geral",
    titulo: "O que a plataforma faz",
    corpo: (
      <>
        <p>
          O trabalho na plataforma segue sempre a mesma linha: você cadastra o aluno com o histórico clínico dele, gera um plano de treino
          fundamentado em diretrizes reconhecidas (ACSM, AHA, OMS, ESSA), revisa a prescrição, corrige o que quiser e publica para o aluno
          acompanhar pelo celular. Entre a geração e a publicação, o plano passa por uma checagem clínica automática.
        </p>
        <p>A plataforma tem duas frentes:</p>
        <Lista
          itens={[
            <>
              <strong>Do seu lado</strong>, no computador ou no celular, ficam o cadastro, a geração, a revisão e o acompanhamento de cada
              aluno.
            </>,
            <>
              <strong>Do lado do aluno</strong> fica um aplicativo enxuto, aberto por link, com o treino do dia e o registro de cada série.
            </>,
          ]}
        />
        <Aviso tom="dica" rotulo="Para quem é">
          Personal trainers, fisioterapeutas e clínicas que prescrevem exercício para pessoas com hipertensão, diabetes, cardiopatia, DPOC,
          gestação, pós-cirúrgico e outras condições que exigem cuidado na dose.
        </Aviso>
      </>
    ),
  },
  {
    id: "s2",
    eyebrow: "Configuração",
    titulo: "Primeiro acesso e perfil",
    corpo: (
      <>
        <p>
          No primeiro acesso você informa nome completo, registro profissional (CREF, CREFITO ou CRM) e a especialidade. Esses três dados
          formam sua identidade profissional dentro da plataforma e aparecem para o aluno.
        </p>
        <p>
          Para revisar ou corrigir depois, abra <Tela>Configurações</Tela> no menu. Ali ficam a conta, o e-mail, o registro e a
          especialidade que o aluno enxerga.
        </p>
        <H3>Tema claro e escuro</H3>
        <p>
          A plataforma abre no tema escuro e você troca quando quiser pelo botão de sol e lua, no menu. A escolha fica guardada e vale para
          os próximos acessos. O aplicativo do aluno tem o mesmo botão, e a escolha dele é independente da sua.
        </p>
        <Aviso tom="cuidado" rotulo="Confira o registro">
          O número do CREF ou CREFITO sustenta a responsabilidade técnica da prescrição e fica visível para o aluno. Confira antes de publicar
          o primeiro plano.
        </Aviso>
      </>
    ),
  },
  {
    id: "s3",
    eyebrow: "Rotina",
    titulo: "Painel inicial",
    corpo: (
      <>
        <p>
          A <Tela>Visão geral</Tela> é a primeira tela depois do login. Ela funciona como a sua fila de trabalho do dia. Reúne os alunos que
          precisam de atenção e já os ordena pelo que está parado:
        </p>
        <Lista itens={["Quem ainda não treinou", "Quem sumiu há vários dias", "Quem está sem plano ativo"]} />
        <p>Cada linha leva direto para a ficha do aluno, então você resolve sem procurar.</p>
      </>
    ),
  },
  {
    id: "s4",
    eyebrow: "Alunos",
    titulo: "Cadastrar um aluno",
    corpo: (
      <>
        <p>
          Abra <Tela>Alunos</Tela> e clique em <strong>Novo aluno</strong>. O cadastro tem duas partes: os dados de contato e o perfil
          clínico.
        </p>
        <H3>Perfil clínico</H3>
        <p>É a base de tudo que a plataforma gera depois. Preencha com cuidado:</p>
        <Lista
          itens={[
            <><strong>Diagnósticos</strong> declarados, separados por vírgula</>,
            <><strong>Medicações</strong> em uso</>,
            <><strong>Lesões e limitações</strong> que restringem movimento</>,
            <><strong>Nível de experiência</strong> com treino</>,
            <><strong>Objetivos</strong>, um ou mais</>,
            <><strong>Equipamento disponível</strong>, que define os exercícios possíveis</>,
          ]}
        />
        <H3>Você preenche ou o aluno preenche</H3>
        <p>Há dois caminhos:</p>
        <ol className="list-decimal space-y-1 pl-5 marker:text-ink-mute">
          <li>Você preenche tudo na hora, com o aluno na frente ou a partir de uma avaliação anterior.</li>
          <li>
            Você envia um link para o aluno completar o cadastro pelo celular. Ele recebe o link por e-mail, responde os dados e o cadastro
            chega pronto do seu lado. O aluno não cria conta.
          </li>
        </ol>
        <Aviso tom="clinico" rotulo="Atenção clínica">
          O que você não informar aqui, a plataforma não considera. Uma medicação ou uma lesão omitida no cadastro não entra na geração nem
          na validação. O cadastro completo é a primeira camada de segurança do aluno.
        </Aviso>
      </>
    ),
  },
  {
    id: "s5",
    eyebrow: "Alunos",
    titulo: "Avaliação física",
    corpo: (
      <>
        <p>
          Na ficha do aluno você registra uma <strong>Nova avaliação</strong>. Ela guarda:
        </p>
        <Lista
          itens={[
            "Antropometria (peso e altura, com o IMC calculado na hora)",
            "Composição corporal por bioimpedância, quando houver",
            "Dados cardiovasculares",
            "Observações clínicas",
          ]}
        />
        <p>
          A avaliação fica no histórico do aluno e serve de referência para as próximas. Registre uma no início do acompanhamento e repita nos
          retornos, para medir progresso com número.
        </p>
      </>
    ),
  },
  {
    id: "s6",
    eyebrow: "Prescrição",
    titulo: "Gerar o plano",
    corpo: (
      <>
        <p>
          Com o cadastro pronto, abra a ficha do aluno e use <strong>Gerar treino</strong>. Antes de gerar, a plataforma mostra o contexto
          que vai usar, para você conferir e completar:
        </p>
        <Lista
          itens={[
            "Condições médicas e limitações do aluno",
            "Medicações em uso",
            "Equipamento disponível",
            "Observações profissionais, um campo livre para guiar a geração",
          ]}
        />
        <p>
          A geração leva de 15 a 30 segundos e você vê o plano surgindo ao vivo. Cada recomendação consulta diretrizes reconhecidas e cita a
          fonte, com página e organização.
        </p>
        <Aviso tom="dica" rotulo="Dica">
          Quanto mais específica a observação profissional, mais próximo do que você faria na mão. Um pedido como "priorizar cadeia
          posterior, evitar impacto no joelho" muda o plano inteiro.
        </Aviso>
      </>
    ),
  },
  {
    id: "s7",
    eyebrow: "Segurança",
    titulo: "Validação clínica e restrições",
    corpo: (
      <>
        <p>
          Todo plano gerado passa por uma bateria de regras clínicas antes de você publicar. Elas detectam contraindicações ligadas a
          condições como lesão de ligamento, hipertensão, cardiopatia, gestação e DPOC. O resultado aparece como uma lista de restrições, em
          três níveis:
        </p>
        <Lista
          itens={[
            <><strong className="text-negative">Vermelho</strong>: contraindicação séria. Bloqueia a publicação até você tratar.</>,
            <><strong className="text-warning">Amarelo</strong>: cuidado a observar, sem bloqueio.</>,
            <><strong className="text-positive">Verde</strong>: item aprovado.</>,
          ]}
        />
        <p>
          Cada restrição explica o motivo e cita a diretriz por trás. Uma restrição vermelha traz o botão{" "}
          <strong>Assumir responsabilidade e liberar</strong>. Ao usá-lo, você registra que avaliou o caso e assume a responsabilidade
          técnica pela liberação, e só então o plano pode ir para o aluno.
        </p>
        <Aviso tom="clinico" rotulo="Atenção clínica">
          A validação é uma rede de apoio, não substitui o seu julgamento. Liberar uma restrição vermelha é uma decisão clínica sua,
          registrada em seu nome. Leia o motivo antes de assumir.
        </Aviso>
      </>
    ),
  },
  {
    id: "s8",
    eyebrow: "Prescrição",
    titulo: "Revisar e ajustar",
    corpo: (
      <>
        <p>
          O plano abre organizado por sessão, e cada sessão em três blocos: aquecimento, parte principal e volta à calma. Em cada exercício
          você tem as ações da linha:
        </p>
        <Lista
          itens={[
            <><strong>Vídeo</strong>, abre a demonstração do movimento</>,
            <><strong>Trocar</strong>, substitui o exercício por outro do catálogo</>,
            <><strong>Editar</strong>, ajusta séries, repetições, descanso e intensidade</>,
            <><strong>Excluir</strong>, remove o exercício da sessão</>,
          ]}
        />
        <H3>Mudar a ordem dos exercícios</H3>
        <p>
          As setas ao lado do número da posição movem o exercício uma casa para cima ou para baixo. O movimento acontece dentro do próprio
          bloco, então um exercício da parte principal nunca troca de lugar com um de aquecimento. Reordenar não dispara a validação de novo,
          porque a ordem não muda contraindicação.
        </p>
        <H3>Ver as fontes e revalidar</H3>
        <p>
          O painel de fontes mostra em que diretriz cada recomendação se apoia. Depois de qualquer ajuste que mexa nos exercícios, use{" "}
          <strong>Re-validar</strong> para rodar a checagem clínica sobre a versão nova.
        </p>
      </>
    ),
  },
  {
    id: "s9",
    eyebrow: "Prescrição",
    titulo: "Publicar para o aluno",
    corpo: (
      <>
        <p>
          Com o plano revisado e sem restrição vermelha pendente, use <strong>Publicar para o aluno</strong>. O aluno recebe um link de
          acesso por e-mail e abre o treino direto no celular. Ele não cria conta, não instala aplicativo e não precisa de senha. O link é o
          acesso dele.
        </p>
        <Aviso tom="dica" rotulo="Dica">
          Antes de publicar, gere o PDF em <strong>Imprimir / PDF</strong> se quiser uma cópia do plano para arquivo ou para entregar
          impresso.
        </Aviso>
      </>
    ),
  },
  {
    id: "s10",
    eyebrow: "Aluno",
    titulo: "O aplicativo do aluno",
    corpo: (
      <>
        <p>
          Do lado do aluno, o aplicativo abre no treino do dia. Ele vê a sessão prevista, os exercícios, o tempo estimado e um resumo das
          restrições clínicas que precisa respeitar.
        </p>
        <p>
          A cada série, o aluno registra o peso usado e a percepção de esforço (PSE). Esse registro alimenta o histórico e a sequência de dias
          treinados, que você acompanha em tempo real. Quando o aluno conclui o treino, o progresso aparece do seu lado na hora.
        </p>
        <p>O aplicativo funciona no navegador do celular e pode ser fixado na tela inicial, sem loja de aplicativos.</p>
      </>
    ),
  },
  {
    id: "s11",
    eyebrow: "Biblioteca",
    titulo: "Catálogo de exercícios",
    corpo: (
      <>
        <p>
          O <Tela>Exercícios</Tela> reúne o catálogo com mais de mil exercícios, cada um com vídeo de execução, indexados por grupo muscular.
          Use a busca e os filtros de nível para encontrar o movimento certo.
        </p>
        <H3>Meus exercícios</H3>
        <p>
          Em <strong>Meus exercícios</strong> você cria e mantém os seus próprios movimentos, além do catálogo padrão. Eles ficam disponíveis
          na hora de trocar ou adicionar exercícios em um plano.
        </p>
      </>
    ),
  },
  {
    id: "s12",
    eyebrow: "Acompanhamento",
    titulo: "Mensagens e agenda",
    corpo: (
      <>
        <H3>Mensagens</H3>
        <p>
          Em <Tela>Mensagens</Tela> ficam as conversas com os alunos. Ao abrir uma conversa, você tem o contexto do aluno ao lado e um atalho
          para a ficha completa, então responde sem perder de vista o histórico clínico.
        </p>
        <H3>Agenda</H3>
        <p>
          A <Tela>Agenda</Tela> organiza suas sessões por semana. Em <strong>Nova sessão</strong> você define data, horário e duração, e
          registra os detalhes do encontro. Use para reavaliações, retornos e acompanhamentos presenciais.
        </p>
      </>
    ),
  },
  {
    id: "s13",
    eyebrow: "Conta",
    titulo: "Assinatura e acesso",
    corpo: (
      <>
        <p>
          O acesso à plataforma depende de assinatura ativa. Os planos se diferenciam pelo limite de alunos ativos e pelo número de treinos
          gerados por mês:
        </p>
        <Lista
          itens={[
            <><strong>Básico</strong>, até 40 alunos ativos e 8 treinos gerados por mês</>,
            <><strong>Essencial</strong>, até 60 alunos ativos e 11 treinos gerados por mês</>,
            <><strong>Pro</strong>, até 150 alunos ativos e 25 treinos gerados por mês</>,
            <><strong>Institucional</strong>, até 5 profissionais na mesma clínica, alunos ilimitados e 100 treinos gerados por mês</>,
          ]}
        />
        <p>
          Cada plano tem cobrança mensal ou anual. No ciclo anual você paga dez meses e usa doze. A cobrança é feita por link de pagamento e o
          acesso é liberado assim que o pagamento é confirmado, sem espera manual.
        </p>
        <p>
          Na primeira assinatura a plataforma pede seu CPF ou CNPJ, se ele ainda não estiver no cadastro. Ele é usado para emitir a cobrança e
          fica guardado, então nas trocas de plano e nas renovações seguintes o campo não aparece de novo. O pagamento em si acontece na
          fatura do Asaas, e nenhum dado de cartão passa pelos servidores da plataforma.
        </p>
        <p>
          Com a assinatura em dia, tudo funciona normalmente. Se o pagamento ficar pendente ou a assinatura for cancelada, a geração de novos
          planos é bloqueada até a regularização. Nada é apagado: seus alunos e planos voltam a aparecer assim que o pagamento confirma.
        </p>
        <Aviso tom="dica" rotulo="Onde acompanhar">
          A tela <Tela>Assinatura</Tela>, no menu, mostra o plano atual e a validade.
        </Aviso>
        <Aviso tom="dica" rotulo="Administradores">
          Contas com perfil de administrador têm também o <Tela>CRM</Tela>, que organiza o funil de contatos, da primeira visita ao cadastro e
          à assinatura.
        </Aviso>
      </>
    ),
  },
  {
    id: "s14",
    eyebrow: "Confiança",
    titulo: "Segurança e privacidade",
    corpo: (
      <>
        <p>
          Os dados ficam em servidores no Brasil, em conformidade com a LGPD. O histórico clínico do aluno é dado sensível e recebe tratamento
          próprio: acesso restrito ao profissional responsável, isolamento por conta e trilha de auditoria das gerações.
        </p>
        <p>
          O link de acesso do aluno é assinado e individual. Cada profissional enxerga apenas os próprios alunos. A base legal, os prazos de
          retenção e os direitos do titular estão descritos na Política de Privacidade da plataforma.
        </p>
      </>
    ),
  },
  {
    id: "s15",
    eyebrow: "Ajuda",
    titulo: "Suporte",
    corpo: (
      <>
        <p>
          O <Tela>Feedback</Tela>, no menu, é o canal direto com quem constrói a plataforma. Escolha a categoria que descreve o caso (bug,
          sugestão, dúvida, elogio ou outro) e escreva o que aconteceu. O campo <strong>Onde aconteceu</strong> é opcional, mas preencher com
          a tela ajuda bastante: algo como "tela de gerar plano" já basta.
        </p>
        <p>
          Ao relatar um problema, diga qual aluno e qual plano estavam envolvidos e o que você esperava que acontecesse. Isso encurta bastante
          o caminho até a correção.
        </p>
      </>
    ),
  },
];

export default function Guia() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Guia de uso" title="Manual do PreceptorFISIC" description="Para profissionais CREF e CREFITO." />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Índice" className="lg:sticky lg:top-6 lg:self-start">
          <p className="eyebrow mb-2">Neste guia</p>
          <ol className="grid gap-0.5 text-body sm:grid-cols-2 lg:grid-cols-1">
            {SECOES.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2 rounded px-2 py-1 text-ink-soft hover:bg-bg-subtle hover:text-ink">
                  <span className="num w-5 shrink-0 text-ink-mute">{i + 1}</span>
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0 max-w-[68ch] space-y-10">
          <p className="text-body-lg text-ink-soft">
            O PreceptorFISIC prescreve treino para populações especiais com fundamento em diretrizes clínicas e validação automática antes de
            o plano chegar ao aluno. Este guia mostra como operar cada parte da plataforma, do cadastro do primeiro aluno ao acompanhamento da
            aderência.
          </p>
          {SECOES.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-6 space-y-3 text-body text-ink-soft">
              <p className="eyebrow">{s.eyebrow}</p>
              <h2 id={`${s.id}-t`} className="text-h5 font-semibold text-ink">
                {s.titulo}
              </h2>
              {s.corpo}
            </section>
          ))}
          <p className="border-t border-line pt-5 font-mono text-caption text-ink-mute">
            PreceptorFISIC · Manual de uso · Prescrição clínica validada
          </p>
        </article>
      </div>
    </div>
  );
}

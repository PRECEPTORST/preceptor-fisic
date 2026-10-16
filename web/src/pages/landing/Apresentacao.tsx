import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Contador, useEntrada } from "@/components/landing/movimento";
import { useTitulo } from "@/lib/useTitulo";
import { NUMEROS } from "./Landing";
import { PLANOS, TESTE, WHATS_INSTITUCIONAL, formatarCentavos, hrefCadastro, whatsLink, type Plano } from "./precos";
import "./landing.css";

/**
 * /apresentacao: material de divulgação (porta do SvelteKit
 * src/routes/(public)/apresentacao/+page.svelte). O tronco é comum; o toggle
 * de perfil troca só os argumentos e os planos. Alegações seguem
 * docs/AUDITORIA-LANDING-2026-10.md: sem selo de "mais escolhido", números só
 * os de NUMEROS e preços só os de precos.ts.
 */
export const TITULO_APRESENTACAO = "A plataforma PreceptorFISIC";
export const DESCRICAO_APRESENTACAO =
  "Prescrição de treino para populações especiais com fundamento em diretrizes clínicas e validação automática. Conheça a plataforma por inteiro.";

const WHATS_DUVIDA = whatsLink("Olá! Tenho uma dúvida sobre o PreceptorFISIC.");
const fmt = new Intl.NumberFormat("pt-BR");

type Modulo = { t: string; d: ReactNode };

const MODULOS: Modulo[] = [
  {
    t: "Ficha clínica do aluno",
    d: "Diagnósticos, medicações em uso, lesões e limitações, nível de experiência, objetivos e equipamento disponível. É o que sustenta toda a prescrição depois.",
  },
  {
    t: "Avaliação física",
    d: "Antropometria com IMC na hora, bioimpedância, dados cardiovasculares e observações. Fica no histórico e serve de comparação nos retornos.",
  },
  {
    t: "Risco cardiovascular",
    d: "Escore de Risco Global da SBC calculado no cadastro. O risco estratificado entra na prescrição e aparece na ficha do aluno.",
  },
  {
    t: "Geração do treino",
    d: (
      <>
        Plano completo em <span className="num">15</span> a <span className="num">30</span> segundos, consultando{" "}
        <span className="num">{fmt.format(NUMEROS.trechos)}</span> trechos de <span className="num">{NUMEROS.fontes}</span>{" "}
        fontes (ACSM, AHA, OMS, ESSA, ADA). Cada recomendação cita a fonte, com página e organização.
      </>
    ),
  },
  {
    t: "Validação clínica",
    d: (
      <>
        <span className="num">{NUMEROS.regras}</span> regras rodam sobre todo plano gerado, antes de você publicar. Contraindicação
        séria bloqueia a publicação até você tratar.
      </>
    ),
  },
  {
    t: "Revisão livre",
    d: "Trocar exercício, editar séries e carga, reordenar dentro do bloco ou excluir. O plano é seu, a geração é o ponto de partida.",
  },
  {
    t: "Aplicativo do aluno",
    d: "Abre por link, sem conta, sem senha e sem loja de aplicativos. Treino do dia, registro de carga e percepção de esforço a cada série.",
  },
  {
    t: "Acompanhamento",
    d: "Aderência, sequência de dias treinados e histórico atualizados na hora. O painel abre com quem não treinou e quem sumiu.",
  },
  {
    t: "Catálogo de exercícios",
    d: (
      <>
        <span className="num">{fmt.format(NUMEROS.exercicios)}</span> exercícios, todos com vídeo de execução, indexados por grupo
        muscular, além dos que você mesmo cadastrar.
      </>
    ),
  },
  {
    t: "Mensagens e agenda",
    d: "Conversa com o aluno tendo o histórico clínico ao lado, e a agenda da semana para reavaliações e presenciais.",
  },
  {
    t: "Registro de cada decisão",
    d: "Todo plano guarda o que foi consultado, o que foi gerado e o que você alterou, para consulta a qualquer momento.",
  },
  { t: "PDF do plano", d: "Versão para imprimir ou arquivar, com a identificação do profissional responsável." },
];

const PASSOS = [
  { t: "Cadastre o aluno", d: "Você preenche a ficha clínica ou envia um link para o aluno completar pelo celular." },
  { t: "Gere o plano", d: "A plataforma consulta as diretrizes e monta a periodização, com as fontes citadas." },
  { t: "Revise e assine", d: "As restrições aparecem por gravidade. Você ajusta o que quiser e publica sob sua responsabilidade técnica." },
  { t: "Acompanhe", d: "O aluno treina pelo celular e registra cada série. Você vê a aderência em tempo real." },
];

const ARG_AUTONOMO = [
  {
    t: "A responsabilidade continua sua, o respaldo também",
    d: "Cada plano chega com a diretriz que sustenta a recomendação e passa por checagem de contraindicação antes de você publicar. Você assina sabendo em que se apoiou.",
  },
  {
    t: "A pesquisa que tomava a noite",
    d: "Conferir diretriz para um hipertenso, uma gestante e um pós-cirúrgico levava horas. A consulta às fontes passa a ser parte da geração.",
  },
  {
    t: "Atender mais sem perder o cuidado",
    d: "A ficha clínica, o histórico e a aderência ficam num lugar só. Você acompanha mais alunos sem depender de planilha e memória.",
  },
];

const ARG_CLINICA = [
  {
    t: "O mesmo critério em toda a equipe",
    d: "As diretrizes e as regras de segurança são as mesmas para todos os profissionais. O cuidado deixa de variar conforme quem atendeu.",
  },
  {
    t: "Cada prescrição com responsável identificado",
    d: "Todo plano fica registrado em nome de quem publicou, com o histórico do que foi gerado e do que foi alterado.",
  },
  {
    t: "Onboarding sem travar a operação",
    d: "Profissional novo entra com o mesmo padrão de prescrição desde o primeiro aluno, sem depender de treinamento longo.",
  },
];

const CONFIANCA = [
  { t: "Servidores no Brasil", d: "A base fica em território nacional, em conformidade com a LGPD." },
  { t: "Acesso isolado por conta", d: "Cada profissional enxerga apenas os próprios alunos. O link do aluno é individual e assinado." },
  { t: "Trilha de auditoria", d: "Toda geração fica registrada, com o que foi consultado e o que foi alterado depois." },
];

type Perfil = "autonomo" | "clinica";
const PERFIS: { v: Perfil; rotulo: string }[] = [
  { v: "autonomo", rotulo: "Profissional autônomo" },
  { v: "clinica", rotulo: "Clínica, academia ou estúdio" },
];

const celula = "lp-in card-vivo rounded-lg border border-line bg-bg-elevated p-5 shadow-card";
const botao =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-body-lg font-medium transition-[background-color,transform] duration-150 active:scale-[0.97]";

function Secao({ id, eyebrow, titulo, sub, children }: { id: string; eyebrow: string; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-t`} className="border-t border-line py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="lp-in max-w-2xl">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${id}-t`} className="mt-3 text-h4 font-semibold text-ink sm:text-h3">
            {titulo}
          </h2>
          {sub && <p className="mt-4 text-lead text-ink-soft">{sub}</p>}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function Argumentos({ itens }: { itens: { t: string; d: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {itens.map((a) => (
        <article key={a.t} className="border-l border-line-strong pl-4">
          <h3 className="text-h6 font-semibold text-ink">{a.t}</h3>
          <p className="mt-2 text-body text-ink-soft">{a.d}</p>
        </article>
      ))}
    </div>
  );
}

function CardPlano({ p }: { p: Plano }) {
  const inst = p.chave === "institucional";
  const href = p.chave === "institucional" ? WHATS_INSTITUCIONAL : hrefCadastro(p.chave);
  return (
    <article className="flex flex-col rounded-lg border border-line bg-bg-elevated p-6 shadow-card">
      <h3 className="text-h6 font-semibold text-ink">{p.nome}</h3>
      <p className="mt-3 text-ink">
        {inst && <span className="mr-1 text-caption text-ink-mute">a partir de</span>}
        <span className="num text-h4 font-semibold">{formatarCentavos(p.mensal)}</span>
        <span className="ml-1 text-caption text-ink-mute">/mês</span>
      </p>
      <p className="mt-1 text-caption text-ink-mute">
        {p.anual != null ? (
          <>
            ou <span className="num">{formatarCentavos(p.anual)}</span> por ano: você paga 10 meses e usa 12
          </>
        ) : (
          "Anual negociado pelo WhatsApp"
        )}
      </p>
      <p className="mt-4 text-body text-ink-soft">{p.resumo}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {p.alunos != null && (
          <li className="flex gap-2 text-body text-ink-soft">
            <Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>
              Até <span className="num">{p.alunos}</span> alunos ativos
            </span>
          </li>
        )}
        <li className="flex gap-2 text-body text-ink-soft">
          <Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
          <span>
            Até <span className="num">{p.treinos}</span> treinos gerados por mês
          </span>
        </li>
        {p.itens.map((it) => (
          <li key={it} className="flex gap-2 text-body text-ink-soft">
            <Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <a
        href={href}
        {...(inst ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`${botao} mt-6 w-full ${inst ? "border border-line-strong text-ink hover:bg-bg-subtle" : "bg-brand text-brand-on hover:bg-brand-strong"}`}
      >
        {inst ? "Falar com o time" : "Começar 7 dias grátis"}
      </a>
    </article>
  );
}

export default function Apresentacao() {
  useTitulo(TITULO_APRESENTACAO, DESCRICAO_APRESENTACAO);
  const raiz = useRef<HTMLDivElement>(null);
  useEntrada(raiz);
  const [perfil, setPerfil] = useState<Perfil>("autonomo");
  const abas = useRef<(HTMLButtonElement | null)[]>([]);

  // Peça de divulgação: escura mesmo com tema claro no app (igual à landing).
  useEffect(() => {
    const html = document.documentElement;
    const tinhaClaro = html.classList.contains("light");
    html.classList.remove("light");
    return () => {
      if (tinhaClaro) html.classList.add("light");
    };
  }, []);

  const teclaAba = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const prox = (i + (e.key === "ArrowRight" ? 1 : -1) + PERFIS.length) % PERFIS.length;
    setPerfil(PERFIS[prox]?.v ?? "autonomo");
    abas.current[prox]?.focus();
  };

  const planos = perfil === "autonomo" ? PLANOS.filter((p) => p.chave !== "institucional") : PLANOS.filter((p) => p.chave === "institucional");

  return (
    <div ref={raiz} className="lp-escuro min-h-screen font-sans">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-bg-elevated focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 rounded-md">
            <BrandMark size={22} />
            <span className="text-body font-semibold tracking-tight text-ink">PreceptorFISIC</span>
          </a>
          <a href={hrefCadastro()} className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-body font-medium text-brand-on transition-colors hover:bg-brand-strong">
            Começar 7 dias grátis
          </a>
        </div>
      </header>

      <main id="conteudo">
        <section className="pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="lp-in eyebrow">Para profissionais CREF e CREFITO</p>
            <h1 className="lp-in mt-4 max-w-3xl text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-h1" style={{ ["--i" as string]: 1 }}>
              Prescrição para populações especiais com diretriz por trás.
            </h1>
            <p className="lp-in mt-6 max-w-2xl text-lead text-ink-soft" style={{ ["--i" as string]: 2 }}>
              O PreceptorFISIC monta o plano de treino a partir da ficha clínica do aluno, consulta as diretrizes reconhecidas na área
              e roda uma checagem de contraindicação antes de o plano chegar ao aluno. Você revisa, ajusta e publica sob sua
              responsabilidade técnica.
            </p>
            <ul className="lp-in mt-8 flex flex-wrap gap-2" style={{ ["--i" as string]: 3 }}>
              {[
                <>ACSM · AHA · OMS · ESSA · ADA</>,
                <>
                  <span className="num">{NUMEROS.regras}</span> regras clínicas
                </>,
                <>Servidores no Brasil · LGPD</>,
              ].map((m, i) => (
                <li key={i} className="rounded-full border border-line px-3 py-1.5 text-caption text-ink-soft">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-label="Números da base" className="border-t border-line py-12">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:px-6 md:grid-cols-4">
            {[
              { v: NUMEROS.trechos, r: "trechos de diretrizes" },
              { v: NUMEROS.fontes, r: "fontes na base" },
              { v: NUMEROS.exercicios, r: "exercícios com vídeo" },
              { v: NUMEROS.regras, r: "regras clínicas" },
            ].map((n, i) => (
              <div key={n.r} className="lp-in flex flex-col" style={{ ["--i" as string]: i }}>
                <dt className="text-caption text-ink-mute">{n.r}</dt>
                <dd className="order-first">
                  <Contador valor={n.v} className="text-h3 font-semibold text-ink" />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <Secao id="modulos" eyebrow="O que tem dentro" titulo="A plataforma por inteiro" sub="Do cadastro do aluno ao acompanhamento da aderência, sem trocar de ferramenta.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m, i) => (
              <article key={m.t} className={celula} style={{ ["--i" as string]: i % 3 }}>
                <h3 className="text-h6 font-semibold text-ink">{m.t}</h3>
                <p className="mt-2 text-body text-ink-soft">{m.d}</p>
              </article>
            ))}
          </div>
        </Secao>

        <Secao id="passos" eyebrow="Como funciona" titulo="Quatro passos, do cadastro ao treino">
          <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p, i) => (
              <li key={p.t} className="lp-in lp-passo border-t border-line-strong pt-5" style={{ ["--i" as string]: i }}>
                <span className="num text-caption text-brand">0{i + 1}</span>
                <h3 className="mt-3 text-h6 font-semibold text-ink">{p.t}</h3>
                <p className="mt-2 text-body text-ink-soft">{p.d}</p>
              </li>
            ))}
          </ol>
        </Secao>

        <Secao id="perfil" eyebrow="Para o seu caso" titulo="Escolha o seu perfil" sub="Os argumentos e os planos abaixo se ajustam ao que você faz.">
          <div role="tablist" aria-label="Perfil" className="lp-in grid w-full grid-cols-1 gap-1 rounded-lg border border-line bg-bg-elevated p-1 sm:inline-grid sm:w-auto sm:grid-cols-2">
            {PERFIS.map((p, i) => {
              const ativo = perfil === p.v;
              return (
                <button
                  key={p.v}
                  ref={(el) => (abas.current[i] = el)}
                  role="tab"
                  id={`aba-${p.v}`}
                  aria-selected={ativo}
                  aria-controls="painel-perfil"
                  tabIndex={ativo ? 0 : -1}
                  onClick={() => setPerfil(p.v)}
                  onKeyDown={(e) => teclaAba(e, i)}
                  className={`min-h-11 rounded-md px-5 text-body font-medium transition-colors ${ativo ? "bg-brand text-brand-on" : "text-ink-soft hover:text-ink"}`}
                >
                  {p.rotulo}
                </button>
              );
            })}
          </div>

          <div id="painel-perfil" role="tabpanel" aria-labelledby={`aba-${perfil}`} className="mt-10 space-y-12">
            <Argumentos itens={perfil === "autonomo" ? ARG_AUTONOMO : ARG_CLINICA} />
            <div className={`grid grid-cols-1 gap-4 ${perfil === "autonomo" ? "md:grid-cols-3" : "max-w-md"}`}>
              {planos.map((p) => (
                <CardPlano key={p.chave} p={p} />
              ))}
            </div>
            {perfil === "autonomo" && (
              <p className="text-caption text-ink-mute">
                Teste de <span className="num">{TESTE.dias}</span> dias sem cartão, com <span className="num">{TESTE.treinos}</span> treinos
                por IA e até <span className="num">{TESTE.alunos}</span> alunos.
              </p>
            )}
          </div>
        </Secao>

        <Secao id="confianca" eyebrow="Confiança" titulo="Dado de saúde tratado como dado de saúde">
          <Argumentos itens={CONFIANCA} />
        </Secao>

        <section className="border-t border-line py-20 sm:py-24">
          <div className="lp-in mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-h4 font-semibold text-ink sm:text-h3">Cadastre o primeiro aluno hoje</h2>
            <p className="mt-4 text-lead text-ink-soft">O primeiro plano já sai com as fontes citadas e as restrições clínicas apontadas.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={hrefCadastro()} className={`${botao} bg-brand text-brand-on hover:bg-brand-strong`}>
                Começar 7 dias grátis <ArrowRight className="seta-anda size-4" aria-hidden="true" />
              </a>
              <a href={WHATS_DUVIDA} target="_blank" rel="noopener noreferrer" className={`${botao} border border-line-strong font-normal text-ink hover:bg-bg-subtle`}>
                <MessageCircle className="size-4 text-ink-mute" aria-hidden="true" /> Tirar uma dúvida
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-caption text-ink-mute sm:flex-row sm:items-center sm:px-6">
          <span className="flex flex-1 items-center gap-2">
            <BrandMark size={18} /> PreceptorFISIC · Prescrição clínica validada
          </span>
          <a href="/legal/privacidade" className="transition-colors hover:text-ink">Privacidade</a>
          <a href="/legal/termos" className="transition-colors hover:text-ink">Termos</a>
        </div>
      </footer>
    </div>
  );
}

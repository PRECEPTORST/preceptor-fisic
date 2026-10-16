import { useEffect, useRef } from "react";
import { ArrowRight, Clock, FileQuestion, Link2, MessageCircle, ShieldAlert, Smartphone, UserPlus, Wand2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Navbar } from "@/components/landing/Navbar";
import { PreviaPlano } from "@/components/landing/PreviaPlano";
import { Precos } from "@/components/landing/Precos";
import { Contador, useEntrada } from "@/components/landing/movimento";
import { TESTE, WHATS_HUMANO, hrefCadastro } from "./precos";
import "./landing.css";

export const CONTATO_EMAIL: string =
  (import.meta.env.PUBLIC_CONTATO_EMAIL as string | undefined) || "preceptorfisic@ospreceptores.com";

/** Números conferidos no banco de produção em 16/10/2026. */
export const NUMEROS = { trechos: 2040, fontes: 49, exercicios: 1324, regras: 23 } as const;

const POPULACOES = ["Hipertensão", "Diabetes", "Cardiopatia", "DPOC", "Pós-LCA", "Gestantes", "Idosos frágeis", "Oncológicos"];

const REVISORES = [
  { nome: "José Jonas de Oliveira", titulo: "Doutor em Ciência do Movimento Humano" },
  { nome: "Anna Gabriela Silva Vilela Ribeiro", titulo: "Doutora em Ciência do Movimento Humano" },
  { nome: "Alexandre de Souza e Silva", titulo: "Doutor em Ciências do Desporto" },
];

const DORES = [
  {
    icone: ShieldAlert,
    titulo: "Medo de errar",
    texto: "Hipertenso, gestante, pós-cirúrgico: uma prescrição errada vira risco real, e a responsabilidade técnica é sua.",
  },
  {
    icone: Clock,
    titulo: "Tempo perdido",
    texto: "Horas pesquisando diretriz, montando planilha e conferindo contraindicação aluno por aluno. Não escala.",
  },
  {
    icone: FileQuestion,
    titulo: "IA genérica não cita fonte",
    texto: "Chatbots genéricos respondem com confiança, sem dizer de onde tiraram. Em população especial, isso não serve.",
  },
];

const PASSOS = [
  {
    icone: UserPlus,
    titulo: "Cadastre o aluno",
    texto: "Histórico clínico, comorbidades, medicamentos, risco cardiovascular e preferências, numa tela só.",
  },
  {
    icone: Wand2,
    titulo: "Gere o plano",
    texto: "Em 15–30 s o plano aparece ao vivo, com as fontes citadas e as regras clínicas conferidas antes de publicar.",
  },
  {
    icone: Link2,
    titulo: "O aluno recebe um link",
    texto: "Abre no celular, sem login: treino do dia, registro das séries e histórico.",
  },
];

// Títulos reais da base (knowledge_sources), conferidos em 16/10/2026. Não invente fonte:
// a página promete citação real.
const FONTES = [
  { org: "ACSM", titulo: "ACSM's Guidelines for Exercise Testing and Prescription" },
  { org: "ACSM", titulo: "ACSM — Treinamento Resistido (2026)" },
  { org: "ACSM", titulo: "ACSM Expert Consensus Statement" },
  { org: "ACC/AHA", titulo: "Diretriz de Hipertensão (2025)" },
];

const FAQ = [
  {
    p: "O que conta como treino gerado?",
    r: "Cada vez que você pede à IA um plano novo para um aluno, conta uma geração. Editar, re-validar e publicar um plano que já existe não conta. A contagem recomeça a cada ciclo da assinatura.",
  },
  {
    p: "O que acontece depois dos 7 dias grátis?",
    r: `O teste não pede cartão e inclui ${TESTE.treinos} treinos por IA e até ${TESTE.alunos} alunos. Quando acaba, você escolhe um plano. Sem assinatura, a geração de novos planos fica bloqueada, mas nada é apagado: alunos e planos continuam lá.`,
  },
  {
    p: "Como funciona o cancelamento?",
    r: "A cobrança é por link de pagamento, mensal ou anual. Se a assinatura for cancelada ou o pagamento ficar pendente, só a geração de novos planos é bloqueada. Você continua entrando, consultando alunos e planos publicados. Para cancelar, fale com a gente pelo WhatsApp ou e-mail.",
  },
  {
    p: "Onde ficam os dados dos meus alunos? E a LGPD?",
    r: "Em servidores no Brasil, em conformidade com a LGPD. O histórico clínico é dado sensível: acesso restrito ao profissional responsável, isolamento por conta e trilha de auditoria das gerações. Cada profissional enxerga só os próprios alunos, e o link do aluno é assinado e individual.",
  },
  {
    p: "Quem responde pela prescrição?",
    r: "Você. A plataforma é apoio: cita as diretrizes e aponta contraindicações, mas não substitui o seu julgamento. Uma restrição vermelha só é liberada quando você assume a responsabilidade técnica, e isso fica registrado em seu nome.",
  },
  {
    p: "Preciso ter CREF ou CREFITO?",
    r: "Sim. A plataforma é para profissionais registrados. No primeiro acesso você informa o registro (CREF, CREFITO ou CRM), que sustenta a responsabilidade técnica e aparece para o aluno.",
  },
];

function CtaPrincipal({ className = "" }: { className?: string }) {
  return (
    <a
      href={hrefCadastro()}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-md bg-brand px-5 text-body-lg font-medium text-brand-on transition-colors hover:bg-brand-strong ${className}`}
    >
      Começar 7 dias grátis <ArrowRight className="size-4" aria-hidden="true" />
    </a>
  );
}

function CtaHumano() {
  return (
    <a
      href={WHATS_HUMANO}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line-strong px-5 text-body-lg text-ink transition-colors hover:bg-bg-subtle"
    >
      <MessageCircle className="size-4 text-ink-mute" aria-hidden="true" /> Falar com um humano
    </a>
  );
}

function Secao({ id, eyebrow, titulo, sub, children }: { id?: string; eyebrow: string; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-t` : undefined} className="border-t border-line py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="lp-in max-w-2xl">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={id ? `${id}-t` : undefined} className="mt-3 text-h4 font-semibold text-ink sm:text-h3">
            {titulo}
          </h2>
          {sub && <p className="mt-4 text-lead text-ink-soft">{sub}</p>}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

const celula = "lp-in rounded-lg border border-line bg-bg-elevated p-5 shadow-card";

export default function Landing({ logado = false }: { logado?: boolean }) {
  const raiz = useRef<HTMLDivElement>(null);
  useEntrada(raiz);

  // Mesmo com tema claro escolhido no app, a landing fica escura enquanto montada.
  useEffect(() => {
    const html = document.documentElement;
    const tinhaClaro = html.classList.contains("light");
    html.classList.remove("light");
    return () => {
      if (tinhaClaro) html.classList.add("light");
    };
  }, []);

  return (
    <div ref={raiz} className="lp-escuro min-h-screen font-sans">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-bg-elevated focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <Navbar logado={logado} />

      <main id="conteudo">
        {/* 2 · Hero */}
        <section className="pb-16 pt-28 sm:pb-24 sm:pt-36">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="lp-in eyebrow">Para profissionais CREF e CREFITO</p>
              <h1 className="lp-in mt-4 text-[40px] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-h1" style={{ ["--i" as string]: 1 }}>
                Prescreva treinos com rigor clínico.
              </h1>
              <p className="lp-in mt-6 max-w-xl text-lead text-ink-soft" style={{ ["--i" as string]: 2 }}>
                Planos para populações especiais gerados a partir de diretrizes ACSM, com cada fonte citada e regras clínicas
                conferidas antes de chegar ao aluno.
              </p>
              <div className="lp-in mt-8 flex flex-col gap-3 sm:flex-row" style={{ ["--i" as string]: 3 }}>
                <CtaPrincipal />
                <a
                  href="#como-funciona"
                  className="inline-flex h-12 items-center justify-center rounded-md px-5 text-body-lg text-ink-soft transition-colors hover:text-ink"
                >
                  Ver como funciona
                </a>
              </div>
              <p className="lp-in mt-4 text-caption text-ink-mute" style={{ ["--i" as string]: 4 }}>
                {TESTE.dias} dias grátis, sem cartão · {TESTE.treinos} treinos por IA · até {TESTE.alunos} alunos
              </p>
            </div>
            <div className="lp-in" style={{ ["--i" as string]: 3 }}>
              <PreviaPlano />
            </div>
          </div>
        </section>

        {/* 3 · Populações + revisores */}
        <section aria-label="Para quem é e quem revisa" className="border-t border-line py-12">
          <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-6">
            <div className="lp-in">
              <p className="eyebrow">Populações especiais</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {POPULACOES.map((p) => (
                  <li key={p} className="rounded-full border border-line px-3 py-1.5 text-caption text-ink-soft">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-in">
              <p className="eyebrow">Conteúdo científico revisado por</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {REVISORES.map((r) => (
                  <li key={r.nome} className="border-l border-line-strong pl-4">
                    <p className="text-body font-medium text-ink">{r.nome}</p>
                    <p className="text-caption text-ink-mute">{r.titulo}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 4 · Problema */}
        <Secao eyebrow="O problema" titulo="Prescrever para população especial pesa.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {DORES.map((d, i) => (
              <article key={d.titulo} className={celula} style={{ ["--i" as string]: i }}>
                <d.icone className="size-5 text-ink-mute" aria-hidden="true" />
                <h3 className="mt-4 text-h6 font-semibold text-ink">{d.titulo}</h3>
                <p className="mt-2 text-body text-ink-soft">{d.texto}</p>
              </article>
            ))}
          </div>
        </Secao>

        {/* 5 · Como funciona */}
        <Secao id="como-funciona" eyebrow="Como funciona" titulo="Do cadastro ao celular do aluno em três passos.">
          <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="lp-in border-t border-line-strong pt-5" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="num text-caption text-brand">0{i + 1}</span>
                  <p.icone className="size-4 text-ink-mute" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-h6 font-semibold text-ink">{p.titulo}</h3>
                <p className="mt-2 text-body text-ink-soft">{p.texto}</p>
              </li>
            ))}
          </ol>
        </Secao>

        {/* 6 · Plataforma (bento) */}
        <Secao
          id="plataforma"
          eyebrow="Plataforma"
          titulo="ACSM tem prioridade nas fontes."
          sub="Quando duas diretrizes cobrem o mesmo ponto e uma é ACSM, a ACSM ganha. Cada recomendação mostra de onde veio."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
            <article className={`${celula} md:col-span-2 md:row-span-2`}>
              <p className="eyebrow">Exemplo · aluno com hipertensão</p>
              <h3 className="mt-2 text-h6 font-semibold text-ink">As fontes por trás de uma recomendação</h3>
              <ul className="mt-5 divide-y divide-line rounded-md border border-line">
                {FONTES.map((f) => (
                  <li key={f.titulo} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`num w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-caption ${
                        f.org === "ACSM" ? "bg-brand-soft text-brand" : "border border-line text-ink-soft"
                      }`}
                    >
                      {f.org}
                    </span>
                    <span className="text-body text-ink-soft">{f.titulo}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-caption text-ink-mute">
                <span className="num">3</span> das <span className="num">4</span> fontes desta recomendação são ACSM. A base
                reúne <span className="num">{NUMEROS.fontes}</span> fontes: ACSM, ESSA, AHA, OMS e ADA.
              </p>
            </article>
            <article className={celula}>
              <Contador valor={NUMEROS.regras} className="text-h3 font-semibold text-ink" />
              <h3 className="mt-2 text-body font-medium text-ink">regras clínicas</h3>
              <p className="mt-1 text-caption text-ink-mute">LCA, hipertensão, cardiopatia, gestação, DPOC… conferidas em todo plano antes de publicar.</p>
            </article>
            <article className={celula}>
              <Contador valor={NUMEROS.trechos} className="text-h3 font-semibold text-ink" />
              <h3 className="mt-2 text-body font-medium text-ink">trechos de diretrizes</h3>
              <p className="mt-1 text-caption text-ink-mute">Consultados na hora de gerar, com página e organização na citação.</p>
            </article>
            <article className={`${celula} md:col-span-2`}>
              <Contador valor={NUMEROS.exercicios} className="text-h3 font-semibold text-ink" />
              <h3 className="mt-2 text-body font-medium text-ink">exercícios, todos com vídeo</h3>
              <p className="mt-1 text-caption text-ink-mute">O aluno vê a execução antes de cada série.</p>
            </article>
            <article className={celula}>
              <Smartphone className="size-5 text-ink-mute" aria-hidden="true" />
              <h3 className="mt-3 text-body font-medium text-ink">App do aluno</h3>
              <p className="mt-1 text-caption text-ink-mute">Link no celular, sem login. Treino do dia, séries e histórico.</p>
            </article>
          </div>
        </Secao>

        {/* 7 · Preços */}
        <Secao id="precos" eyebrow="Preços" titulo="Planos por número de alunos e de treinos." sub="Mesma base científica em todos os planos. No anual, você paga 10 meses e usa 12.">
          <Precos />
        </Secao>

        {/* 8 · FAQ */}
        <Secao id="faq" eyebrow="FAQ" titulo="Perguntas frequentes">
          <Accordion type="single" collapsible className="lp-in max-w-3xl">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.p} value={`q${i}`} className="border-line">
                <AccordionTrigger className="min-h-12 text-left text-body-lg text-ink hover:no-underline">{f.p}</AccordionTrigger>
                <AccordionContent className="text-body text-ink-soft">{f.r}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Secao>

        {/* 9 · CTA final */}
        <section className="border-t border-line py-20 sm:py-24">
          <div className="lp-in mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-h4 font-semibold text-ink sm:text-h3">Seu próximo plano pode sair com a fonte do lado.</h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaPrincipal />
              <CtaHumano />
            </div>
          </div>
        </section>
      </main>

      {/* 10 · Rodapé */}
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <a href="/" className="flex items-center gap-2">
              <BrandMark size={20} />
              <span className="text-body font-semibold text-ink">PreceptorFISIC</span>
            </a>
            <p className="mt-3 text-caption text-ink-mute">Prescrição clínica de exercício para profissionais CREF e CREFITO.</p>
          </div>
          {[
            { t: "Plataforma", l: [["Como funciona", "#como-funciona"], ["Plataforma", "#plataforma"], ["Preços", "#precos"], ["FAQ", "#faq"]] },
            { t: "Acesso", l: [[logado ? "Abrir o app" : "Entrar", logado ? "/dashboard" : "/login"], ["Criar conta", hrefCadastro()]] },
            { t: "Contato e legal", l: [[CONTATO_EMAIL, `mailto:${CONTATO_EMAIL}`], ["WhatsApp", WHATS_HUMANO], ["Privacidade", "/legal/privacidade"], ["Termos", "/legal/termos"]] },
          ].map((c) => (
            <div key={c.t}>
              <p className="eyebrow">{c.t}</p>
              <ul className="mt-3 space-y-2">
                {c.l.map(([r, h]) => (
                  <li key={r}>
                    <a href={h} className="break-all text-caption text-ink-soft transition-colors hover:text-ink">
                      {r}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-caption text-ink-mute sm:flex-row sm:justify-between sm:px-6">
            <span>Construído em São Paulo · Servidores no Brasil</span>
            <span>Diretrizes ACSM · ESSA · AHA · OMS · ADA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

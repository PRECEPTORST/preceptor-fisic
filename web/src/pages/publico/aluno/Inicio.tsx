import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Flame, Moon, Play, Sun } from "lucide-react";
import { apiAluno } from "@/lib/aluno-api";
import { NOME_DIA, letra, proximaSessao, sessaoDeHoje } from "@/lib/aluno-treino";
import { alternarTema, lerTema, type Tema } from "@/lib/theme";
import { CONTATO_EMAIL } from "@/lib/contato";
import { useTitulo } from "@/lib/useTitulo";
import { cn } from "@/lib/utils";
import { AlunoShell, useAlunoLink } from "@/components/publico/AlunoShell";
import { AlunoEstado } from "@/components/publico/AlunoEstado";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { chaveAluno, type InicioAluno } from "./tipos";

export default function Inicio() {
  const { id, token } = useAlunoLink();
  const q = useQuery({ queryKey: chaveAluno(id), queryFn: () => apiAluno<InicioAluno>(id, token) });
  useTitulo(q.data ? `${q.data.student.name} · PreceptorFISIC` : "Meu treino · PreceptorFISIC");
  useAvisoTreinoRegistrado();

  return (
    <AlunoShell naoLidas={q.data?.unreadMessages ?? 0}>
      <AlunoEstado query={q} skeleton={<InicioSkeleton />}>
        {(d) => <Conteudo d={d} />}
      </AlunoEstado>
    </AlunoShell>
  );
}

/** Volta do registro do treino com ?just_completed=1: avisa e limpa a URL. */
function useAvisoTreinoRegistrado() {
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get("just_completed") !== "1") return;
    toast.success("Treino registrado. Sequência +1.");
    const n = new URLSearchParams(sp);
    n.delete("just_completed");
    setSp(n, { replace: true });
  }, [sp, setSp]);
}

function Conteudo({ d }: { d: InicioAluno }) {
  const { base, q } = useAlunoLink();
  const navigate = useNavigate();
  const sessoes = d.plan?.planData.weekly_sessions ?? [];
  const hoje = new Date();
  const iHoje = sessaoDeHoje(sessoes, hoje);
  const iProx = proximaSessao(sessoes, hoje);
  const primeiro = d.student.name.split(" ")[0];
  const restricoes = (d.plan?.planData.restrictions ?? []).filter((r) => r.title && r.level !== "green");
  const feitos = Math.min(d.sessionsThisWeek, d.weeklyTarget);

  return (
    <div className="animate-soft-fade space-y-6 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).replace(".", "")}
          </p>
          <h1 className="mt-1 truncate text-h5 font-medium">Olá, {primeiro}</h1>
        </div>
        <BotaoTema />
        <Avatar nome={d.student.name} size={40} />
      </header>

      {!d.plan ? (
        <EmptyState
          compact
          decorative="/—"
          title="Seu plano ainda não chegou"
          description={`${d.professional.name} ainda não publicou um plano para você. Assim que publicar, ele aparece aqui.`}
        />
      ) : (
        <>
          {iHoje >= 0 && sessoes[iHoje] ? (
            <CardHoje d={d} idx={iHoje} onComecar={() => navigate(`${base}/treino/${iHoje}${q}`)} />
          ) : iProx >= 0 && sessoes[iProx] ? (
            <section aria-labelledby="descanso" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
              <p className="eyebrow">Hoje é descanso</p>
              <h2 id="descanso" className="mt-2 text-h5 font-medium">
                Sem treino hoje
              </h2>
              <p className="mt-1 text-body text-ink-soft">
                Próximo: {sessoes[iProx]!.label ?? "Sessão"}
                {sessoes[iProx]!.day_of_week ? `, ${NOME_DIA[sessoes[iProx]!.day_of_week!]}` : ""}
              </p>
              <Button asChild variant="outline" className="mt-5 h-12 w-full text-body-lg">
                <Link to={`${base}/treino/${iProx}${q}`}>Ver o próximo treino</Link>
              </Button>
            </section>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-bg-elevated p-4 shadow-card">
              <p className="eyebrow flex items-center gap-1.5">
                <Flame className="size-3.5" aria-hidden /> Sequência
              </p>
              <p className="mt-2">
                <span className="num text-h3 font-medium">{d.streakDays}</span>{" "}
                <span className="text-caption text-ink-mute">{d.streakDays === 1 ? "dia" : "dias"}</span>
              </p>
            </div>
            <div className="rounded-lg border border-line bg-bg-elevated p-4 shadow-card">
              <p className="eyebrow">Esta semana</p>
              <p className="mt-2">
                <span className="num text-h3 font-medium">
                  {feitos}/{d.weeklyTarget}
                </span>{" "}
                <span className="text-caption text-ink-mute">treinos</span>
              </p>
            </div>
          </div>

          {restricoes.length > 0 && (
            <section aria-labelledby="atencao" className="rounded-lg border border-warning/40 bg-bg-elevated shadow-card">
              <header className="flex items-center gap-2 px-5 pt-5">
                <AlertTriangle className="size-4 text-warning" aria-hidden />
                <h2 id="atencao" className="text-h6 font-medium">
                  Antes de treinar, atenção a {restricoes.length === 1 ? "um ponto" : `${restricoes.length} pontos`}
                </h2>
              </header>
              <ul className="mt-3 divide-y divide-line">
                {restricoes.map((r, i) => (
                  <li key={i} className="flex gap-3 px-5 py-3">
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.level === "red" ? "bg-negative" : "bg-warning")}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="sr-only">{r.level === "red" ? "Importante: " : "Atenção: "}</span>
                        {r.title}
                      </p>
                      {r.description && <p className="mt-0.5 text-caption text-ink-soft">{r.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-5 py-3 text-caption text-ink-mute">
                Prescrito por {d.professional.name}. Na dúvida, fale com seu treinador antes de treinar.
              </p>
            </section>
          )}

          <section aria-labelledby="plano">
            <h2 id="plano" className="eyebrow mb-2">
              Seu plano
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card">
              {sessoes.map((s, i) => (
                <li key={i}>
                  <Link
                    to={`${base}/treino/${i}${q}`}
                    className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle"
                  >
                    <span
                      className={cn(
                        "num flex size-10 shrink-0 items-center justify-center rounded-md border text-body-lg font-medium",
                        i === iHoje ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft",
                      )}
                      aria-hidden
                    >
                      {letra(i)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{s.label ?? `Treino ${letra(i)}`}</span>
                        {i === iHoje && <StatusChip tone="brand">hoje</StatusChip>}
                      </span>
                      <span className="block truncate text-caption text-ink-mute">
                        {s.day_of_week ? `${NOME_DIA[s.day_of_week]} · ` : ""}
                        <span className="num">{s.main?.length ?? 0}</span> exercícios
                        {s.duration_minutes ? (
                          <>
                            {" "}
                            · <span className="num">{s.duration_minutes}</span> min
                          </>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex gap-3 rounded-lg border border-line bg-bg-elevated p-4 shadow-card">
            <Avatar nome={d.professional.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.professional.name}</p>
              <p className="text-caption text-ink-mute">Seu treinador{d.professional.cref ? ` · ${d.professional.cref}` : ""}</p>
              <p className="mt-2 text-body text-ink-soft">
                Plano em vigor. Treine no seu ritmo, prestando atenção às restrições e ao monitoramento que combinamos.
              </p>
              <Link to={`${base}/mensagens${q}`} className="mt-2 inline-flex min-h-11 items-center text-body font-medium text-brand">
                Mandar mensagem
              </Link>
            </div>
          </section>
        </>
      )}

      {/* LGPD art. 18: canal de direitos do titular. */}
      <p className="pb-2 text-caption text-ink-mute">
        Seus dados são tratados conforme a{" "}
        <Link to="/legal/privacidade" target="_blank" className="text-ink-soft underline underline-offset-2">
          Política de Privacidade
        </Link>
        . Para corrigir ou excluir seus dados, fale com seu treinador ou escreva para{" "}
        <a href={`mailto:${CONTATO_EMAIL}`} className="break-words text-ink-soft underline underline-offset-2">
          {CONTATO_EMAIL}
        </a>
        .
      </p>

      <BoasVindas id={d.student.id} aluno={primeiro ?? ""} treinador={d.professional.name} />
    </div>
  );
}

function CardHoje({ d, idx, onComecar }: { d: InicioAluno; idx: number; onComecar: () => void }) {
  const s = d.plan!.planData.weekly_sessions![idx]!;
  const miniaturas = (s.main ?? [])
    .map((ex) => ({ nome: ex.name, src: ex.catalog_id ? d.videoByCatalogId[ex.catalog_id] : undefined }))
    .filter((t): t is { nome: string; src: string } => Boolean(t.src))
    .slice(0, 6);
  return (
    <section aria-labelledby="hoje" className="rounded-lg border border-brand/40 bg-bg-elevated p-5 shadow-card">
      <p className="eyebrow text-brand">Treino de hoje</p>
      <h2 id="hoje" className="mt-2 text-h4 font-medium">
        {s.label ?? "Sessão"}
      </h2>
      {s.focus && <p className="mt-1 text-body text-ink-soft">{s.focus}</p>}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          ["Exercícios", String(s.main?.length ?? 0)],
          ["Tempo", s.duration_minutes ? `${s.duration_minutes} min` : "—"],
          ["Restrições", String(d.plan!.planData.restrictions?.length ?? 0)],
        ].map(([l, v]) => (
          <div key={l}>
            <dt className="eyebrow">{l}</dt>
            <dd className="num mt-1 text-h6 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {miniaturas.length > 0 && (
        <ul aria-label="Prévia dos exercícios" className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
          {miniaturas.map((t) => (
            <li key={t.src} className="w-24 shrink-0 snap-start">
              <img src={t.src} alt={t.nome} loading="lazy" className="aspect-square w-full rounded-md border border-line bg-bg-muted object-cover" />
              <p className="mt-1 truncate text-micro text-ink-mute">{t.nome}</p>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={onComecar} className="mt-5 h-14 w-full text-body-lg">
        <Play aria-hidden /> Começar treino
      </Button>
    </section>
  );
}

function BotaoTema() {
  const [tema, setTema] = useState<Tema>(lerTema);
  const claro = tema === "claro";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      onClick={() => setTema(alternarTema())}
      aria-label={claro ? "Usar tema escuro" : "Usar tema claro"}
    >
      {claro ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </Button>
  );
}

const PASSOS = (aluno: string, treinador: string) => [
  {
    titulo: `Olá, ${aluno}`,
    texto: `${treinador} cadastrou você no PreceptorFISIC. Este é o seu app para acompanhar os treinos que ele prescreve.`,
  },
  {
    titulo: "O treino do dia fica no topo",
    texto: "Toque em “Começar treino” para ver os exercícios. Ao terminar cada série, anote a carga usada e, no fim, como foi o esforço (PSE).",
  },
  {
    titulo: "Seu treinador acompanha tudo",
    texto: "A sequência de dias e o histórico ficam salvos. Seu treinador vê o progresso e ajusta o plano com base nisso.",
  },
];

/** Boas-vindas na primeira visita (por aluno, neste navegador). */
function BoasVindas({ id, aluno, treinador }: { id: string; aluno: string; treinador: string }) {
  const chave = `pf_aluno_onb_${id}`;
  const [aberto, setAberto] = useState(() => {
    try {
      return !localStorage.getItem(chave);
    } catch {
      return false;
    }
  });
  const [passo, setPasso] = useState(0);
  const passos = PASSOS(aluno, treinador);
  const atual = passos[passo]!;
  const fechar = () => {
    try {
      localStorage.setItem(chave, "1");
    } catch {
      /* sem storage: só nesta visita */
    }
    setAberto(false);
  };
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-md">
        <p className="eyebrow" aria-hidden>
          <span className="num">{passo + 1}</span> de <span className="num">{passos.length}</span>
        </p>
        <DialogTitle className="text-h5 font-medium">{atual.titulo}</DialogTitle>
        <DialogDescription className="text-body-lg text-ink-soft">{atual.texto}</DialogDescription>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" className="h-12 flex-1 sm:flex-none" onClick={fechar}>
            Pular
          </Button>
          <Button className="h-12 flex-1 sm:flex-none" onClick={() => (passo < passos.length - 1 ? setPasso(passo + 1) : fechar())}>
            {passo < passos.length - 1 ? "Continuar" : "Começar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InicioSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

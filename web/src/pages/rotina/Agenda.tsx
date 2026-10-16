import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { numero } from "@/lib/format";
import {
  diasDaSemana,
  faixaDeHoras,
  mesmoDia,
  resumoDaSemana,
  sessoesDoDia,
  tipo,
  type SessaoAgenda,
} from "@/lib/rotina";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAVE_AGENDA } from "./chaves";

type Resposta = { appointments: SessaoAgenda[]; weekStart: string; weekEnd: string; semana: number };

const ALTURA_HORA = 56; // px por hora na grade
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const diaCurto = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

export default function Agenda() {
  const [params, setParams] = useSearchParams();
  const semana = Number.parseInt(params.get("semana") ?? "0", 10) || 0;
  const q = useQuery({
    queryKey: [...CHAVE_AGENDA, semana],
    queryFn: () => api<Resposta>(`/agenda?semana=${semana}`),
    placeholderData: keepPreviousData,
  });
  const ir = (n: number) => setParams(n === 0 ? {} : { semana: String(n) }, { replace: true });
  const inicio = q.data ? new Date(q.data.weekStart) : null;
  const dias = inicio ? diasDaSemana(inicio) : [];
  const titulo = inicio ? `${diaCurto(dias[0]!)} a ${diaCurto(dias[6]!)}` : "Agenda";

  return (
    <>
      <PageHeader
        eyebrow={inicio ? inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Agenda"}
        title={<>Agenda {inicio && <span className="num text-ink-mute">· {titulo}</span>}</>}
        actions={
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Semana">
              <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => ir(semana - 1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <Button variant="outline" onClick={() => ir(0)} disabled={semana === 0}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => ir(semana + 1)}>
                <ChevronRight aria-hidden />
              </Button>
            </div>
            <Button asChild>
              <Link to="/agenda/nova">
                <Plus aria-hidden /> Nova sessão
              </Link>
            </Button>
          </>
        }
      />
      <QueryState query={q} skeleton={<AgendaSkeleton />}>
        {(d) => (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <Resumo sessoes={d.appointments} semana={semana} />
            <div className="min-w-0" aria-busy={q.isPlaceholderData}>
              <Grade sessoes={d.appointments} dias={dias} />
              <ListaPorDia sessoes={d.appointments} dias={dias} />
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}

function Resumo({ sessoes, semana }: { sessoes: SessaoAgenda[]; semana: number }) {
  const r = resumoDaSemana(sessoes);
  return (
    <aside className="space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card lg:self-start">
      <div>
        <p className="eyebrow">{semana === 0 ? "Esta semana" : "Na semana"}</p>
        <p className="mt-2 text-h4 font-medium">
          <span className="num">{numero(r.total)}</span>{" "}
          <span className="text-body text-ink-mute">{r.total === 1 ? "sessão" : "sessões"}</span>
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-1">
        {r.porTipo.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-body">
            <span className={cn("size-2.5 shrink-0 rounded-sm", t.ponto)} aria-hidden />
            <span className="flex-1 text-ink-soft">{t.label}</span>
            <span className="num text-ink">{t.n}</span>
          </li>
        ))}
        {r.canceladas > 0 && (
          <li className="flex items-center gap-2 text-body">
            <span className="size-2.5 shrink-0 rounded-sm border border-ink-mute" aria-hidden />
            <span className="flex-1 text-ink-mute">Canceladas</span>
            <span className="num text-ink-mute">{r.canceladas}</span>
          </li>
        )}
      </ul>
    </aside>
  );
}

function Rotulo({ s }: { s: SessaoAgenda }) {
  return (
    <>
      {s.status === "completed" && <Check className="mr-0.5 inline size-3" aria-label="Concluída" />}
      {s.studentName ?? s.label ?? "Sessão"}
    </>
  );
}

/** Grade semanal (md+). Sessões sobrepostas ficam lado a lado. */
function Grade({ sessoes, dias }: { sessoes: SessaoAgenda[]; dias: Date[] }) {
  const horas = faixaDeHoras(sessoes);
  const hoje = new Date();
  const top = (iso: string) => {
    const d = new Date(iso);
    return Math.max(0, (d.getHours() + d.getMinutes() / 60 - horas[0]!) * ALTURA_HORA);
  };
  return (
    <div className="hidden overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card md:block">
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line">
        <span />
        {dias.map((d) => {
          const eHoje = mesmoDia(d, hoje);
          return (
            <div key={d.toISOString()} className={cn("border-l border-line py-2.5 text-center", eHoje && "bg-brand-soft")}>
              <p className={cn("eyebrow", eHoje && "text-brand")}>
                {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </p>
              <p className={cn("num text-h6 font-semibold", eHoje ? "text-brand" : "text-ink")}>
                {String(d.getDate()).padStart(2, "0")}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid max-h-[70dvh] grid-cols-[52px_repeat(7,minmax(0,1fr))] overflow-y-auto">
        <div>
          {horas.map((h) => (
            <div key={h} className="pr-2 pt-1 text-right" style={{ height: ALTURA_HORA }}>
              <span className="num text-micro text-ink-mute">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        {dias.map((dia) => (
          <div key={dia.toISOString()} className="relative border-l border-line">
            {horas.map((h) => (
              <div key={h} className="border-b border-line" style={{ height: ALTURA_HORA }} />
            ))}
            {sessoesDoDia(sessoes, dia).map((s) => {
              const t = tipo(s.type);
              const cancelada = s.status === "cancelled";
              const altura = (s.durationMinutes / 60) * ALTURA_HORA - 4;
              return (
                <Link
                  key={s.id}
                  to={`/agenda/${s.id}/editar`}
                  aria-label={`${hora(s.startsAt)}, ${t.label}${s.studentName ? ` com ${s.studentName}` : ""}${cancelada ? ", cancelada" : ""}. Editar`}
                  className={cn(
                    "absolute overflow-hidden rounded-md border border-l-[3px] bg-bg-subtle px-1.5 py-1 transition-colors hover:bg-bg-muted",
                    cancelada ? "border-ink-mute opacity-50" : t.borda,
                  )}
                  style={{
                    top: top(s.startsAt) + 2,
                    height: Math.max(altura, 22),
                    left: `calc(${(s.col / s.cols) * 100}% + 2px)`,
                    width: `calc(${100 / s.cols}% - 4px)`,
                  }}
                >
                  <span className={cn("num block text-micro", cancelada ? "text-ink-mute" : t.texto)}>{hora(s.startsAt)}</span>
                  <span className={cn("block truncate text-caption font-medium text-ink", cancelada && "line-through")}>
                    <Rotulo s={s} />
                  </span>
                  {altura > 50 && s.label && s.studentName && (
                    <span className="block truncate text-micro text-ink-mute">{s.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Abaixo de md a grade de 7 colunas não cabe: vira lista por dia. */
function ListaPorDia({ sessoes, dias }: { sessoes: SessaoAgenda[]; dias: Date[] }) {
  const hoje = new Date();
  return (
    <ol className="space-y-4 md:hidden">
      {dias.map((dia) => {
        const doDia = sessoesDoDia(sessoes, dia);
        const eHoje = mesmoDia(dia, hoje);
        return (
          <li key={dia.toISOString()}>
            <h2 className={cn("eyebrow mb-2", eHoje && "text-brand")}>
              {dia.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
              {eHoje && " · hoje"}
            </h2>
            {doDia.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-3 text-caption text-ink-mute">Livre</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-bg-elevated">
                {doDia.map((s) => {
                  const t = tipo(s.type);
                  const cancelada = s.status === "cancelled";
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/agenda/${s.id}/editar`}
                        className={cn("flex items-center gap-3 px-4 py-3 hover:bg-bg-subtle", cancelada && "opacity-60")}
                      >
                        <span className={cn("h-9 w-1 shrink-0 rounded-full", cancelada ? "bg-ink-mute" : t.ponto)} aria-hidden />
                        <span className="num w-12 shrink-0 text-body text-ink-soft">{hora(s.startsAt)}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-body font-medium", cancelada && "line-through")}>
                            <Rotulo s={s} />
                          </span>
                          <span className="block truncate text-caption text-ink-mute">
                            {t.label} · <span className="num">{s.durationMinutes}</span> min
                            {cancelada && " · cancelada"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function AgendaSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-40 lg:h-64" />
      <Skeleton className="h-[480px]" />
    </div>
  );
}


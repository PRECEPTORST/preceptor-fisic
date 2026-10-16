import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import type { DashboardStats, StudentListItem } from "$lib/server/queries";
import type { AttentionItem } from "$lib/attention";
import { api } from "@/lib/api";
import { dataHora, numero } from "@/lib/format";
import { nivel, semanas } from "@/lib/heatmap";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type Resposta = { students: StudentListItem[]; stats: DashboardStats; attention: AttentionItem[] };

export const CHAVE_DASHBOARD = ["dashboard"] as const;

const NIVEL_CLASSE = ["bg-bg-muted", "bg-brand/25", "bg-brand/45", "bg-brand/70", "bg-brand"] as const;

export default function Dashboard() {
  const q = useQuery({ queryKey: CHAVE_DASHBOARD, queryFn: () => api<Resposta>("/dashboard") });
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={hoje}
        title="Visão geral"
        actions={
          <Button asChild>
            <Link to="/alunos/novo">
              <Plus aria-hidden /> Novo aluno
            </Link>
          </Button>
        }
      />
      <QueryState
        query={q}
        skeleton={<DashboardSkeleton />}
        isEmpty={(d) => d.students.length === 0}
        empty={
          <EmptyState
            title="Nenhum aluno cadastrado"
            description="Cadastre o primeiro aluno para prescrever planos baseados em diretrizes clínicas."
            action={
              <Button asChild>
                <Link to="/alunos/novo">
                  <Plus aria-hidden /> Cadastrar primeiro aluno
                </Link>
              </Button>
            }
          />
        }
      >
        {(d) => (
          <div className="space-y-6">
            <Atencao itens={d.attention} />
            <Numeros stats={d.stats} />
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <Atividade stats={d.stats} />
              <Proximos itens={d.stats.upcomingAppointments} />
            </div>
            <Link
              to="/alunos"
              className="flex items-center justify-between rounded-lg border border-line bg-bg-elevated px-5 py-4 text-body transition-colors hover:border-line-strong"
            >
              <span>
                Ver todos os alunos <span className="num text-ink-mute">({numero(d.students.length)})</span>
              </span>
              <ArrowRight className="size-4 text-ink-mute" aria-hidden />
            </Link>
          </div>
        )}
      </QueryState>
    </>
  );
}

function Atencao({ itens }: { itens: AttentionItem[] }) {
  if (itens.length === 0) {
    return (
      <section className="rounded-lg border border-positive/30 bg-positive-soft px-5 py-4 text-body text-positive">
        Nenhum aluno precisa de atenção agora.
      </section>
    );
  }
  return (
    <section aria-labelledby="atencao" className="rounded-lg border border-line bg-bg-elevated shadow-card">
      <header className="px-5 pb-2 pt-5">
        <p className="eyebrow">Precisa de atenção</p>
        <h2 id="atencao" className="mt-1 text-h6 font-medium">
          <span className="num">{itens.length}</span> {itens.length === 1 ? "aluno para revisar" : "alunos para revisar"}
        </h2>
      </header>
      <ul className="divide-y divide-line">
        {itens.map((a) => (
          <li key={`${a.studentId}-${a.kind}`}>
            {/* Link de verdade (a auditoria achou uma div clicável sem teclado). */}
            <Link
              to={a.action.href}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle"
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", a.severity === "alta" ? "bg-negative" : "bg-warning")}
                aria-label={a.severity === "alta" ? "Prioridade alta" : "Prioridade média"}
              />
              <Avatar nome={a.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{a.name}</span>
                <span className="block truncate text-caption text-ink-mute">
                  {a.message}
                  {a.detail && <> · “{a.detail}”</>}
                </span>
              </span>
              <span className="hidden shrink-0 text-caption text-brand sm:inline">{a.action.label} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Numeros({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Alunos ativos", valor: stats.activeStudents, extra: `de ${numero(stats.totalStudents)}` },
    { label: "Planos em vigor", valor: stats.activePlans, extra: `${numero(stats.totalPlans)} no total` },
    { label: "Sessões em 7 dias", valor: stats.sessionsThisWeek },
    { label: "Avaliações", valor: stats.assessmentsLogged },
  ];
  return (
    <section aria-label="Números" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
          <p className="eyebrow">{c.label}</p>
          <p className="num mt-3 text-h3 font-medium text-ink">{numero(c.valor)}</p>
          {c.extra && <p className="num mt-1 text-caption text-ink-mute">{c.extra}</p>}
        </div>
      ))}
    </section>
  );
}

function Atividade({ stats }: { stats: DashboardStats }) {
  return (
    <section aria-labelledby="atividade" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Atividade da turma · 26 semanas</p>
          <h2 id="atividade" className="mt-1 text-h6 font-medium">
            <span className="num">{numero(stats.sessionsThisWeek)}</span> sessões nos últimos 7 dias
          </h2>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-micro uppercase text-ink-mute" aria-hidden>
          menos
          {NIVEL_CLASSE.map((c) => (
            <span key={c} className={cn("size-2.5 rounded-sm", c)} />
          ))}
          mais
        </div>
      </div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: "repeat(26, minmax(0, 1fr))" }}
        role="img"
        aria-label={`Sessões por dia nas últimas 26 semanas. Máximo de ${stats.heatmapMax} sessões num dia.`}
      >
        {semanas(stats.heatmap).map((sem, w) => (
          <div key={w} className="grid gap-[3px]">
            {sem.map((v, d) => (
              <span key={d} className={cn("aspect-square rounded-[3px]", NIVEL_CLASSE[nivel(v, stats.heatmapMax)])} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Proximos({ itens }: { itens: DashboardStats["upcomingAppointments"] }) {
  return (
    <section aria-labelledby="proximos" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p id="proximos" className="eyebrow">
          Próximos 7 dias
        </p>
        <Link to="/agenda" className="text-caption text-ink-mute hover:text-brand">
          Agenda →
        </Link>
      </div>
      {itens.length === 0 ? (
        <p className="mt-4 text-body text-ink-mute">Nada marcado.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {itens.map((x) => (
            <li key={x.id} className="flex items-baseline gap-3 py-2.5">
              <span className="num shrink-0 whitespace-nowrap text-caption text-ink-soft">{dataHora(x.startsAt)}</span>
              <span className="min-w-0 flex-1 truncate text-body">{x.title ?? x.studentName ?? "Compromisso"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );
}

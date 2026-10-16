import { Link } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { ESTAGIOS, estagio, resumoPainel, TOM_BARRA, type Lead } from "@/lib/crm";
import { data, numero } from "@/lib/format";
import { useTitulo } from "@/lib/useTitulo";
import { useSessao } from "@/hooks/useSessao";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Stat } from "@/components/Stat";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { AbasCrm } from "./comum";
import { useCrm } from "./dados";

function Barra({ label, n, max, classe }: { label: string; n: number; max: number; classe: string }) {
  return (
    <li className="grid grid-cols-[96px_1fr_40px] items-center gap-3 sm:grid-cols-[112px_1fr_40px]" title={`${label}: ${n} ${n === 1 ? "lead" : "leads"}`}>
      <span className="truncate text-caption text-ink-soft">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-r bg-bg-subtle">
        <span className={cn("block h-full min-w-0.5 rounded-r transition-[width] duration-300", classe)} style={{ width: `${(n / max) * 100}%` }} />
      </span>
      <span className="num text-right text-caption text-ink-soft">{numero(n)}</span>
    </li>
  );
}

function LinhaLead({ lead, meta, direita }: { lead: Lead; meta: string; direita?: string }) {
  const e = estagio(lead.stage);
  return (
    <li>
      <Link to={`/crm/${lead.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-subtle">
        <Avatar nome={lead.name} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{lead.name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2">
            <StatusChip tone={e.tom}>{e.label}</StatusChip>
            <span className="num truncate text-caption text-ink-mute">{meta}</span>
          </span>
        </span>
        {direita ? <span className="num shrink-0 text-caption text-ink-mute">{direita}</span> : <ChevronRight className="size-4 text-ink-mute" aria-hidden />}
      </Link>
    </li>
  );
}

/** Visão geral do CRM: KPIs, funil por estágio e origem, follow-ups atrasados e últimos leads. */
export default function CrmVisao() {
  useTitulo("Visão geral · CRM · PreceptorFISIC");
  const q = useCrm();
  const { data: s } = useSessao();
  const primeiro = s?.professional.name.split(" ")[0] || "time";
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        eyebrow={hoje}
        title={`Olá, ${primeiro}!`}
        description="Pipeline de leads do contato inicial até virar aluno ativo."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/crm/leads">Ver todos os leads</Link>
            </Button>
            <Button asChild>
              <Link to="/crm/novo">
                <Plus aria-hidden /> Novo lead
              </Link>
            </Button>
          </>
        }
      />
      <AbasCrm />
      <QueryState
        query={q}
        skeleton={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Carregando">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        }
      >
        {({ leads, counts }) => {
          const r = resumoPainel(leads, counts);
          return (
            <div className="space-y-6">
              <div className="cascata grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Leads no funil" valor={r.total} />
                <Stat label="Novos · 7 dias" valor={r.novos7d} />
                <Stat label="Pagantes" valor={r.pagantes} extra={`${r.conversao}% do funil`} />
                <Stat
                  label="Follow-ups atrasados"
                  valor={<span className={r.atrasados.length > 0 ? "text-warning" : undefined}>{numero(r.atrasados.length)}</span>}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card" aria-labelledby="crm-estagio">
                  <h2 id="crm-estagio" className="text-h6 font-semibold text-ink">
                    Leads por estágio
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {ESTAGIOS.map((e) => (
                      <Barra key={e.id} label={e.label} n={counts[e.id]} max={r.estagioMax} classe={TOM_BARRA[e.tom]} />
                    ))}
                  </ul>
                </section>
                <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card" aria-labelledby="crm-origem">
                  <h2 id="crm-origem" className="text-h6 font-semibold text-ink">
                    Leads por origem
                  </h2>
                  {r.origens.length === 0 ? (
                    <p className="mt-4 text-body text-ink-mute">Sem leads ainda. As origens aparecem aqui.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {r.origens.map((o) => (
                        <Barra key={o.id} label={o.label} n={o.n} max={r.origemMax} classe="bg-brand" />
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-lg border border-line bg-bg-elevated shadow-card" aria-labelledby="crm-atrasados">
                  <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <h2 id="crm-atrasados" className="text-h6 font-semibold text-ink">
                      Follow-ups atrasados
                    </h2>
                    <StatusChip tone={r.atrasados.length > 0 ? "warning" : "neutral"} dot={false}>
                      <span className="num">{r.atrasados.length}</span>
                    </StatusChip>
                  </div>
                  {r.atrasados.length === 0 ? (
                    <p className="px-5 pb-5 text-body text-ink-mute">Nada atrasado. Funil em dia.</p>
                  ) : (
                    <ul className="cascata divide-y divide-line pb-2">
                      {r.atrasados.slice(0, 6).map((l) => (
                        <LinhaLead key={l.id} lead={l} meta={`venceu ${data(l.nextFollowUpAt)}`} />
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rounded-lg border border-line bg-bg-elevated shadow-card" aria-labelledby="crm-recentes">
                  <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <h2 id="crm-recentes" className="text-h6 font-semibold text-ink">
                      Últimos leads
                    </h2>
                    <Link to="/crm/leads" className="text-caption font-medium text-brand hover:underline">
                      Ver todos
                    </Link>
                  </div>
                  {r.recentes.length === 0 ? (
                    <p className="px-5 pb-5 text-body text-ink-mute">Nenhum lead ainda.</p>
                  ) : (
                    <ul className="cascata divide-y divide-line pb-2">
                      {r.recentes.map((l) => (
                        <LinhaLead key={l.id} lead={l} meta={l.email ?? ""} direita={data(l.createdAt)} />
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}

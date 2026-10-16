import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownUp, Download, Plus, Search } from "lucide-react";
import type { LeadSource, LeadStage } from "$lib/server/queries";
import { agruparPorEstagio, atrasado, ESTAGIOS, filtrarLeads, leadsCsv, ORIGENS, origemLabel, type Lead, type Ordem } from "@/lib/crm";
import { data, numero } from "@/lib/format";
import { useTitulo } from "@/lib/useTitulo";
import { cn } from "@/lib/utils";
import { useFiltrosUrl } from "@/hooks/useFiltrosUrl";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AbasCrm, MenuMover } from "./comum";
import { useCrm, useMoverEstagio } from "./dados";

const PADROES = { q: "", origem: "all", estagio: "all", ordem: "createdAt", dir: "padrao" };

const ORDENS: { id: Ordem; label: string }[] = [
  { id: "createdAt", label: "Mais recentes" },
  { id: "name", label: "Nome" },
  { id: "nextFollowUpAt", label: "Follow-up mais urgente" },
];

function baixarCsv(leads: Lead[]) {
  const blob = new Blob([leadsCsv(leads)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function FollowUp({ lead }: { lead: Lead }) {
  if (!lead.nextFollowUpAt) return null;
  const late = atrasado(lead);
  return (
    <span className={cn("num inline-flex items-center gap-1 text-caption", late ? "text-warning" : "text-ink-mute")}>
      {late && <AlertTriangle className="size-3.5" aria-hidden />}
      {late ? "venceu " : "follow-up "}
      {data(lead.nextFollowUpAt)}
    </span>
  );
}

/** Card do kanban e linha da lista: o nome é o link; o menu move de estágio. */
function CartaoLead({ lead, onMover, variante }: { lead: Lead; onMover: (s: LeadStage) => void; variante: "card" | "linha" }) {
  const contato = lead.phone ?? lead.email;
  return (
    <div
      className={cn(
        "relative flex items-start gap-3",
        variante === "card" ? "card-vivo rounded-lg border border-line bg-bg-elevated p-3 shadow-card" : "px-4 py-3 active:bg-bg-subtle",
      )}
    >
      <Avatar nome={lead.name} size={28} />
      <div className="min-w-0 flex-1">
        <Link to={`/crm/${lead.id}`} className="block truncate font-medium text-ink after:absolute after:inset-0 focus-visible:outline-none">
          {lead.name}
        </Link>
        {contato && <p className={cn("truncate text-caption text-ink-mute", lead.phone && "num")}>{contato}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-mute">
          <span>{origemLabel(lead.source)}</span>
          <FollowUp lead={lead} />
        </p>
      </div>
      <MenuMover atual={lead.stage} nome={lead.name} onMover={onMover} className="-mr-1 -mt-1" />
    </div>
  );
}

/** Leads: kanban por estágio no desktop, lista agrupada no celular. Filtros na URL. */
export default function CrmLeads() {
  useTitulo("Leads · CRM · PreceptorFISIC");
  const q = useCrm();
  const mover = useMoverEstagio();
  const { valores, set, limpar, ativos } = useFiltrosUrl(PADROES);

  return (
    <>
      <QueryState query={q} skeleton={<SkeletonLista linhas={6} />}>
        {({ leads, counts }) => {
          const base = filtrarLeads(leads, {
            busca: valores.q,
            origem: valores.origem as LeadSource | "all",
            estagio: valores.estagio as LeadStage | "all",
            ordem: valores.ordem as Ordem,
          });
          const lista = valores.dir === "inv" ? [...base].reverse() : base;
          const grupos = agruparPorEstagio(lista).filter((g) => valores.estagio === "all" || g.estagio.id === valores.estagio);
          const mv = (id: string) => (stage: LeadStage) => mover.mutate({ id, stage });
          return (
            <>
              <PageHeader
                title="Leads"
                description={
                  <span className="num">
                    {numero(lista.length)} de {numero(leads.length)} leads no funil
                  </span>
                }
                actions={
                  <>
                    <Button variant="outline" onClick={() => baixarCsv(lista)} disabled={lista.length === 0}>
                      <Download aria-hidden /> Exportar CSV
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
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative md:flex-1">
                    <Label htmlFor="busca-leads" className="sr-only">
                      Buscar nome, e-mail, telefone ou notas
                    </Label>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
                    <Input
                      id="busca-leads"
                      type="search"
                      className="pl-9"
                      placeholder="Buscar nome, e-mail, telefone ou notas"
                      value={valores.q}
                      onChange={(e) => set("q", e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={valores.origem} onValueChange={(v) => set("origem", v)}>
                      <SelectTrigger className="md:w-44" aria-label="Filtrar por origem">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as origens</SelectItem>
                        {ORIGENS.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={valores.ordem} onValueChange={(v) => set("ordem", v)}>
                      <SelectTrigger className="md:w-52" aria-label="Ordenar por">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDENS.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-pressed={valores.dir === "inv"}
                      aria-label="Inverter a ordem"
                      onClick={() => set("dir", valores.dir === "inv" ? "padrao" : "inv")}
                    >
                      <ArrowDownUp className={cn("size-4", valores.dir === "inv" ? "text-brand" : "text-ink-mute")} aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                  <ToggleGroup
                    type="single"
                    value={valores.estagio}
                    onValueChange={(v) => set("estagio", v || "all")}
                    aria-label="Filtrar por estágio"
                    className="justify-start"
                  >
                    <ToggleGroupItem value="all" size="sm" className="whitespace-nowrap">
                      Todos <span className="num text-ink-mute">{leads.length}</span>
                    </ToggleGroupItem>
                    {ESTAGIOS.map((e) => (
                      <ToggleGroupItem key={e.id} value={e.id} size="sm" className="whitespace-nowrap">
                        {e.label} <span className="num text-ink-mute">{counts[e.id]}</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                {leads.length === 0 ? (
                  <EmptyState
                    title="Nenhum lead ainda"
                    description="Cadastre o primeiro contato e acompanhe até virar pagante."
                    action={
                      <Button asChild>
                        <Link to="/crm/novo">Novo lead</Link>
                      </Button>
                    }
                  />
                ) : lista.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhum lead com esses filtros"
                    action={
                      ativos ? (
                        <Button variant="outline" onClick={limpar}>
                          Limpar filtros
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <>
                    {/* Desktop: kanban. Mover pelo menu de cada card. */}
                    <div className="-mx-4 hidden overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:px-0">
                      <div className="flex gap-3">
                        {grupos.map((g) => (
                          <section
                            key={g.estagio.id}
                            aria-labelledby={`col-${g.estagio.id}`}
                            className="flex w-64 shrink-0 flex-col rounded-lg border border-line bg-bg-subtle"
                          >
                            <header className="flex items-center justify-between px-3 py-2.5">
                              <h2 id={`col-${g.estagio.id}`}>
                                <StatusChip tone={g.estagio.tom}>{g.estagio.label}</StatusChip>
                              </h2>
                              <span className="num text-caption text-ink-mute">{g.leads.length}</span>
                            </header>
                            {g.leads.length === 0 ? (
                              <p className="px-3 pb-3 text-caption text-ink-mute">Nenhum lead.</p>
                            ) : (
                              <ul className="cascata space-y-2 px-2 pb-2">
                                {g.leads.map((l) => (
                                  <li key={l.id}>
                                    <CartaoLead lead={l} onMover={mv(l.id)} variante="card" />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>
                        ))}
                      </div>
                    </div>

                    {/* Celular e tablet: lista agrupada por estágio. */}
                    <div className="space-y-4 lg:hidden">
                      {grupos
                        .filter((g) => g.leads.length > 0)
                        .map((g) => (
                          <section key={g.estagio.id} aria-labelledby={`grp-${g.estagio.id}`}>
                            <h2 id={`grp-${g.estagio.id}`} className="mb-2 flex items-center gap-2">
                              <StatusChip tone={g.estagio.tom}>{g.estagio.label}</StatusChip>
                              <span className="num text-caption text-ink-mute">{g.leads.length}</span>
                            </h2>
                            <ul className="cascata divide-y divide-line overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card">
                              {g.leads.map((l) => (
                                <li key={l.id}>
                                  <CartaoLead lead={l} onMover={mv(l.id)} variante="linha" />
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

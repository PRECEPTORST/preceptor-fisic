import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { data, numero } from "@/lib/format";
import { contarPorFiltro, filtrarTreinos, FILTROS_STATUS, statusLabel, statusTom } from "@/lib/treinos";
import { chaves, type PlanoItem } from "@/lib/treinos-tipos";
import { useFiltrosUrl } from "@/hooks/useFiltrosUrl";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { DataList, type Coluna } from "@/components/DataList";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const CHAVE_TREINOS = chaves.lista;

const PADROES = { q: "", status: "todos" };

const colunas: Coluna<PlanoItem>[] = [
  {
    id: "aluno",
    header: "Aluno",
    cell: (p) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar nome={p.studentName} size={28} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{p.studentName}</span>
          <span className="block truncate text-caption text-ink-mute">{p.title}</span>
        </span>
      </span>
    ),
  },
  { id: "status", header: "Status", cell: (p) => <StatusChip tone={statusTom(p.status)}>{statusLabel(p.status)}</StatusChip>, className: "w-36" },
  { id: "sessoes", header: "Sessões", cell: (p) => <span className="num">{numero(p.sessionsTotal)}</span>, className: "w-24 text-right num" },
  { id: "criado", header: "Criado", cell: (p) => <span className="num text-ink-soft">{data(p.createdAt)}</span>, className: "w-28 text-right" },
];

/** Todos os treinos, filtrados por status e busca (filtros na URL, brief §4.5). */
export default function TreinosLista() {
  const q = useQuery({ queryKey: CHAVE_TREINOS, queryFn: () => api<{ plans: PlanoItem[] }>("/treinos") });
  const { valores, set, limpar, ativos } = useFiltrosUrl(PADROES);

  return (
    <>
      <PageHeader
        title="Treinos"
        description="Todos os treinos prescritos. Para criar um, comece pela ficha do aluno."
        actions={
          <Button asChild>
            <Link to="/alunos">
              <Plus aria-hidden /> Novo treino
            </Link>
          </Button>
        }
      />
      <QueryState
        query={q}
        skeleton={<SkeletonLista linhas={6} />}
        isEmpty={(d) => d.plans.length === 0}
        empty={
          <EmptyState
            title="Nenhum treino prescrito ainda"
            description="Abra a ficha de um aluno e escolha gerar com IA ou montar na mão."
            action={
              <Button asChild>
                <Link to="/alunos">Escolher aluno</Link>
              </Button>
            }
          />
        }
      >
        {({ plans }) => {
          const contagem = contarPorFiltro(plans);
          const lista = filtrarTreinos(plans, valores.status, valores.q);
          return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative md:w-72">
                  <Label htmlFor="busca-treinos" className="sr-only">
                    Buscar por aluno ou treino
                  </Label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
                  <Input
                    id="busca-treinos"
                    type="search"
                    className="pl-9"
                    placeholder="Buscar por aluno ou treino"
                    value={valores.q}
                    onChange={(e) => set("q", e.target.value)}
                  />
                </div>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                  <ToggleGroup
                    type="single"
                    value={valores.status}
                    onValueChange={(v) => set("status", v || "todos")}
                    aria-label="Filtrar por status"
                    className="justify-start"
                  >
                    {FILTROS_STATUS.filter(([k]) => k === "todos" || contagem[k] > 0 || valores.status === k).map(([k, l]) => (
                      <ToggleGroupItem key={k} value={k} size="sm" className="whitespace-nowrap">
                        {l} <span className="num text-ink-mute">{contagem[k]}</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
              {lista.length === 0 ? (
                <EmptyState
                  compact
                  title="Nenhum treino para este filtro"
                  action={
                    ativos ? (
                      <Button variant="outline" onClick={limpar}>
                        Limpar filtros
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <DataList
                  rows={lista}
                  columns={colunas}
                  rowKey={(p) => p.id}
                  href={(p) => `/treinos/${p.id}`}
                  caption="Treinos"
                />
              )}
            </div>
          );
        }}
      </QueryState>
    </>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import type { StudentListItem } from "$lib/server/queries";
import { api } from "@/lib/api";
import { diasAtras, numero } from "@/lib/format";
import { filtrarAlunos, objetivosDisponiveis, tomAderencia, type FiltroStatus } from "@/lib/alunos";
import { cn } from "@/lib/utils";
import { useFiltrosUrl } from "@/hooks/useFiltrosUrl";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { DataList, type Coluna } from "@/components/DataList";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHAVE_ALUNOS, type RespostaLista } from "./dados";

const PADROES = { q: "", status: "all", objetivo: "all" };
const TOM_TEXTO = { positive: "text-positive", warning: "text-warning", negative: "text-negative" } as const;

const novo = (
  <Button asChild>
    <Link to="/alunos/novo">
      <Plus aria-hidden /> Novo aluno
    </Link>
  </Button>
);

export default function ListaAlunos() {
  const q = useQuery({ queryKey: CHAVE_ALUNOS, queryFn: () => api<RespostaLista>("/alunos") });
  const n = q.data?.students.length ?? 0;
  const ativos = q.data?.students.filter((s) => s.status === "active").length ?? 0;
  return (
    <>
      <PageHeader
        eyebrow={
          q.data ? (
            <>
              <span className="num">{numero(n)}</span> alunos · <span className="num">{numero(ativos)}</span> ativos
            </>
          ) : undefined
        }
        title="Alunos"
        actions={novo}
      />
      <QueryState
        query={q}
        skeleton={<SkeletonLista linhas={6} />}
        isEmpty={(d) => d.students.length === 0}
        empty={<EmptyState title="Nenhum aluno cadastrado" description="Cadastre o primeiro aluno para começar a prescrever planos." action={novo} />}
      >
        {(d) => <Conteudo alunos={d.students} />}
      </QueryState>
    </>
  );
}

const colunas: Coluna<StudentListItem>[] = [
  {
    id: "aluno",
    header: "Aluno",
    cell: (s) => <Identidade s={s} />,
  },
  { id: "plano", header: "Plano", cell: (s) => <span className="text-ink-soft">{s.planTitle ?? "Sem plano"}</span>, className: "max-w-56 truncate" },
  {
    id: "aderencia",
    header: "Aderência",
    cell: (s) => <span className={cn("num font-medium", TOM_TEXTO[tomAderencia(s.adherence)])}>{s.adherence}%</span>,
    className: "text-right",
  },
  { id: "sessoes", header: "Sessões 7d", cell: (s) => <span className="num">{s.sessions7}</span>, className: "text-right" },
  { id: "ultima", header: "Último treino", cell: (s) => <span className="text-ink-soft">{diasAtras(s.daysSinceLast)}</span> },
  { id: "sequencia", header: "Sequência", cell: (s) => <span className="num">{s.streak}</span>, className: "text-right", ocultarNoMobile: true },
];

function Identidade({ s }: { s: StudentListItem }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar nome={s.name} size={32} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{s.name}</span>
          {s.status === "paused" && (
            <StatusChip tone="neutral" dot={false}>
              Pausado
            </StatusChip>
          )}
        </span>
        <span className="block truncate text-caption text-ink-mute">
          {s.age != null && (
            <>
              <span className="num">{s.age}</span> anos ·{" "}
            </>
          )}
          {s.goal ?? "sem objetivo"}
        </span>
      </span>
    </span>
  );
}

function Conteudo({ alunos }: { alunos: StudentListItem[] }) {
  const { valores, set, limpar, ativos } = useFiltrosUrl(PADROES);
  const objetivos = useMemo(() => objetivosDisponiveis(alunos), [alunos]);
  const filtrados = useMemo(
    () => filtrarAlunos(alunos, { status: valores.status as FiltroStatus, objetivo: valores.objetivo, busca: valores.q }),
    [alunos, valores.status, valores.objetivo, valores.q],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Label htmlFor="busca-aluno" className="sr-only">
            Buscar aluno por nome
          </Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <Input id="busca-aluno" type="search" value={valores.q} onChange={(e) => set("q", e.target.value)} placeholder="Buscar por nome" className="pl-9" />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={valores.status}
          onValueChange={(v) => set("status", v || "all")}
          aria-label="Situação"
          className="justify-start"
        >
          <ToggleGroupItem value="all">Todos</ToggleGroupItem>
          <ToggleGroupItem value="active">Ativos</ToggleGroupItem>
          <ToggleGroupItem value="paused">Pausados</ToggleGroupItem>
        </ToggleGroup>
        {objetivos.length > 0 && (
          <div className="md:w-48">
            <Label htmlFor="filtro-objetivo" className="sr-only">
              Objetivo
            </Label>
            <Select value={valores.objetivo} onValueChange={(v) => set("objetivo", v)}>
              <SelectTrigger id="filtro-objetivo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os objetivos</SelectItem>
                {objetivos.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {filtrados.length} alunos na lista
      </p>
      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-line bg-bg-elevated">
          <EmptyState
            compact
            decorative="/0"
            title="Nenhum aluno com esses filtros"
            action={
              ativos && (
                <Button variant="outline" onClick={limpar}>
                  Limpar filtros
                </Button>
              )
            }
          />
        </div>
      ) : (
        <DataList rows={filtrados} columns={colunas} rowKey={(s) => s.id} href={(s) => `/alunos/${s.id}`} caption="Alunos" />
      )}
    </div>
  );
}

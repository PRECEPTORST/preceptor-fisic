import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import type { ExerciseLibraryItem } from "$lib/server/db/schema";
import { api } from "@/lib/api";
import { numero } from "@/lib/format";
import { filtrarMeus, valoresUnicos } from "@/lib/rotina";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AbasExercicios } from "@/components/rotina/AbasExercicios";
import { Chip, LinhaFiltro } from "@/components/rotina/Chip";
import { CHAVE_MEUS_EXERCICIOS } from "./chaves";

type Resposta = { exercises: ExerciseLibraryItem[] };

export default function ExerciciosMeus() {
  const q = useQuery({ queryKey: CHAVE_MEUS_EXERCICIOS, queryFn: () => api<Resposta>("/exercicios/meus") });
  const novo = (
    <Button asChild>
      <Link to="/exercicios/novo">
        <Plus aria-hidden /> Novo exercício
      </Link>
    </Button>
  );
  return (
    <>
      <AbasExercicios meus={q.data?.exercises.length} />
      <PageHeader eyebrow="Criados por você · usados nos planos" title="Meus exercícios" actions={novo} />
      <QueryState
        query={q}
        skeleton={<ListaSkeleton />}
        isEmpty={(d) => d.exercises.length === 0}
        empty={
          <EmptyState
            title="Biblioteca vazia"
            description="Adicione exercícios seus para reusar nos planos."
            action={
              <Button asChild>
                <Link to="/exercicios/novo">
                  <Plus aria-hidden /> Adicionar o primeiro exercício
                </Link>
              </Button>
            }
          />
        }
      >
        {(d) => <Biblioteca exercicios={d.exercises} />}
      </QueryState>
    </>
  );
}

function Biblioteca({ exercicios }: { exercicios: ExerciseLibraryItem[] }) {
  const [grupo, setGrupo] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(exercicios[0]?.id ?? null);
  const grupos = valoresUnicos(exercicios.map((x) => x.muscleGroup));
  const equips = valoresUnicos(exercicios.map((x) => x.equipment));
  const lista = filtrarMeus(exercicios, { grupo, equipamento, busca });
  const sel = exercicios.find((x) => x.id === selId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex h-11 items-center gap-2 rounded-md border border-line bg-bg-elevated px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
          <label htmlFor="meus-busca" className="sr-only">
            Buscar nos meus exercícios
          </label>
          <Input
            id="meus-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, padrão de movimento ou equipamento…"
            className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="space-y-2">
          <LinhaFiltro rotulo="Grupo">
            <Chip ativo={!grupo} onClick={() => setGrupo("")}>
              Todos
            </Chip>
            {grupos.map((g) => (
              <Chip key={g} ativo={grupo === g} onClick={() => setGrupo(g)}>
                {g}
              </Chip>
            ))}
          </LinhaFiltro>
          {equips.length > 0 && (
            <LinhaFiltro rotulo="Equip.">
              <Chip ativo={!equipamento} onClick={() => setEquipamento("")}>
                Todos
              </Chip>
              {equips.map((e) => (
                <Chip key={e} ativo={equipamento === e} onClick={() => setEquipamento(e)}>
                  {e}
                </Chip>
              ))}
            </LinhaFiltro>
          )}
        </div>

        {lista.length === 0 ? (
          <EmptyState compact title="Nada com esses filtros" description="Mude a busca ou volte para Todos." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card">
            <div className="hidden grid-cols-[80px_2fr_1.3fr_1fr_1fr_56px] gap-3 border-b border-line bg-bg-subtle px-4 py-2.5 md:grid">
              {["Código", "Nome", "Grupo", "Equip.", "Padrão", "Usos"].map((h) => (
                <span key={h} className={cn("eyebrow", h === "Usos" && "text-right")}>
                  {h}
                </span>
              ))}
            </div>
            <ul className="divide-y divide-line">
              {lista.map((x) => (
                <li key={x.id}>
                  {/* Desktop: seleciona e mostra a prévia ao lado. Celular: abre a edição direto. */}
                  <button
                    type="button"
                    onClick={() => setSelId(x.id)}
                    aria-current={sel?.id === x.id}
                    className={cn(
                      "hidden w-full grid-cols-[80px_2fr_1.3fr_1fr_1fr_56px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle lg:grid",
                      sel?.id === x.id && "bg-brand-soft",
                    )}
                  >
                    <Linha x={x} />
                  </button>
                  <Link
                    to={`/exercicios/${x.id}/editar`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle md:grid md:grid-cols-[80px_2fr_1.3fr_1fr_1fr_56px] lg:hidden"
                  >
                    <Linha x={x} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {sel && <Previa x={sel} />}
    </div>
  );
}

function Linha({ x }: { x: ExerciseLibraryItem }) {
  return (
    <>
      <span className="num hidden text-caption text-ink-mute md:block">{x.code ?? "—"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-ink">{x.name}</span>
        <span className="block truncate text-caption text-ink-mute md:hidden">
          {[x.muscleGroup, x.equipment, x.pattern].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="hidden truncate text-body text-ink-soft md:block">{x.muscleGroup}</span>
      <span className="hidden truncate text-body text-ink-mute md:block">{x.equipment ?? "—"}</span>
      <span className="hidden truncate font-mono text-caption uppercase text-brand md:block">{x.pattern ?? "—"}</span>
      <span className="num shrink-0 text-right text-body text-ink-soft" aria-label={`${x.uses} usos`}>
        {numero(x.uses)}
      </span>
    </>
  );
}

function Previa({ x }: { x: ExerciseLibraryItem }) {
  const contra = x.contraindications ?? [];
  return (
    <aside aria-label="Prévia do exercício" className="hidden lg:block">
      <div className="sticky top-0 space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <div>
          <p className="eyebrow">{x.code ?? "Prévia"}</p>
          <h2 className="mt-1 text-h5 font-semibold text-ink">{x.name}</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {[x.muscleGroup, x.equipment, x.level].filter(Boolean).map((t) => (
              <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-caption text-ink-soft">
                {t}
              </li>
            ))}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-line p-3">
            <dt className="eyebrow">Padrão</dt>
            <dd className="mt-1 text-body font-medium">{x.pattern ?? "—"}</dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="eyebrow">Usos</dt>
            <dd className="num mt-1 text-body font-medium">{numero(x.uses)}</dd>
          </div>
        </dl>
        {x.executionNotes && (
          <div>
            <p className="eyebrow mb-1">Forma de execução</p>
            <p className="whitespace-pre-line text-body text-ink-soft">{x.executionNotes}</p>
          </div>
        )}
        {contra.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Contraindicações</p>
            <ul className="flex flex-wrap gap-1.5">
              {contra.map((c) => (
                <li key={c} className="rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-caption text-warning">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link to={`/exercicios/${x.id}/editar`}>
            <Pencil aria-hidden /> Editar exercício
          </Link>
        </Button>
      </div>
    </aside>
  );
}

function ListaSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy="true" aria-label="Carregando">
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-8 w-2/3" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="hidden h-96 lg:block" />
    </div>
  );
}

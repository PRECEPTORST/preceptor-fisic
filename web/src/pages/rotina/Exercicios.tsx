import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Play, Plus, Search } from "lucide-react";
import type { CatalogExercise } from "$lib/server/queries";
import type { ExerciseLibraryItem } from "$lib/server/db/schema";
import { api } from "@/lib/api";
import { numero } from "@/lib/format";
import { DIFICULDADES, aplicarFiltro, dificuldade, filtrarMeus, parteDoCorpo, posterDoVideo, valoresUnicos } from "@/lib/rotina";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { DataList } from "@/components/DataList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Chip, LinhaFiltro } from "@/components/rotina/Chip";
import { Painel } from "@/components/rotina/Painel";
import { PainelExercicio } from "./PainelExercicio";
import { CHAVE_CATALOGO, CHAVE_MEUS_EXERCICIOS } from "./chaves";

type RespostaCatalogo = {
  items: CatalogExercise[];
  total: number;
  page: number;
  pageSize: number;
  facets: { total: number; bodyParts: { value: string; count: number }[]; equipment: { value: string; count: number }[] };
};
type RespostaMeus = { exercises: ExerciseLibraryItem[] };

/**
 * Exercícios (brief §3): catálogo e "meus exercícios" em abas da mesma tela.
 * Estado na URL: ?aba=meus, filtros, e o painel aberto (?novo=1 | ?editar=<id>).
 */
export default function Exercicios() {
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "meus" ? "meus" : "catalogo";
  const editar = params.get("editar");
  const novo = params.get("novo") === "1";
  const meus = useQuery({ queryKey: CHAVE_MEUS_EXERCICIOS, queryFn: () => api<RespostaMeus>("/exercicios/meus") });

  const trocarAba = (v: string) => setParams(v === "meus" ? { aba: "meus" } : {}, { replace: true });
  const abrirNovo = () =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("aba", "meus");
        n.set("novo", "1");
        return n;
      },
    );
  const fecharPainel = () =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("novo");
        n.delete("editar");
        return n;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title="Exercícios"
        description="O catálogo licenciado entra nos planos gerados; os seus ficam disponíveis para montar e trocar."
        actions={
          <Button onClick={abrirNovo}>
            <Plus aria-hidden /> Novo exercício
          </Button>
        }
      />
      <Tabs value={aba} onValueChange={trocarAba} className="mb-6">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="meus">
            Meus exercícios
            {meus.data && <span className="num ml-1.5 text-ink-mute">{meus.data.exercises.length}</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="animate-soft-fade" key={aba}>
        {aba === "catalogo" ? <Catalogo /> : <Meus query={meus} onNovo={abrirNovo} />}
      </div>
      <PainelExercicio id={editar} aberto={novo || Boolean(editar)} onFechar={fecharPainel} />
    </>
  );
}

/* ────────── Catálogo ────────── */

function Catalogo() {
  const [params, setParams] = useSearchParams();
  const filtros = { q: params.get("q") ?? "", bp: params.get("bp") ?? "", diff: params.get("diff") ?? "" };
  // Só os parâmetros do catálogo vão para a API (e para a chave do cache).
  const api_qs = new URLSearchParams();
  for (const k of ["q", "bp", "diff", "page"]) {
    const v = params.get(k);
    if (v) api_qs.set(k, v);
  }
  const qs = api_qs.toString();
  const q = useQuery({
    queryKey: [...CHAVE_CATALOGO, qs],
    queryFn: () => api<RespostaCatalogo>(`/exercicios/catalogo${qs ? `?${qs}` : ""}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const [busca, setBusca] = useState(filtros.q);
  const [aberto, setAberto] = useState<CatalogExercise | null>(null);
  const filtrar = (patch: Record<string, string>) => setParams((p) => aplicarFiltro(p, patch), { replace: true });

  // Busca com debounce de 350ms (igual ao SvelteKit) para não disparar a cada tecla.
  useEffect(() => {
    if (busca.trim() === filtros.q) return;
    const t = setTimeout(() => filtrar({ q: busca.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const irPara = (p: number) => {
    filtrar({ page: String(p) });
    document.getElementById("conteudo")?.scrollTo({ top: 0 });
  };
  const limpar = () => {
    setBusca("");
    setParams({}, { replace: true });
  };

  return (
    <>
      <div className="mb-4 space-y-3">
        <Busca id="cat-busca" rotulo="Buscar no catálogo" valor={busca} onChange={setBusca} placeholder="Buscar exercício por nome…">
          {q.data && q.data.total > 0 && (
            <span className="num shrink-0 text-caption text-ink-mute" aria-live="polite">
              {numero(q.data.total)} {q.data.total === 1 ? "resultado" : "resultados"}
            </span>
          )}
        </Busca>
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">Nível</span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filtros.diff || "todos"}
            onValueChange={(v) => v && filtrar({ diff: v === "todos" ? "" : v })}
            aria-label="Nível"
          >
            <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
            {DIFICULDADES.map((d) => (
              <ToggleGroupItem key={d.id} value={d.id}>
                {d.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <LinhaFiltro rotulo="Grupo">
          <Chip ativo={!filtros.bp} onClick={() => filtrar({ bp: "" })}>
            Todos
          </Chip>
          {q.data?.facets.bodyParts.map((bp) => (
            <Chip key={bp.value} ativo={filtros.bp === bp.value} onClick={() => filtrar({ bp: bp.value })}>
              {parteDoCorpo(bp.value)} <span className="num text-ink-mute">{bp.count}</span>
            </Chip>
          ))}
        </LinhaFiltro>
      </div>

      <QueryState
        query={q}
        skeleton={<GradeSkeleton />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            compact
            title="Nenhum exercício com esses filtros"
            description="Tente outro termo ou limpe os filtros."
            action={
              <Button variant="outline" onClick={limpar}>
                Limpar filtros
              </Button>
            }
          />
        }
      >
        {(d) => {
          const totalPaginas = Math.ceil(d.total / d.pageSize);
          return (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy={q.isPlaceholderData}>
                {d.items.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => setAberto(ex)}
                      className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-bg-elevated text-left transition-colors hover:border-line-strong"
                    >
                      <span className="relative block aspect-square bg-bg-muted">
                        {ex.videoUrl ? (
                          // Poster JPG (~30KB) em vez do GIF (~1.7MB); o GIF só toca no painel.
                          <img src={posterDoVideo(ex.videoUrl)} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <Play className="absolute inset-0 m-auto size-6 text-ink-mute" aria-hidden />
                        )}
                      </span>
                      <span className="block p-3">
                        <span className="block text-body font-medium capitalize leading-snug text-ink">{ex.name}</span>
                        <span className="mt-1 block truncate text-caption capitalize text-ink-mute">
                          {parteDoCorpo(ex.bodyPart)}
                          {ex.equipment ? ` · ${ex.equipment}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {totalPaginas > 1 && (
                <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-4">
                  <Button variant="outline" size="sm" disabled={d.page <= 1} onClick={() => irPara(d.page - 1)}>
                    <ChevronLeft aria-hidden /> Anterior
                  </Button>
                  <span className="num text-caption text-ink-soft">
                    Página {d.page} de {totalPaginas}
                  </span>
                  <Button variant="outline" size="sm" disabled={d.page >= totalPaginas} onClick={() => irPara(d.page + 1)}>
                    Próxima <ChevronRight aria-hidden />
                  </Button>
                </nav>
              )}
            </>
          );
        }}
      </QueryState>

      <Painel aberto={Boolean(aberto)} onFechar={() => setAberto(null)} eyebrow={aberto ? parteDoCorpo(aberto.bodyPart) : ""} titulo={<span className="capitalize">{aberto?.name}</span>}>
        {aberto && <DetalheCatalogo ex={aberto} />}
      </Painel>
    </>
  );
}

function DetalheCatalogo({ ex }: { ex: CatalogExercise }) {
  const tags = [ex.targetMuscle, ...ex.secondaryMuscles, ex.equipment, ex.difficulty ? dificuldade(ex.difficulty) : null].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <div className="space-y-5 pb-6">
      {ex.videoUrl && (
        <img src={ex.videoUrl} alt={`Demonstração: ${ex.name}`} className="mx-auto aspect-square w-full max-w-sm rounded-lg bg-bg-muted object-cover" />
      )}
      <ul className="flex flex-wrap gap-1.5" aria-label="Características">
        {tags.map((t) => (
          <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-caption capitalize text-ink-soft">
            {t}
          </li>
        ))}
      </ul>
      {ex.description && <p className="text-body text-ink-soft">{ex.description}</p>}
      {ex.instructions.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Execução</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-body text-ink-soft">
            {ex.instructions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ────────── Meus exercícios ────────── */

function Meus({ query, onNovo }: { query: ReturnType<typeof useQuery<RespostaMeus>>; onNovo: () => void }) {
  const [params, setParams] = useSearchParams();
  const f = { grupo: params.get("g") ?? "", equipamento: params.get("eq") ?? "", busca: params.get("mq") ?? "" };
  const set = (k: "g" | "eq" | "mq", v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true },
    );
  const editarHref = (id: string) => {
    const n = new URLSearchParams(params);
    n.delete("novo");
    n.set("editar", id);
    return `?${n.toString()}`;
  };

  return (
    <QueryState
      query={query}
      skeleton={
        <div className="space-y-3" aria-busy="true" aria-label="Carregando">
          <Skeleton className="h-11 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      }
      isEmpty={(d) => d.exercises.length === 0}
      empty={
        <EmptyState
          title="Sua biblioteca está vazia"
          description="Crie exercícios seus para reusar ao montar e trocar exercícios nos planos."
          action={
            <Button onClick={onNovo}>
              <Plus aria-hidden /> Criar o primeiro exercício
            </Button>
          }
        />
      }
    >
      {(d) => {
        const lista = filtrarMeus(d.exercises, f);
        const grupos = valoresUnicos(d.exercises.map((x) => x.muscleGroup));
        const equips = valoresUnicos(d.exercises.map((x) => x.equipment));
        return (
          <div className="space-y-4">
            <Busca
              id="meus-busca"
              rotulo="Buscar nos meus exercícios"
              valor={f.busca}
              onChange={(v) => set("mq", v)}
              placeholder="Nome, padrão de movimento ou equipamento…"
            />
            <div className="space-y-2">
              <LinhaFiltro rotulo="Grupo">
                <Chip ativo={!f.grupo} onClick={() => set("g", "")}>
                  Todos
                </Chip>
                {grupos.map((g) => (
                  <Chip key={g} ativo={f.grupo === g} onClick={() => set("g", g)}>
                    {g}
                  </Chip>
                ))}
              </LinhaFiltro>
              {equips.length > 0 && (
                <LinhaFiltro rotulo="Equip.">
                  <Chip ativo={!f.equipamento} onClick={() => set("eq", "")}>
                    Todos
                  </Chip>
                  {equips.map((e) => (
                    <Chip key={e} ativo={f.equipamento === e} onClick={() => set("eq", e)}>
                      {e}
                    </Chip>
                  ))}
                </LinhaFiltro>
              )}
            </div>
            {lista.length === 0 ? (
              <EmptyState
                compact
                title="Nada com esses filtros"
                action={
                  <Button variant="outline" onClick={() => setParams({ aba: "meus" }, { replace: true })}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <DataList
                caption="Meus exercícios"
                rows={lista}
                rowKey={(x) => x.id}
                href={(x) => editarHref(x.id)}
                primary={(x) => (
                  <>
                    <span className="block truncate font-medium text-ink">{x.name}</span>
                    <span className="block truncate text-caption text-ink-mute">{x.code ?? "Sem código"}</span>
                  </>
                )}
                columns={[
                  { id: "nome", header: "Nome", cell: (x) => <span className="font-medium text-ink">{x.name}</span> },
                  { id: "codigo", header: "Código", cell: (x) => <span className="num text-ink-mute">{x.code ?? "—"}</span>, ocultarNoMobile: true },
                  { id: "grupo", header: "Grupo", cell: (x) => x.muscleGroup },
                  { id: "equip", header: "Equip.", cell: (x) => x.equipment ?? "—" },
                  { id: "padrao", header: "Padrão", cell: (x) => x.pattern ?? "—", ocultarNoMobile: true },
                  { id: "usos", header: "Usos", cell: (x) => numero(x.uses), className: "text-right num" },
                ]}
              />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

/* ────────── comuns ────────── */

function Busca({
  id,
  rotulo,
  valor,
  onChange,
  placeholder,
  children,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-bg-elevated px-3 focus-within:ring-2 focus-within:ring-ring">
      <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <Input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {children}
    </div>
  );
}

function GradeSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-line">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

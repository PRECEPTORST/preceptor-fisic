import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Play, Search } from "lucide-react";
import type { CatalogExercise } from "$lib/server/queries";
import { api } from "@/lib/api";
import { numero } from "@/lib/format";
import { DIFICULDADES, aplicarFiltro, dificuldade, parteDoCorpo, posterDoVideo } from "@/lib/rotina";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AbasExercicios } from "@/components/rotina/AbasExercicios";
import { Chip, LinhaFiltro } from "@/components/rotina/Chip";
import { CHAVE_CATALOGO } from "./chaves";

type Resposta = {
  items: CatalogExercise[];
  total: number;
  page: number;
  pageSize: number;
  facets: { total: number; bodyParts: { value: string; count: number }[]; equipment: { value: string; count: number }[] };
};

export default function Exercicios() {
  const [params, setParams] = useSearchParams();
  const filtros = { q: params.get("q") ?? "", bp: params.get("bp") ?? "", diff: params.get("diff") ?? "" };
  const qs = params.toString();
  const q = useQuery({
    queryKey: [...CHAVE_CATALOGO, qs],
    queryFn: () => api<Resposta>(`/exercicios/catalogo${qs ? `?${qs}` : ""}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const [busca, setBusca] = useState(filtros.q);
  const [aberto, setAberto] = useState<CatalogExercise | null>(null);

  const filtrar = (patch: Record<string, string>) => setParams(aplicarFiltro(params, patch), { replace: true });

  // Busca com debounce de 350ms (igual ao SvelteKit) para não disparar a cada tecla.
  useEffect(() => {
    if (busca === filtros.q) return;
    const t = setTimeout(() => filtrar({ q: busca.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const irPara = (p: number) => {
    setParams(aplicarFiltro(params, { page: String(p) }));
    document.getElementById("conteudo")?.scrollTo({ top: 0 });
  };

  return (
    <>
      <AbasExercicios total={q.data?.facets.total} />
      <PageHeader
        eyebrow="Biblioteca licenciada · vídeo em todos"
        title="Catálogo de exercícios"
        description="O PreceptorFISIC usa este catálogo ao gerar planos: cada exercício prescrito vem com demonstração em vídeo."
      />
      <div className="mb-4 flex h-11 items-center gap-2 rounded-md border border-line bg-bg-elevated px-3 focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
        <label htmlFor="cat-busca" className="sr-only">
          Buscar exercício
        </label>
        <Input
          id="cat-busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar exercício por nome…"
          className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {q.data && q.data.total > 0 && (
          <span className="num shrink-0 text-caption text-ink-mute" aria-live="polite">
            {numero(q.data.total)} {q.data.total === 1 ? "resultado" : "resultados"}
          </span>
        )}
      </div>
      <div className="mb-6 space-y-2">
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
        <LinhaFiltro rotulo="Nível">
          <Chip ativo={!filtros.diff} onClick={() => filtrar({ diff: "" })}>
            Todos
          </Chip>
          {DIFICULDADES.map((d) => (
            <Chip key={d.id} ativo={filtros.diff === d.id} onClick={() => filtrar({ diff: d.id })}>
              {d.label}
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
            title="Nenhum exercício encontrado"
            description="Tente outro termo ou limpe os filtros."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setBusca("");
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
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
                      className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-bg-elevated text-left transition-colors hover:border-brand/60"
                    >
                      <span className="relative block aspect-square bg-bg-muted">
                        {ex.videoUrl ? (
                          <img
                            src={posterDoVideo(ex.videoUrl)}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <Play className="absolute inset-0 m-auto size-7 text-ink-mute" aria-hidden />
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

      <Dialog open={Boolean(aberto)} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto p-0">
          {aberto && <Detalhe ex={aberto} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detalhe({ ex }: { ex: CatalogExercise }) {
  const tags = [ex.targetMuscle, ...ex.secondaryMuscles, ex.equipment, ex.difficulty ? dificuldade(ex.difficulty) : null].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <>
      {/* O GIF completo só carrega aqui, no detalhe. */}
      {ex.videoUrl && <img src={ex.videoUrl} alt={`Demonstração: ${ex.name}`} className="aspect-square w-full bg-bg-muted object-cover" />}
      <div className="space-y-4 p-5">
        <div>
          <p className="eyebrow">{parteDoCorpo(ex.bodyPart)}</p>
          <DialogTitle className="mt-1 text-h5 font-medium capitalize">{ex.name}</DialogTitle>
          <DialogDescription className="sr-only">Detalhes e execução do exercício.</DialogDescription>
        </div>
        <ul className="flex flex-wrap gap-1.5">
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
    </>
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

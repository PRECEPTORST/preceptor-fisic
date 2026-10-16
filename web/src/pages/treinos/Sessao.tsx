import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { api } from "@/lib/api";
import { data, numero } from "@/lib/format";
import { citacao, concluido, intensidadeUsada, seriesFeitas, seriesRegistradas, ultimoRegistro, type SrcRef } from "@/lib/treinos";
import { chaves, type SessaoResposta } from "@/lib/treinos-tipos";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Voltar } from "@/components/treinos/Voltar";

/**
 * Detalhe da sessão: exercício por exercício, com vídeo do catálogo, execução,
 * contraindicações, evidência e as séries que o aluno registrou de verdade.
 */
export default function TreinoSessao() {
  const { id = "", idx = "0" } = useParams();
  const q = useQuery({
    queryKey: chaves.sessao(id, idx),
    queryFn: () => api<SessaoResposta>(`/treinos/${id}/sessoes/${idx}`),
  });
  return (
    <QueryState query={q} skeleton={<SessaoSkeleton />}>
      {(d) => <Conteudo d={d} />}
    </QueryState>
  );
}

function Conteudo({ d }: { d: SessaoResposta }) {
  // Mesma fonte do Svelte: o registro do aluno é do bloco principal.
  const exercicios = d.session.main ?? [];
  const [ativo, setAtivo] = useState(0);
  const ex = exercicios[ativo];
  const logs = d.recentLogs;
  const reg = ultimoRegistro(logs, ex?.name);
  const series = seriesRegistradas(reg?.entry);
  const usada = intensidadeUsada(logs, ex?.name);

  return (
    <>
      <Voltar to={`/treinos/${d.plan.id}`}>Voltar ao treino</Voltar>
      <PageHeader
        eyebrow={d.plan.studentName}
        title={d.session.label ?? `Sessão ${d.idx + 1}`}
        description={d.session.focus}
        actions={<Dado label="Última execução" valor={<span className="num">{logs[0] ? data(logs[0].sessionDate) : "—"}</span>} />}
      />
      {exercicios.length === 0 ? (
        <EmptyState title="Sessão sem exercícios principais" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Exercícios da sessão" className="rounded-lg border border-line bg-bg-elevated shadow-card lg:sticky lg:top-6">
            <p className="eyebrow px-4 pb-2 pt-4">
              <span className="num">{exercicios.length}</span> exercícios
            </p>
            <ol className="flex gap-1 overflow-x-auto px-2 pb-2 lg:block lg:space-y-0.5">
              {exercicios.map((e, i) => {
                const feito = concluido(logs, e.name);
                const sel = i === ativo;
                return (
                  <li key={e.name + i} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setAtivo(i)}
                      aria-current={sel ? "step" : undefined}
                      className={cn(
                        "flex w-full min-w-44 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-subtle",
                        sel && "bg-brand-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "num flex size-7 shrink-0 items-center justify-center rounded-full border text-caption",
                          feito ? "border-positive/40 text-positive" : sel ? "border-brand text-brand" : "border-line text-ink-mute",
                        )}
                      >
                        {feito ? <Check className="size-3.5" aria-label="Registrado" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-body", sel ? "font-medium text-ink" : "text-ink-soft")}>{e.name}</span>
                        <span className="num block text-caption text-ink-mute">
                          {seriesFeitas(logs, e.name) ?? "—"}/{e.sets ?? "—"} séries
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {ex && (
            <div key={ativo} className="animate-soft-fade space-y-6">
              <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
                <p className="eyebrow">
                  Exercício <span className="num">{ativo + 1}</span> de <span className="num">{exercicios.length}</span>
                </p>
                <h2 className="mt-1 text-h5 font-semibold text-ink">{ex.name}</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Dado label="Séries" valor={<span className="num">{ex.sets ?? "—"}</span>} />
                  <Dado label="Repetições" valor={<span className="num">{ex.reps ?? "—"}</span>} />
                  <Dado label="Descanso" valor={<span className="num">{ex.rest_seconds ?? "—"}s</span>} />
                  <Dado
                    label="Intensidade"
                    valor={<span className="num">{ex.intensity ?? ex.load_guidance ?? "—"}</span>}
                    extra={usada != null ? <span className="num">aluno usou {usada}%</span> : undefined}
                  />
                </div>
                {ex.muscle_groups && ex.muscle_groups.length > 0 && (
                  <p className="mt-4 text-caption text-ink-mute">{ex.muscle_groups.join(" · ")}</p>
                )}
                {d.videoMap[ex.name] ? (
                  <video
                    src={d.videoMap[ex.name]}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={`Demonstração: ${ex.name}`}
                    className="mt-5 aspect-video w-full rounded-md bg-bg-subtle object-contain"
                  />
                ) : (
                  <p className="mt-5 rounded-md border border-dashed border-line p-6 text-center text-caption text-ink-mute">
                    Sem vídeo no catálogo para este exercício.
                  </p>
                )}
              </section>

              {(ex.execution_notes || (ex.contraindications?.length ?? 0) > 0 || (ex.source_refs?.length ?? 0) > 0) && (
                <section className="divide-y divide-line rounded-lg border border-line bg-bg-elevated shadow-card">
                  {ex.execution_notes && (
                    <div className="p-5">
                      <h3 className="eyebrow">Forma de execução</h3>
                      <p className="mt-2 text-body text-ink-soft">{ex.execution_notes}</p>
                    </div>
                  )}
                  {ex.contraindications && ex.contraindications.length > 0 && (
                    <div className="p-5">
                      <h3 className="eyebrow flex items-center gap-1.5 text-warning">
                        <AlertTriangle className="size-3.5" aria-hidden /> Contraindicações
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-ink-soft">
                        {ex.contraindications.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ex.source_refs && ex.source_refs.length > 0 && (
                    <div className="p-5">
                      <h3 className="eyebrow">Evidência clínica</h3>
                      <ul className="mt-2 space-y-2">
                        {ex.source_refs.map((r, i) => {
                          const c = citacao(r as SrcRef, d.plan.sourceMap, 70);
                          if (!c.label) return null;
                          return (
                            <li key={i} className="text-caption text-ink-soft">
                              <span className="text-ink-mute">{c.badge} · </span>
                              {c.label}
                              {c.excerpt && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer hover:text-ink">Ver trecho</summary>
                                  <blockquote className="mt-1 border-l-2 border-line pl-3 italic">
                                    “{c.excerpt}
                                    {c.excerpt.length >= 280 ? "…" : ""}”
                                  </blockquote>
                                </details>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card" aria-labelledby="registro">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 id="registro" className="text-h6 font-medium text-ink">
                    Registro do aluno
                  </h3>
                  <p className="text-caption text-ink-mute">
                    {reg ? (
                      <>
                        <span className="num">{series.length}</span>/<span className="num">{ex.sets ?? "—"}</span> séries
                        {reg.session.perceivedEffort != null && (
                          <>
                            {" · "}PSE <span className="num">{reg.session.perceivedEffort}</span>
                          </>
                        )}
                        {" · "}
                        <span className="num">{data(reg.session.sessionDate)}</span>
                      </>
                    ) : (
                      "sem registro"
                    )}
                  </p>
                </div>
                {series.length === 0 ? (
                  <p className="mt-3 text-body text-ink-mute">
                    O aluno ainda não registrou este exercício. Os dados aparecem aqui quando ele fizer a sessão pelo app.
                  </p>
                ) : (
                  <table className="mt-3 w-full text-body">
                    <caption className="sr-only">Séries registradas</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="eyebrow py-2 text-left font-normal">Série</th>
                        <th scope="col" className="eyebrow py-2 text-right font-normal">Carga</th>
                        <th scope="col" className="eyebrow py-2 text-right font-normal">Reps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {series.map((s, i) => (
                        <tr key={i}>
                          <td className="num py-2 text-ink-soft">{i + 1}</td>
                          <td className="num py-2 text-right text-ink">{s.weight != null ? `${numero(s.weight)} kg` : "—"}</td>
                          <td className="num py-2 text-right text-ink">{s.reps ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <div className="flex justify-between gap-2">
                <Button variant="outline" disabled={ativo === 0} onClick={() => setAtivo((a) => Math.max(0, a - 1))}>
                  <ChevronLeft aria-hidden /> Anterior
                </Button>
                <Button disabled={ativo === exercicios.length - 1} onClick={() => setAtivo((a) => Math.min(exercicios.length - 1, a + 1))}>
                  Próximo <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SessaoSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

/** Número com rótulo dentro de card (o Stat compartilhado já é um card). */
function Dado({ label, valor, extra }: { label: string; valor: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-h6 font-medium text-ink">{valor}</p>
      {extra && <p className="mt-0.5 text-caption text-ink-mute">{extra}</p>}
    </div>
  );
}

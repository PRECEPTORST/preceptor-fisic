import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { PlanData } from "$lib/server/queries";
import { api } from "@/lib/api";
import { BLOCOS, nivelLabel, nivelTom, type Nivel } from "@/lib/treinos";
import { chaves, type StatusGeracao } from "@/lib/treinos-tipos";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";

/**
 * Plano em geração: faz polling de /status a cada 800ms (o backend grava o
 * texto a cada ~180ms) e mostra o plano parcial no formato final. Ao terminar
 * (gerado ou falhou), invalida o plano e a tela troca sozinha.
 */
export function GeracaoAoVivo({
  planoId,
  aluno,
  fila,
  onFim,
}: {
  planoId: string;
  aluno: string;
  fila: boolean;
  onFim?: (gerado: boolean) => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaves.status(planoId),
    queryFn: () => api<StatusGeracao>(`/treinos/${planoId}/status`),
    refetchInterval: (query) => (query.state.data?.generated || query.state.data?.failed ? false : 800),
    refetchIntervalInBackground: true,
    retry: true,
  });
  const fim = q.data?.generated || q.data?.failed;
  useEffect(() => {
    if (fim) {
      void qc.invalidateQueries({ queryKey: chaves.plano(planoId) });
      void qc.invalidateQueries({ queryKey: chaves.lista });
      onFim?.(Boolean(q.data?.generated));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fim, planoId, qc]);

  const progresso = q.data?.progress ?? 5;
  const fase = q.data?.phase ?? (fila ? "enfileirado" : "iniciando…");
  const p = q.data?.partial;

  return (
    <div className="mx-auto max-w-3xl" aria-live="polite">
      <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-8 animate-spin text-brand" aria-hidden />
          <div>
            <p className="eyebrow">{aluno}</p>
            <h1 className="text-h6 font-medium text-ink">Gerando treino com o PreceptorFISIC</h1>
          </div>
        </div>
        <p className="num text-h5 font-semibold text-brand">{progresso}%</p>
      </div>
      <Progress value={progresso} className="mt-4 h-1 bg-bg-muted [&>div]:bg-brand" aria-label="Progresso da geração" />
      <p className="mt-3 font-mono text-label uppercase text-brand">{fase}</p>

      {p ? <Parcial p={p} /> : <Esqueleto />}

      <p className="mt-8 text-center text-caption text-ink-mute">
        Costuma levar de 15 a 30 segundos, às vezes alguns minutos. Pode sair desta tela: a geração continua e o treino aparece em Treinos.
      </p>
    </div>
  );
}

function Parcial({ p }: { p: PlanData }) {
  const sessoes = (p.weekly_sessions ?? []).filter((s) => s.label);
  const restricoes = (p.restrictions ?? []).filter((r) => r.title);
  const monit = ((p.monitoring_parameters ?? []) as { parameter?: string; frequency?: string }[]).filter((m) => m.parameter);
  return (
    <div className="mt-6 space-y-4">
      {p.summary && (
        <Bloco titulo="Resumo clínico">
          <p className="text-body text-ink-soft">{p.summary}</p>
        </Bloco>
      )}
      {restricoes.length > 0 && (
        <Bloco titulo={`Restrições · ${restricoes.length}`}>
          <ul className="space-y-1.5">
            {restricoes.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-body">
                <StatusChip tone={nivelTom((r.level as Nivel) ?? "green")}>{nivelLabel((r.level as Nivel) ?? "green")}</StatusChip>
                <span className="text-ink">{r.title}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
      {sessoes.length > 0 && (
        <Bloco titulo={`Sessões · ${sessoes.length}`}>
          <div className="space-y-3">
            {sessoes.map((s, si) => (
              <div key={si} className="rounded-md border border-line bg-bg-subtle p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">{s.label}</p>
                  {s.duration_minutes && <span className="num text-caption text-ink-mute">{s.duration_minutes} min</span>}
                </div>
                {s.focus && <p className="text-caption text-ink-mute">{s.focus}</p>}
                {BLOCOS.map(([k, label]) => {
                  const itens = (s[k] ?? []).filter((e) => e.name);
                  if (itens.length === 0) return null;
                  return (
                    <div key={k} className="mt-2">
                      <p className="eyebrow">{label}</p>
                      <ul className="mt-1 space-y-0.5">
                        {itens.map((e, ei) => (
                          <li key={ei} className="flex justify-between gap-2 text-caption text-ink-soft">
                            <span>{e.name}</span>
                            {e.sets && e.reps && (
                              <span className="num text-ink-mute">
                                {e.sets}×{e.reps}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Bloco>
      )}
      {monit.length > 0 && (
        <Bloco titulo={`Monitoramento · ${monit.length}`}>
          <ul className="space-y-1">
            {monit.map((m, i) => (
              <li key={i} className="flex justify-between gap-3 text-body">
                <span className="text-ink">{m.parameter}</span>
                {m.frequency && <span className="text-caption text-ink-mute">{m.frequency}</span>}
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="animate-soft-fade rounded-lg border border-line bg-bg-elevated p-4">
      <p className="eyebrow mb-2">{titulo}</p>
      {children}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="mt-6 space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-2/5" />
    </div>
  );
}

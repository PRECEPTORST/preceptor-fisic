import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Minus, Plus, Timer, X } from "lucide-react";
import { classifyExercise, loadInputHint } from "$lib/exercise-load";
import type { PlanExercise } from "$lib/server/queries";
import { apiAluno } from "@/lib/aluno-api";
import {
  relogio,
  rotuloPSE,
  seriesIniciais,
  somar,
  type EntradaTreino,
  type Serie,
  type TipoCarga,
} from "@/lib/aluno-treino";
import { useTitulo } from "@/lib/useTitulo";
import { cn } from "@/lib/utils";
import { AlunoShell, useAlunoLink } from "@/components/publico/AlunoShell";
import { AlunoEstado } from "@/components/publico/AlunoEstado";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { chaveAluno, chaveHistorico, chaveTreino, type TreinoAluno } from "./tipos";

export default function Treino() {
  const { id, token } = useAlunoLink();
  const idx = Number(useParams().idx);
  const q = useQuery({
    queryKey: chaveTreino(id, idx),
    queryFn: () => apiAluno<TreinoAluno>(id, token, `/treino/${idx}`),
  });
  useTitulo(`${q.data?.session.label ?? "Treino"} · PreceptorFISIC`);
  return (
    <AlunoEstado query={q} skeleton={<AlunoShell voltar titulo="Treino"><TreinoSkeleton /></AlunoShell>}>
      {(d) => <Execucao key={`${id}-${idx}`} d={d} />}
    </AlunoEstado>
  );
}

type Estado = { series: Serie[][]; concluido: boolean[]; pct: string[] };

/** Rascunho do treino em andamento: recarregar a página na academia não pode perder as séries. */
function useRascunho(chave: string, inicial: () => Estado) {
  const [estado, setEstado] = useState<Estado>(() => {
    const base = inicial();
    try {
      const salvo = JSON.parse(sessionStorage.getItem(chave) ?? "null") as Estado | null;
      // Plano mudou desde o rascunho: descarta.
      if (salvo && salvo.series?.length === base.series.length && salvo.concluido?.length === base.concluido.length) return salvo;
    } catch {
      /* sem storage ou rascunho corrompido */
    }
    return base;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(chave, JSON.stringify(estado));
    } catch {
      /* sem storage */
    }
  }, [chave, estado]);
  const limpar = () => {
    try {
      sessionStorage.removeItem(chave);
    } catch {
      /* sem storage */
    }
  };
  return [estado, setEstado, limpar] as const;
}

function Execucao({ d }: { d: TreinoAluno }) {
  const { id, token, base, q } = useAlunoLink();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const exercicios = d.session.main ?? [];
  const total = exercicios.length;
  const inicio = useRef(Date.now());
  const [ativo, setAtivo] = useState(0); // 0..total-1 = exercício; total = finalizar
  const [rpe, setRpe] = useState<number | null>(null);
  const [obs, setObs] = useState("");

  const tipos: TipoCarga[] = useMemo(
    () =>
      exercicios.map((e) =>
        classifyExercise({
          name: e.name,
          equipment: (e as { equipment?: string }).equipment ?? null,
          muscle_groups: e.muscle_groups,
          body_part: (e as { body_part?: string }).body_part ?? null,
        }),
      ),
    [exercicios],
  );

  const [estado, setEstado, limparRascunho] = useRascunho(`pf_treino_${id}_${d.sessionIdx}`, () => ({
    series: exercicios.map(seriesIniciais),
    concluido: exercicios.map(() => false),
    pct: exercicios.map(() => ""),
  }));

  const feitos = estado.concluido.filter(Boolean).length;
  const algoRegistrado = feitos > 0 || estado.series.some((ss) => ss.some((s) => s.weight.trim()));

  const enviar = useMutation({
    mutationFn: () => {
      const entrada: EntradaTreino = {
        exercicios: exercicios.map((_, i) => ({
          kind: tipos[i] ?? "weight",
          series: estado.series[i] ?? [],
          concluido: estado.concluido[i] ?? false,
          pct: estado.pct[i] ?? "",
        })),
        rpe,
        observacoes: obs,
        duracaoMin: Math.round((Date.now() - inicio.current) / 60000),
      };
      return apiAluno(id, token, `/treino/${d.sessionIdx}`, { method: "POST", json: entrada });
    },
    onSuccess: () => {
      limparRascunho();
      qc.invalidateQueries({ queryKey: chaveAluno(id) });
      qc.invalidateQueries({ queryKey: chaveHistorico(id) });
      navigate(`${base}${q}${q ? "&" : "?"}just_completed=1`, { replace: true });
    },
    onError: (e: Error) => toast.error(`Não consegui registrar o treino: ${e.message}`),
  });

  if (total === 0) {
    return (
      <AlunoShell voltar titulo={d.session.label}>
        <EmptyState compact title="Esta sessão não tem exercícios" description="Fale com seu treinador." />
      </AlunoShell>
    );
  }

  const ex = exercicios[ativo];
  const naFinal = ativo >= total;

  const atualizar = (fn: (e: Estado) => void) =>
    setEstado((e) => {
      const n: Estado = { series: e.series.map((s) => s.map((x) => ({ ...x }))), concluido: [...e.concluido], pct: [...e.pct] };
      fn(n);
      return n;
    });

  return (
    <AlunoShell
      voltar
      semAbas
      subtitulo={`Sessão ${d.sessionIdx + 1}${d.session.duration_minutes ? ` · ${d.session.duration_minutes} min` : ""}`}
      titulo={d.session.label ?? "Treino"}
    >
      <Progresso total={total} ativo={ativo} concluido={estado.concluido} onIr={setAtivo} />

      {ex && !naFinal && (
        <Exercicio
          key={ativo}
          ex={ex}
          n={ativo}
          total={total}
          tipo={tipos[ativo] ?? "weight"}
          video={d.videoMap[ex.name]?.videoUrl ?? null}
          series={estado.series[ativo] ?? []}
          pct={estado.pct[ativo] ?? ""}
          concluido={estado.concluido[ativo] ?? false}
          onSerie={(si, campo, v) => atualizar((e) => void (e.series[ativo]![si]![campo] = v))}
          onRepetirPeso={() =>
            atualizar((e) => {
              const w = e.series[ativo]![0]?.weight ?? "";
              e.series[ativo] = e.series[ativo]!.map((s) => ({ ...s, weight: w }));
            })
          }
          onPct={(v) => atualizar((e) => void (e.pct[ativo] = v))}
          onConcluir={() => {
            atualizar((e) => void (e.concluido[ativo] = !e.concluido[ativo]));
            if (!estado.concluido[ativo]) setAtivo((a) => Math.min(a + 1, total));
          }}
        />
      )}

      {naFinal && (
        <section aria-labelledby="fim" className="animate-soft-fade space-y-6">
          <div>
            <h2 id="fim" className="text-h5 font-medium">
              Como foi o treino?
            </h2>
            <p className="mt-1 text-body text-ink-soft">
              <span className="num">{feitos}</span> de <span className="num">{total}</span> exercícios concluídos ·{" "}
              <span className="num">{Math.max(1, Math.round((Date.now() - inicio.current) / 60000))}</span> min
            </p>
          </div>

          <EscalaPSE valor={rpe} onChange={setRpe} />

          <div className="space-y-1.5">
            <label htmlFor="obs" className="text-body font-medium">
              Observação para o treinador <span className="font-normal text-ink-mute">(opcional)</span>
            </label>
            <Textarea
              id="obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="Sentiu alguma dor? Algo foi fácil ou difícil demais?"
              className="text-body-lg"
            />
          </div>

          {!algoRegistrado && (
            <p role="status" className="text-caption text-warning">
              Marque ao menos um exercício como feito para concluir.
            </p>
          )}
        </section>
      )}

      {/* Ações fixas no polegar. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg-elevated/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            className="h-14 flex-1 text-body-lg"
            disabled={ativo === 0}
            onClick={() => setAtivo((a) => Math.max(0, a - 1))}
          >
            <ChevronLeft aria-hidden /> Anterior
          </Button>
          {naFinal ? (
            <Button className="h-14 flex-[2] text-body-lg" disabled={enviar.isPending || !algoRegistrado} onClick={() => enviar.mutate()}>
              {enviar.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {enviar.isPending ? "Registrando…" : "Concluir treino"}
            </Button>
          ) : (
            <Button variant={ativo === total - 1 ? "default" : "secondary"} className="h-14 flex-[2] text-body-lg" onClick={() => setAtivo((a) => a + 1)}>
              {ativo === total - 1 ? "Finalizar" : "Próximo"} <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </AlunoShell>
  );
}

function Progresso({ total, ativo, concluido, onIr }: { total: number; ativo: number; concluido: boolean[]; onIr: (i: number) => void }) {
  return (
    <nav aria-label="Exercícios do treino" className="-mx-4 mb-5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <ol className="flex gap-2">
        {Array.from({ length: total }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onIr(i)}
              aria-current={i === ativo ? "step" : undefined}
              aria-label={`Exercício ${i + 1}${concluido[i] ? ", feito" : ""}`}
              className={cn(
                "num flex size-11 items-center justify-center rounded-full border text-body font-medium transition-colors",
                i === ativo ? "border-brand bg-brand text-brand-on" : concluido[i] ? "border-positive/50 bg-positive-soft text-positive" : "border-line text-ink-soft",
              )}
            >
              {concluido[i] ? <Check className="size-4" aria-hidden /> : i + 1}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onIr(total)}
            aria-current={ativo >= total ? "step" : undefined}
            className={cn(
              "flex h-11 items-center rounded-full border px-4 text-body font-medium",
              ativo >= total ? "border-brand bg-brand text-brand-on" : "border-line text-ink-soft",
            )}
          >
            Fim
          </button>
        </li>
      </ol>
    </nav>
  );
}

function Exercicio(p: {
  ex: PlanExercise;
  n: number;
  total: number;
  tipo: TipoCarga;
  video: string | null;
  series: Serie[];
  pct: string;
  concluido: boolean;
  onSerie: (i: number, campo: keyof Serie, v: string) => void;
  onRepetirPeso: () => void;
  onPct: (v: string) => void;
  onConcluir: () => void;
}) {
  const { ex, tipo } = p;
  const dica = loadInputHint(tipo);
  const passo = tipo === "time" ? 5 : 2.5;
  return (
    <article aria-labelledby="ex-nome" className="animate-soft-fade space-y-5">
      <header>
        <p className="eyebrow">
          Exercício <span className="num">{p.n + 1}</span> de <span className="num">{p.total}</span>
        </p>
        <h2 id="ex-nome" className="mt-1 text-h4 font-medium">
          {ex.name}
        </h2>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-body text-ink-soft">
          <div className="flex gap-1">
            <dt>Séries</dt>
            <dd className="num text-ink">{ex.series_label ?? ex.sets ?? "—"}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Reps</dt>
            <dd className="num text-ink">{ex.reps ?? "—"}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Descanso</dt>
            <dd className="num text-ink">{ex.rest_label ?? (ex.rest_seconds != null ? `${ex.rest_seconds}s` : "—")}</dd>
          </div>
          {ex.intensity && (
            <div className="flex gap-1">
              <dt>Intensidade</dt>
              <dd className="num text-ink">{ex.intensity}</dd>
            </div>
          )}
        </dl>
        {ex.load_guidance && <p className="mt-2 text-body text-ink-soft">{ex.load_guidance}</p>}
      </header>

      {p.video ? (
        <img src={p.video} alt={`Demonstração: ${ex.name}`} loading="lazy" className="aspect-video w-full rounded-lg border border-line bg-bg-muted object-contain" />
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-caption text-ink-mute">
          Sem vídeo de demonstração para este exercício.
        </p>
      )}

      {ex.contraindications && ex.contraindications.length > 0 && (
        <div role="note" className="flex gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-body">
            <span className="font-medium text-warning">Atenção: </span>
            {ex.contraindications.join(" · ")}
          </p>
        </div>
      )}

      {ex.execution_notes && (
        <details className="group rounded-lg border border-line bg-bg-elevated shadow-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-body font-medium">
            Como executar
            <ChevronRight className="size-4 text-ink-mute transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <p className="border-t border-line px-4 py-3 text-body text-ink-soft">{ex.execution_notes}</p>
        </details>
      )}

      {ex.rest_seconds ? <Descanso segundos={ex.rest_seconds} /> : null}

      <section aria-labelledby="series" className="rounded-lg border border-line bg-bg-elevated shadow-card">
        <header className="flex items-center justify-between gap-2 px-4 pt-4">
          <div>
            <h3 id="series" className="text-h6 font-medium">
              Suas séries
            </h3>
            <p className="text-caption text-ink-mute">{dica.help}</p>
          </div>
          {tipo === "weight" && p.series.length > 1 && (
            <Button variant="ghost" className="h-11 shrink-0 text-caption" onClick={p.onRepetirPeso}>
              Repetir peso da 1ª
            </Button>
          )}
        </header>
        <ol className="mt-2 divide-y divide-line">
          {p.series.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="num w-8 text-body font-medium text-ink-mute">{i + 1}ª</span>
              {tipo !== "bodyweight" && (
                <Stepper
                  id={`carga-${i}`}
                  rotulo={`${tipo === "time" ? "Duração" : "Carga"} da série ${i + 1}`}
                  unidade={dica.unit}
                  valor={s.weight}
                  placeholder={dica.placeholder}
                  passo={passo}
                  decimal={tipo !== "time"}
                  onChange={(v) => p.onSerie(i, "weight", v)}
                />
              )}
              <Stepper
                id={`reps-${i}`}
                rotulo={`Repetições da série ${i + 1}`}
                unidade="reps"
                valor={s.reps}
                placeholder="0"
                passo={1}
                onChange={(v) => p.onSerie(i, "reps", v)}
              />
            </li>
          ))}
        </ol>
        <p className="border-t border-line px-4 py-3 text-caption text-ink-mute">
          {tipo === "bodyweight" ? "Peso corporal: conta só as repetições." : "Peso corporal? Deixe a carga vazia e conte só as repetições."}
        </p>
        <div className="border-t border-line px-4 py-3">
          <label htmlFor="pct" className="text-body font-medium">
            % da carga máxima usada hoje <span className="font-normal text-ink-mute">(opcional)</span>
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="pct"
              inputMode="numeric"
              value={p.pct}
              onChange={(e) => p.onPct(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
              placeholder={ex.intensity ? `prescrito: ${ex.intensity}` : "ex.: 80"}
              className="num h-12 w-40 rounded-md border border-input bg-bg px-3 text-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-body text-ink-mute">%</span>
          </div>
        </div>
      </section>

      <Button
        variant={p.concluido ? "outline" : "default"}
        aria-pressed={p.concluido}
        className={cn("h-14 w-full text-body-lg", p.concluido && "border-positive/50 text-positive")}
        onClick={p.onConcluir}
      >
        {p.concluido ? (
          <>
            <Check aria-hidden /> Feito. Toque para desfazer
          </>
        ) : (
          "Marcar como feito"
        )}
      </Button>
    </article>
  );
}

/** Campo numérico com − e + de 48px (uma mão, luva, suor). */
function Stepper(p: {
  id: string;
  rotulo: string;
  unidade: string;
  valor: string;
  placeholder: string;
  passo: number;
  decimal?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={p.rotulo}>
      <Button variant="outline" size="icon" className="size-12" aria-label={`Diminuir ${p.rotulo.toLowerCase()}`} onClick={() => p.onChange(somar(p.valor, -p.passo))}>
        <Minus aria-hidden />
      </Button>
      <label htmlFor={p.id} className="sr-only">
        {p.rotulo}
      </label>
      <input
        id={p.id}
        inputMode={p.decimal ? "decimal" : "numeric"}
        value={p.valor}
        placeholder={p.placeholder}
        onChange={(e) => p.onChange(e.target.value.replace(p.decimal ? /[^\d,.]/g : /\D/g, "").slice(0, 6))}
        className="num h-12 w-16 rounded-md border border-input bg-bg text-center text-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button variant="outline" size="icon" className="size-12" aria-label={`Aumentar ${p.rotulo.toLowerCase()}`} onClick={() => p.onChange(somar(p.valor, p.passo))}>
        <Plus aria-hidden />
      </Button>
      {p.unidade && <span className="ml-1 text-caption text-ink-mute">{p.unidade}</span>}
    </div>
  );
}

/** Timer de descanso entre séries, com o tempo prescrito. */
function Descanso({ segundos }: { segundos: number }) {
  const [resta, setResta] = useState<number | null>(null);
  useEffect(() => {
    if (resta == null) return;
    if (resta <= 0) {
      try {
        navigator.vibrate?.(300);
      } catch {
        /* sem vibração */
      }
      return;
    }
    const t = setTimeout(() => setResta((r) => (r == null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [resta]);

  const rodando = resta != null && resta > 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-elevated p-3 shadow-card">
      <Timer className="size-5 shrink-0 text-ink-mute" aria-hidden />
      <p className="flex-1 text-body" aria-live="polite">
        {resta == null ? (
          <>
            Descanso de <span className="num">{relogio(segundos)}</span>
          </>
        ) : rodando ? (
          <>
            Descansando: <span className="num text-h6 font-medium">{relogio(resta)}</span>
          </>
        ) : (
          <span className="font-medium text-positive">Descanso acabou. Próxima série.</span>
        )}
      </p>
      {rodando ? (
        <Button variant="ghost" className="h-12" onClick={() => setResta(null)} aria-label="Parar o descanso">
          <X aria-hidden /> Parar
        </Button>
      ) : (
        <Button variant="secondary" className="h-12" onClick={() => setResta(segundos)}>
          {resta == null ? "Iniciar" : "De novo"}
        </Button>
      )}
    </div>
  );
}

/** PSE 0–10 com rótulo (CR-10). Radiogroup: setas do teclado funcionam. */
function EscalaPSE({ valor, onChange }: { valor: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="text-body font-medium">Esforço percebido (PSE)</legend>
      <p className="text-caption text-ink-mute">De 0 (repouso) a 10 (máximo). Pense no treino inteiro.</p>
      <div role="radiogroup" aria-label="PSE de 0 a 10" className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={valor === v}
            aria-label={`${v}, ${rotuloPSE(v)}`}
            onClick={() => onChange(v)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(10, (valor ?? -1) + 1));
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, (valor ?? 1) - 1));
            }}
            tabIndex={valor === v || (valor == null && v === 0) ? 0 : -1}
            className={cn(
              "num h-12 rounded-md border text-body-lg font-medium transition-colors",
              valor === v ? "border-brand bg-brand text-brand-on" : "border-line bg-bg-elevated text-ink hover:border-line-strong",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-6 text-body" aria-live="polite">
        {valor == null ? <span className="text-ink-mute">Toque num número.</span> : <><span className="num font-medium">{valor}</span> · {rotuloPSE(valor)}</>}
      </p>
    </fieldset>
  );
}

function TreinoSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando">
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="size-11 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

// Lógica pura do app do aluno (/a/:id). Usada pelo front E pela API
// (server/routes/publico.ts): a montagem do registro do treino é a mesma
// da form action `complete` do SvelteKit, só que a entrada chega em JSON.
import type { PlanExercise, PlanSessionData } from "$lib/server/queries";

export type TipoCarga = "weight" | "bodyweight" | "time";
export type Serie = { weight: string; reps: string };

/** O que o front manda ao finalizar o treino. Um item por exercício de `main`, na ordem. */
export type EntradaTreino = {
  exercicios: { kind: TipoCarga; series: Serie[]; concluido: boolean; pct: string }[];
  rpe: number | null;
  observacoes: string;
  duracaoMin: number;
};

export type ExerciseLogMontado = {
  exercise_id: string;
  name: string;
  sets_done: number;
  reps_done: string;
  load_used?: string;
  set_logs?: { weight: number; reps: number; unit: "kg" | "s" }[];
  intensity_used?: number;
  notes?: undefined;
  completed: boolean;
};

/** Reps prescritas → número para pré-preencher. "8-12" vira "12" (alvo superior). */
export function repsPadrao(reps: string | undefined): string {
  if (!reps) return "";
  const m = String(reps).match(/(\d+)\s*(?:-|–|a|to|até)\s*(\d+)/);
  if (m) return m[2]!;
  const s = String(reps).match(/(\d+)/);
  return s ? s[1]! : "";
}

/** N linhas (séries prescritas) com reps pré-preenchidas e peso vazio. */
export function seriesIniciais(ex: Pick<PlanExercise, "sets" | "reps">): Serie[] {
  const n = Math.max(1, Number(ex.sets) || 1);
  const r = repsPadrao(ex.reps);
  return Array.from({ length: n }, () => ({ weight: "", reps: r }));
}

/** Aceita "72,5" e "72.5". */
function numeroBR(v: string | undefined): number {
  return Number(String(v ?? "").replace(",", ".")) || 0;
}

/** Monta os exerciseLogs gravados em training_sessions. Mesmas regras da action do SvelteKit. */
export function montarExerciseLogs(
  main: PlanExercise[],
  planId: string,
  idx: number,
  entrada: EntradaTreino,
): ExerciseLogMontado[] {
  return main.map((ex, i) => {
    const e = entrada.exercicios[i];
    const kind: TipoCarga = e?.kind === "time" || e?.kind === "bodyweight" ? e.kind : "weight";
    // Para `time` o campo weight é SEGUNDOS: nunca pode virar "kg".
    const unit: "kg" | "s" = kind === "time" ? "s" : "kg";
    const series = (e?.series ?? [])
      .map((r) => ({ weight: numeroBR(r.weight), reps: parseInt(String(r.reps ?? ""), 10) || 0 }))
      .filter((r) => r.weight > 0 || r.reps > 0);

    const setsDone = series.length || Number(ex.sets ?? 0) || 0;
    const repsDone = series.length ? series.map((s) => s.reps).join(",") : String(ex.reps ?? "—");
    const maxWeight = series.reduce((m, s) => Math.max(m, s.weight), 0);
    const pct = numeroBR(e?.pct);
    const intensityUsed = Number.isFinite(pct) && pct > 0 && pct <= 100 ? Math.round(pct) : undefined;

    return {
      exercise_id: `${planId}-${idx}-${i}`,
      name: ex.name,
      sets_done: setsDone,
      reps_done: repsDone,
      load_used: maxWeight > 0 ? `${maxWeight}${unit}` : undefined,
      set_logs: series.length ? series.map((s) => ({ ...s, unit })) : undefined,
      intensity_used: intensityUsed,
      notes: undefined,
      // Série preenchida conta como trabalho feito, mesmo sem o toque em "concluído".
      completed: Boolean(e?.concluido) || series.length > 0,
    };
  });
}

/** PSE só 0–10 (coluna integer). Fora disso, undefined. */
export function normalizarPSE(rpe: number | null | undefined): number | undefined {
  if (rpe == null || !Number.isFinite(rpe)) return undefined;
  return Math.min(10, Math.max(0, Math.round(rpe)));
}

/** Duração plausível (5–180 min); senão a do plano; senão ~3,5 min por série. */
export function duracaoDoTreino(decorridoMin: number, session: PlanSessionData): number | undefined {
  if (Number.isFinite(decorridoMin) && decorridoMin >= 5 && decorridoMin <= 180) return Math.round(decorridoMin);
  const planejada = session.duration_minutes ?? null;
  if (planejada && planejada >= 5) return planejada;
  const totalSeries = (session.main ?? []).reduce((acc, ex) => acc + (Number(ex.sets) || 3), 0);
  const estimativa = Math.round(totalSeries * 3.5);
  return estimativa >= 5 ? Math.min(estimativa, 180) : undefined;
}

// ── Início: qual sessão é hoje ─────────────────────────────────────────────

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
export const NOME_DIA: Record<string, string> = {
  dom: "domingo",
  seg: "segunda",
  ter: "terça",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sab: "sábado",
};

/**
 * Índice da sessão de hoje. Com grade (day_of_week): a sessão marcada para
 * hoje, ou -1 (descanso). Sem grade (planos antigos): rodízio pelo dia da semana.
 */
export function sessaoDeHoje(sessoes: Pick<PlanSessionData, "day_of_week">[], hoje: Date): number {
  if (sessoes.length === 0) return -1;
  if (sessoes.some((s) => s.day_of_week)) return sessoes.findIndex((s) => s.day_of_week === DIAS[hoje.getDay()]);
  return hoje.getDay() % sessoes.length;
}

/** Em dia de descanso com grade, o próximo treino a partir de amanhã. -1 se não houver. */
export function proximaSessao(sessoes: Pick<PlanSessionData, "day_of_week">[], hoje: Date): number {
  if (!sessoes.some((s) => s.day_of_week) || sessaoDeHoje(sessoes, hoje) >= 0) return -1;
  for (let k = 1; k <= 7; k++) {
    const dia = DIAS[(hoje.getDay() + k) % 7];
    const i = sessoes.findIndex((s) => s.day_of_week === dia);
    if (i >= 0) return i;
  }
  return -1;
}

/** "hoje", "ontem" ou "12 out". */
export function dataRelativa(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === agora.toDateString()) return "hoje";
  if (d.toDateString() === ontem.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

/** Letra da sessão: 0 → A. */
export const letra = (i: number) => String.fromCharCode(65 + i);

/** Rótulo da escala de PSE (CR-10 de Borg adaptada), 0 a 10. */
export function rotuloPSE(v: number): string {
  if (v <= 0) return "Repouso";
  if (v <= 2) return "Muito leve";
  if (v <= 4) return "Leve a moderado";
  if (v <= 6) return "Pesado";
  if (v <= 8) return "Muito pesado";
  if (v === 9) return "Quase máximo";
  return "Máximo";
}

/** Soma `passo` a um número digitado ("42,5"), sem ficar negativo. Devolve no formato BR. */
export function somar(valor: string, passo: number): string {
  const atual = Number(String(valor).replace(",", ".")) || 0;
  const n = Math.max(0, Math.round((atual + passo) * 100) / 100);
  return n === 0 ? "" : String(n).replace(".", ",");
}

/** "1:05" a partir de segundos. */
export function relogio(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

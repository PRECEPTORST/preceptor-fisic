// Lógica pura do domínio "treinos" (lista, editor, sessão, impressão). Sem React.
import type { StatusTone } from "@/components/ui/status-chip";
import type { PlanExercise, PlanSessionData, SessionLogEntry, SourceMap } from "$lib/server/queries";

export type StatusPlano = "pending" | "generating" | "generated" | "published" | "failed" | "archived";

const STATUS_LABEL: Record<string, string> = {
  pending: "Na fila",
  generating: "Gerando…",
  generated: "Rascunho",
  published: "Publicado",
  failed: "Falhou",
  archived: "Arquivado",
};
const STATUS_TOM: Record<string, StatusTone> = {
  pending: "info",
  generating: "info",
  generated: "warning",
  published: "positive",
  failed: "negative",
  archived: "neutral",
};

export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
export const statusTom = (s: string): StatusTone => STATUS_TOM[s] ?? "neutral";
export const gerando = (s: string) => s === "pending" || s === "generating";

export type FiltroPlanos = "todos" | "ativos" | "encerrados";

/** Mesmo critério do Svelte: gerando conta como ativo, não como encerrado. */
export function filtrarPlanos<T extends { isActive: boolean; status: string }>(planos: T[], f: FiltroPlanos): T[] {
  if (f === "todos") return planos;
  if (f === "ativos") return planos.filter((p) => p.isActive || gerando(p.status));
  return planos.filter((p) => !p.isActive && !gerando(p.status));
}

export const BLOCOS = [
  ["warmup", "Aquecimento"],
  ["main", "Principal"],
  ["cooldown", "Volta à calma"],
] as const;
export type Bloco = (typeof BLOCOS)[number][0];

/** Termo inicial da busca no "trocar": 1º token do 1º grupo muscular, senão 1ª palavra do nome. */
export function termoInicial(ex?: { name?: string; muscle_groups?: string[] | null }): string {
  if (!ex) return "";
  const mg = (ex.muscle_groups ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (mg.length > 0) return mg[0]?.split(/[\s,/]+/)[0] ?? "";
  return (ex.name ?? "").trim().split(/[\s,]+/)[0] ?? "";
}

export const DIFICULDADE: Record<string, string> = {
  beginner: "iniciante",
  intermediate: "intermediário",
  advanced: "avançado",
};

export type Nivel = "red" | "yellow" | "green";
export const nivelLabel = (l: Nivel) => (l === "red" ? "Crítico" : l === "yellow" ? "Cuidado" : "OK");
export const nivelTom = (l: Nivel): StatusTone => (l === "red" ? "negative" : l === "yellow" ? "warning" : "positive");

export type SrcRef = {
  type?: string;
  chunk_id?: string;
  source_id?: string;
  rule_code?: string;
  note?: string;
  page_number?: number;
};

/** Citação legível de uma fonte (regra, diretriz com página, inferência). */
export function citacao(
  ref: SrcRef | null | undefined,
  sourceMap: SourceMap,
  max = 60,
): { badge: string; label: string; excerpt?: string } {
  if (!ref) return { badge: "", label: "" };
  if (ref.type === "rule" && ref.rule_code) return { badge: "Regra", label: `Regra ${ref.rule_code}` };
  const key = ref.chunk_id ?? ref.source_id;
  const s = key ? sourceMap[key] : undefined;
  if (s) {
    const yr = s.year ? `, ${s.year}` : "";
    const pg = s.pageNumber ? ` · p.${s.pageNumber}` : ref.page_number ? ` · p.${ref.page_number}` : "";
    const titulo = s.title.length > max ? s.title.slice(0, max) + "…" : s.title;
    return { badge: "Diretriz", label: `${s.organization.toUpperCase()}${yr}${pg} — ${titulo}`, excerpt: s.excerpt };
  }
  if (ref.note) return { badge: "Nota", label: ref.note };
  if (ref.type === "inference") return { badge: "Inferência", label: "Inferência clínica" };
  if (ref.type === "rag_chunk") return { badge: "Diretriz", label: "Diretriz clínica" };
  return { badge: "", label: "" };
}

export const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** Texto do toast depois de mexer no plano, com o resultado da revalidação. */
export function mensagemValidacao(
  base: string,
  v: { violations: number } | null | undefined,
): { tipo: "success" | "warning"; texto: string } {
  const n = v?.violations ?? 0;
  if (v && n > 0)
    return { tipo: "warning", texto: `${base} ${n} ${plural(n, "violação clínica", "violações clínicas")} para revisar.` };
  return { tipo: "success", texto: base };
}

// ── Sessão: registros reais do aluno ──
type Feito = SessionLogEntry["exercisesDone"][number] & { set_logs?: { weight: number; reps: number }[] };
type Log = Omit<SessionLogEntry, "sessionDate"> & { sessionDate: string | Date };

export function ultimoRegistro(logs: Log[], nome: string | undefined): { session: Log; entry: Feito } | null {
  if (!nome) return null;
  for (const s of logs) {
    const e = s.exercisesDone.find((x) => x.name === nome);
    if (e) return { session: s, entry: e as Feito };
  }
  return null;
}

export type SerieVista = { weight: number | null; reps: number | string | null };

/** Séries registradas: set_logs quando existe; senão sets_done com a carga de load_used. Nada inventado. */
export function seriesRegistradas(entry: Feito | null | undefined): SerieVista[] {
  if (!entry) return [];
  if (entry.set_logs && entry.set_logs.length > 0) return entry.set_logs.map((s) => ({ weight: s.weight, reps: s.reps }));
  if (!entry.sets_done) return [];
  const m = String(entry.load_used ?? "").match(/(\d+(?:[.,]\d+)?)/);
  const w = m?.[1] ? Number(m[1].replace(",", ".")) : NaN;
  return Array.from({ length: entry.sets_done }, () => ({
    weight: Number.isFinite(w) ? w : null,
    reps: entry.reps_done ?? null,
  }));
}

export function intensidadeUsada(logs: Log[], nome: string | undefined): number | null {
  if (!nome) return null;
  for (const s of logs) {
    const e = s.exercisesDone.find((x) => x.name === nome);
    if (e?.intensity_used != null) return e.intensity_used;
  }
  return null;
}

export function concluido(logs: Log[], nome: string | undefined): boolean {
  if (!nome) return false;
  return logs.some((s) => s.exercisesDone.some((e) => e.name === nome && e.completed !== false));
}

export function seriesFeitas(logs: Log[], nome: string | undefined): number | null {
  const r = ultimoRegistro(logs, nome);
  if (!r) return null;
  return r.entry.set_logs?.length ?? r.entry.sets_done ?? null;
}

// ── Impressão ──

/** 'YYYY-MM-DD' formata direto (new Date() parsearia em UTC e voltaria um dia). */
export function dataBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return new Date(d).toLocaleDateString("pt-BR");
}

export function idade(birthDate: string | null | undefined, hoje = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = String(birthDate).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  let a = hoje.getFullYear() - y;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) a--;
  return a;
}

export const letraSessao = (i: number) => "ABCDEFGH"[i] ?? String(i + 1);

const ACAO: Record<string, string> = {
  isotonica: "Isotônica",
  isometrica: "Isométrica",
  auxotonico: "Auxotônico",
  isocinetica: "Isocinética",
};
export const ACOES_MUSCULARES = Object.entries(ACAO) as [string, string][];

export function fmtPausa(ex: PlanExercise): string {
  if (ex.rest_label) return ex.rest_label;
  const s = ex.rest_seconds;
  if (!s) return "-";
  return s % 60 === 0 ? `${s / 60}min` : `${s}s`;
}
export const fmtSeries = (ex: PlanExercise) => ex.series_label ?? (ex.sets != null ? String(ex.sets) : "-");
export function fmtIntensidade(ex: PlanExercise): string {
  const p = [ex.intensity, ex.load_guidance].map((x) => x?.trim()).filter(Boolean);
  return p.length > 0 ? p.join(" · ") : "-";
}
const DINAMICAS = new Set(["isotonica", "auxotonico", "isocinetica"]);
/** Sem cadência definida: dinâmico recebe o padrão "2/2"; isometria e sem ação ficam "-". */
export function fmtCadencia(ex: PlanExercise): string {
  const c = (ex.cadence || ex.tempo || "").trim();
  if (c) return c;
  return ex.muscle_action && DINAMICAS.has(ex.muscle_action) ? "2/2" : "-";
}
export const fmtAcao = (ex: PlanExercise) => (ex.muscle_action ? (ACAO[ex.muscle_action] ?? "-") : "-");

export function linhasForca(s: PlanSessionData): { ex: PlanExercise; tag?: string }[] {
  return [
    ...(s.warmup ?? []).map((ex) => ({ ex, tag: "aquecimento" })),
    ...(s.main ?? []).map((ex) => ({ ex })),
    ...(s.cooldown ?? []).map((ex) => ({ ex, tag: "volta à calma" })),
  ];
}

const OBJETIVOS: Record<string, string> = {
  emagrecimento: "emagrecimento",
  hipertrofia: "hipertrofia",
  forca: "ganho de força",
  condicionamento_cardiovascular: "condicionamento cardiovascular",
  qualidade_de_vida: "qualidade de vida e saúde geral",
  reabilitacao: "reabilitação",
  performance: "performance",
};
export function objetivoCapa(objective: string | undefined, goals: string[], summary: string | undefined): string {
  const g = goals.map((x) => OBJETIVOS[x] ?? x).join(", ");
  return objective || (g ? `Promover ${g} por meio do programa de treinamento prescrito.` : "") || summary || "—";
}

const OBJETIVO_CURTO: Record<string, string> = {
  emagrecimento: "Emagrecimento",
  hipertrofia: "Hipertrofia",
  forca: "Força",
  condicionamento_cardiovascular: "Cardio",
  qualidade_de_vida: "Saúde geral",
  reabilitacao: "Reabilitação",
  performance: "Performance",
};
export const objetivoCurto = (goals: string[]) => (goals[0] ? (OBJETIVO_CURTO[goals[0]] ?? goals[0]) : "Sem objetivo");

const ALTO_RISCO = ["cardiopatia", "avc", "dpoc", "insuficiência", "stent", "diabetes tipo 1"];
export const altoRisco = (c: string) => ALTO_RISCO.some((r) => c.toLowerCase().includes(r));

export const EQUIPAMENTOS: { value: string; label: string }[] = [
  { value: "body weight", label: "Peso corporal" },
  { value: "dumbbell", label: "Halteres" },
  { value: "barbell", label: "Barra" },
  { value: "band", label: "Elástico" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "cable", label: "Polia (cabo)" },
  { value: "leverage machine", label: "Máquinas" },
  { value: "smith machine", label: "Smith" },
  { value: "stability ball", label: "Bola suíça" },
  { value: "bench", label: "Banco" },
];

/** Ajusta o array de focos ao número de sessões, preservando o que já foi digitado. */
export const camposFoco = (focos: string[], n: number) => Array.from({ length: n }, (_, i) => focos[i] ?? "");

/** Motivo de não poder publicar, escrito (brief §2.6). Null = pode publicar. */
export function motivoBloqueio(status: string, criticas: number): string | null {
  if (status === "published") return "Já publicado. O aluno vê no app.";
  if (status === "archived") return "Arquivado. Reative pelo menu ⋯ para o aluno voltar a ver.";
  if (status !== "generated") return `Status "${statusLabel(status)}" não pode ser publicado.`;
  if (criticas > 0)
    return `${criticas} ${plural(criticas, "restrição crítica pendente", "restrições críticas pendentes")}. Troque o exercício afetado ou assuma a responsabilidade.`;
  return null;
}


export const FILTROS_STATUS = [
  ["todos", "Todos"],
  ["rascunho", "Rascunho"],
  ["gerando", "Gerando"],
  ["publicado", "Publicado"],
  ["arquivado", "Arquivado"],
  ["falhou", "Falhou"],
] as const;
export type FiltroStatus = (typeof FILTROS_STATUS)[number][0];

const DO_FILTRO: Record<Exclude<FiltroStatus, "todos">, (s: string) => boolean> = {
  rascunho: (s) => s === "generated",
  gerando: gerando,
  publicado: (s) => s === "published",
  arquivado: (s) => s === "archived",
  falhou: (s) => s === "failed",
};

/** Filtro da lista de treinos: status segmentado + busca por aluno ou título (sem acento). */
export function filtrarTreinos<T extends { status: string; studentName: string; title: string }>(
  planos: T[],
  status: string,
  busca: string,
): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(busca.trim());
  const f = DO_FILTRO[status as keyof typeof DO_FILTRO];
  return planos.filter((p) => (!f || f(p.status)) && (!q || norm(`${p.studentName} ${p.title}`).includes(q)));
}

/** Contagem por filtro, para os rótulos dos segmentos. */
export function contarPorFiltro(planos: { status: string }[]): Record<FiltroStatus, number> {
  const r = { todos: planos.length } as Record<FiltroStatus, number>;
  for (const [k, f] of Object.entries(DO_FILTRO)) r[k as FiltroStatus] = planos.filter((p) => f(p.status)).length;
  return r;
}

export const DIVISOES = [
  ["auto", "A IA decide"],
  ["fullbody", "Corpo inteiro"],
  ["ab", "A/B"],
  ["abc", "A/B/C"],
  ["ppl", "Empurrar / puxar / pernas"],
] as const;
export const NIVEIS = [
  ["auto", "Pelo perfil"],
  ["iniciante", "Iniciante"],
  ["intermediario", "Intermediário"],
  ["avancado", "Avançado"],
] as const;
export type ParametrosGeracao = { divisao: string; frequencia: number | null; nivel: string };

/**
 * A geração recebe só as observações em texto (o gerador não tem campos de
 * divisão/nível). Os parâmetros escolhidos viram linhas explícitas no fim das
 * observações; "A IA decide" não escreve nada.
 */
export function montarObservacoes(notas: string, p: ParametrosGeracao): string {
  const linhas: string[] = [];
  const div = DIVISOES.find(([k]) => k === p.divisao && k !== "auto");
  if (div) linhas.push(`Divisão do treino: ${div[1]}.`);
  if (p.frequencia) linhas.push(`Frequência: ${p.frequencia} sessões por semana.`);
  const niv = NIVEIS.find(([k]) => k === p.nivel && k !== "auto");
  if (niv) linhas.push(`Nível de treinamento: ${niv[1]}.`);
  const corpo = notas.trim();
  if (linhas.length === 0) return corpo;
  return [corpo, `Parâmetros do profissional: ${linhas.join(" ")}`].filter(Boolean).join("\n\n");
}

export const LIMITE_OBSERVACOES = 2000;

// Lógica pura do domínio "rotina" (exercícios, agenda, mensagens). Sem React.

/* ────────── Exercícios ────────── */

/** Rótulos PT-BR das partes do corpo (o catálogo vem em EN). */
export const PARTE_DO_CORPO: Record<string, string> = {
  "upper arms": "Braços",
  "upper legs": "Coxas",
  back: "Costas",
  waist: "Core / Abdômen",
  chest: "Peito",
  shoulders: "Ombros",
  "lower legs": "Panturrilhas",
  "lower arms": "Antebraços",
  cardio: "Cardio",
  neck: "Pescoço",
};
export const parteDoCorpo = (v: string) => PARTE_DO_CORPO[v] ?? v;

export const DIFICULDADES = [
  { id: "beginner", label: "Iniciante" },
  { id: "intermediate", label: "Intermediário" },
  { id: "advanced", label: "Avançado" },
] as const;
export const dificuldade = (v: string | null) => DIFICULDADES.find((d) => d.id === v)?.label ?? v ?? "";

export const GRUPOS = ["Membros inferiores", "Posterior", "Peito", "Costas", "Ombros", "Braços", "Core", "Mobilidade", "Cardio"];
export const EQUIPAMENTOS = ["Barra", "Halter", "Máquina", "Polia", "Peso corporal", "Solo", "Kettlebell", "TRX", "Esteira", "Bike"];
export const NIVEIS = [
  { id: "iniciante", label: "Iniciante" },
  { id: "intermediario", label: "Intermediário" },
  { id: "avancado", label: "Avançado" },
] as const;
export const PADROES = ["Squat", "Hinge", "Push", "Pull", "Lunge", "Carry", "Rotation", "Anti-ext", "Anti-rot", "Isolado", "Mob"];

/** O catálogo tem GIF pesado (~1.7MB); a lista usa o 1º frame em JPG (~30KB). */
export const posterDoVideo = (url: string) => url.replace(/\.gif$/, ".jpg");

/** "a, b; c\nd" → ["a","b","c","d"]. Mesmo split das actions do SvelteKit. */
export function parseContraindicacoes(s: string): string[] {
  return s
    .split(/[,\n;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export type FiltroMeus = { grupo: string; equipamento: string; busca: string };
type ExercicioFiltravel = { name: string; muscleGroup: string; equipment: string | null; pattern: string | null };

/** Busca casa nome, padrão e equipamento (o placeholder promete os três). */
export function filtrarMeus<T extends ExercicioFiltravel>(lista: T[], f: FiltroMeus): T[] {
  const q = f.busca.trim().toLocaleLowerCase("pt-BR");
  return lista.filter(
    (x) =>
      (!f.grupo || x.muscleGroup === f.grupo) &&
      (!f.equipamento || x.equipment === f.equipamento) &&
      (!q || [x.name, x.pattern, x.equipment].some((v) => v?.toLocaleLowerCase("pt-BR").includes(q))),
  );
}

export const valoresUnicos = (xs: (string | null | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is string => Boolean(x))));

/** Parâmetros do catálogo: troca de filtro volta pra página 1. */
export function aplicarFiltro(atual: URLSearchParams, patch: Record<string, string>): URLSearchParams {
  const u = new URLSearchParams(atual);
  for (const [k, v] of Object.entries(patch)) {
    if (v) u.set(k, v);
    else u.delete(k);
  }
  if (!("page" in patch)) u.delete("page");
  return u;
}

/* ────────── Agenda ────────── */

export type TipoSessao = "treino" | "avaliacao" | "reabilitacao" | "consulta";
export type StatusSessao = "scheduled" | "completed" | "cancelled";

/** Tom de cada tipo, só com tokens. As classes ficam completas para o Tailwind achar. */
export const TIPOS: { id: TipoSessao; label: string; borda: string; texto: string; ponto: string }[] = [
  { id: "treino", label: "Treino", borda: "border-brand", texto: "text-brand", ponto: "bg-brand" },
  { id: "avaliacao", label: "Avaliação", borda: "border-info", texto: "text-info", ponto: "bg-info" },
  { id: "reabilitacao", label: "Reabilitação", borda: "border-warning", texto: "text-warning", ponto: "bg-warning" },
  { id: "consulta", label: "Consulta", borda: "border-ink-soft", texto: "text-ink-soft", ponto: "bg-ink-soft" },
];
export const tipo = (t: string) => TIPOS.find((x) => x.id === t) ?? TIPOS[0]!;

export const STATUS: { id: StatusSessao; label: string }[] = [
  { id: "scheduled", label: "Agendada" },
  { id: "completed", label: "Concluída" },
  { id: "cancelled", label: "Cancelada" },
];

export type SessaoAgenda = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  type: string;
  status: string;
  label: string | null;
  studentName: string | null;
};

/** 7 dias a partir da segunda (em horário local do navegador). */
export function diasDaSemana(inicio: string | Date): Date[] {
  const base = new Date(inicio);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

export const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Faixa de horas da grade: 07–19h, expandida para cobrir sessões fora dela. */
export function faixaDeHoras(sessoes: Pick<SessaoAgenda, "startsAt" | "durationMinutes">[]): number[] {
  let min = 7;
  let max = 19;
  for (const a of sessoes) {
    const d = new Date(a.startsAt);
    const ini = d.getHours();
    const fim = Math.min(23, Math.ceil(ini + d.getMinutes() / 60 + a.durationMinutes / 60) - 1);
    if (ini < min) min = ini;
    if (fim > max) max = fim;
  }
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * Sessões de um dia com coluna/colunas para sobreposição lado a lado
 * (empilhadas, a de baixo sumia e ficava inclicável).
 */
export function sessoesDoDia<T extends SessaoAgenda>(sessoes: T[], dia: Date): (T & { col: number; cols: number })[] {
  const evs = sessoes
    .filter((a) => mesmoDia(new Date(a.startsAt), dia))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .map((a) => ({ ...a, col: 0, cols: 1 }));
  let grupo: typeof evs = [];
  let fimGrupo = -Infinity;
  const fechar = () => {
    const n = Math.max(...grupo.map((c) => c.col)) + 1;
    for (const c of grupo) c.cols = n;
  };
  for (const ev of evs) {
    const ini = +new Date(ev.startsAt);
    const fim = ini + ev.durationMinutes * 60000;
    if (grupo.length && ini >= fimGrupo) {
      fechar();
      grupo = [];
      fimGrupo = -Infinity;
    }
    const usadas = new Set(
      grupo.filter((c) => +new Date(c.startsAt) + c.durationMinutes * 60000 > ini).map((c) => c.col),
    );
    let col = 0;
    while (usadas.has(col)) col++;
    ev.col = col;
    grupo.push(ev);
    fimGrupo = Math.max(fimGrupo, fim);
  }
  if (grupo.length) fechar();
  return evs;
}

/** Resumo da semana. Canceladas ficam fora das contagens. */
export function resumoDaSemana(sessoes: Pick<SessaoAgenda, "type" | "status">[]) {
  const ativas = sessoes.filter((a) => a.status !== "cancelled");
  return {
    total: ativas.length,
    porTipo: TIPOS.map((t) => ({ ...t, n: ativas.filter((a) => a.type === t.id).length })),
    canceladas: sessoes.length - ativas.length,
  };
}

/** Data e hora locais (do navegador) para os inputs date/time. en-CA = AAAA-MM-DD. */
export function paraInputs(iso: string | Date): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-CA"),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function duracaoValida(n: number): boolean {
  return Number.isInteger(n) && n >= 15 && n <= 240;
}

/* ────────── Mensagens ────────── */

/** "14:32" hoje, "ontem", "3d", ou "12 out". */
export function horaCurta(d: string | Date | null, agora: Date = new Date()): string {
  if (!d) return "—";
  const x = new Date(d);
  if (mesmoDia(x, agora)) return x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dias = Math.floor((agora.getTime() - x.getTime()) / 86_400_000);
  if (dias < 2) return "ontem";
  if (dias < 7) return `${dias}d`;
  return x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

type ConversaFiltravel = { studentName: string; unread: number };
export function filtrarConversas<T extends ConversaFiltravel>(lista: T[], busca: string, soNaoLidas: boolean): T[] {
  const q = busca.trim().toLocaleLowerCase("pt-BR");
  return lista.filter(
    (t) => (!q || t.studentName.toLocaleLowerCase("pt-BR").includes(q)) && (!soNaoLidas || t.unread > 0),
  );
}

export const RESPOSTAS_RAPIDAS = ["Bora aumentar 10%", "Mantém a carga", "Vou ajustar o plano", "Manda vídeo"];

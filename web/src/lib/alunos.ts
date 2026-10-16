// Lógica pura do domínio "alunos" (lista, cadastro, ficha). Sem React, sem fetch.
import type { StatusTone } from "@/components/ui/status-chip";

/** O que a API devolve depois do JSON: Date vira string ISO. */
export type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

export const OBJETIVOS = [
  { id: "emagrecimento", label: "Emagrecimento" },
  { id: "hipertrofia", label: "Hipertrofia" },
  { id: "forca", label: "Força" },
  { id: "condicionamento_cardiovascular", label: "Cardio" },
  { id: "qualidade_de_vida", label: "Saúde geral" },
  { id: "reabilitacao", label: "Reabilitação" },
  { id: "performance", label: "Performance" },
] as const;

export function rotuloObjetivo(id: string): string {
  return OBJETIVOS.find((o) => o.id === id)?.label ?? id;
}

export type Risco = "baixo" | "moderado" | "alto" | "muito_alto";
export const RISCOS: { id: Risco; label: string; tone: StatusTone }[] = [
  { id: "baixo", label: "Baixo", tone: "positive" },
  { id: "moderado", label: "Moderado", tone: "warning" },
  { id: "alto", label: "Alto", tone: "negative" },
  { id: "muito_alto", label: "Muito alto", tone: "negative" },
];
export function metaRisco(r: string | null | undefined) {
  return RISCOS.find((x) => x.id === r) ?? RISCOS[0]!;
}

export const SEXOS = [
  { id: "nao_informado", label: "Não informado" },
  { id: "feminino", label: "Feminino" },
  { id: "masculino", label: "Masculino" },
  { id: "outro", label: "Outro" },
] as const;
export function rotuloSexo(s: string): string {
  return SEXOS.find((x) => x.id === s)?.label ?? s;
}

export const EXPERIENCIAS = [
  { id: "iniciante", label: "Iniciante" },
  { id: "intermediario", label: "Intermediário" },
  { id: "avancado", label: "Avançado" },
] as const;
export const DIFICULDADES = [
  { id: "pequena", label: "Pequena" },
  { id: "media", label: "Média" },
  { id: "alta", label: "Alta" },
] as const;
export const ESTRUTURAS = [
  { id: "auto", label: "Automática (IA decide pela frequência)" },
  { id: "full_body", label: "Full-body (todos os grupos em cada sessão)" },
  { id: "upper_lower", label: "Upper/Lower (alterna superior e inferior)" },
  { id: "push_pull_legs", label: "Push/Pull/Legs" },
] as const;

/* ────────── Lista ────────── */

export type FiltroStatus = "all" | "active" | "paused";
type AlunoFiltravel = { name: string; status: "active" | "paused"; goal: string | null };

/** Sem acento e minúsculo: "Cláudia" casa com "claudia". */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function filtrarAlunos<T extends AlunoFiltravel>(
  lista: T[],
  f: { status: FiltroStatus; objetivo: string; busca: string },
): T[] {
  const q = normalizar(f.busca);
  return lista.filter(
    (s) =>
      (f.status === "all" || s.status === f.status) &&
      (f.objetivo === "all" || s.goal === f.objetivo) &&
      (!q || normalizar(s.name).includes(q)),
  );
}

export function objetivosDisponiveis(lista: { goal: string | null }[]): string[] {
  return Array.from(new Set(lista.map((s) => s.goal).filter((x): x is string => !!x)));
}

export function tomAderencia(a: number): "positive" | "warning" | "negative" {
  if (a >= 85) return "positive";
  if (a >= 70) return "warning";
  return "negative";
}

/* ────────── Medidas ────────── */

/** Idade completa em anos numa data de referência. */
export function idade(nascimento: string | null | undefined, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const m = nascimento.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let a = hoje.getFullYear() - y;
  const dm = hoje.getMonth() + 1 - mo;
  if (dm < 0 || (dm === 0 && hoje.getDate() < d)) a--;
  return a >= 0 ? a : null;
}

/** "72,5" → 72.5; vazio ou inválido → null. Espelha parseDecimalBR do servidor. */
export function decimalBR(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s/g, "");
  if (!s) return null;
  const n = Number(/,\d+$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function imc(pesoKg: number | null | undefined, alturaCm: number | null | undefined): number | null {
  if (!pesoKg || !alturaCm) return null;
  return Math.round((pesoKg / Math.pow(alturaCm / 100, 2)) * 10) / 10;
}

export function categoriaImc(v: number | null): { label: string; tone: StatusTone } {
  if (v == null) return { label: "—", tone: "neutral" };
  if (v < 18.5) return { label: "baixo peso", tone: "negative" };
  if (v < 25) return { label: "normal", tone: "positive" };
  if (v < 30) return { label: "sobrepeso", tone: "warning" };
  return { label: "obeso", tone: "negative" };
}

/** Variação do peso na série (primeira → última). */
export function tendenciaPeso(pesos: number[]): { delta: number; sentido: "sobe" | "desce" | "estavel" } | null {
  if (pesos.length < 2) return null;
  const delta = Math.round((pesos[pesos.length - 1]! - pesos[0]!) * 10) / 10;
  return { delta, sentido: delta < 0 ? "desce" : delta > 0 ? "sobe" : "estavel" };
}

/* ────────── Ficha ────────── */

const CHAVES_ALTO_RISCO = ["cardiopatia", "avc", "dpoc", "diabetes tipo 1", "stent", "insuficiência"];
export function condicaoDeRisco(diagnostico: string): boolean {
  const d = diagnostico.toLowerCase();
  return CHAVES_ALTO_RISCO.some((r) => d.includes(r));
}

/** Rótulo do plano pelo status real: gerando ou falho não pode aparecer como "Encerrado". */
export function chipPlano(p: { isActive: boolean; status: string }): { label: string; tone: StatusTone } {
  if (p.isActive) return { label: "Ativo", tone: "brand" };
  if (p.status === "pending" || p.status === "generating") return { label: "Gerando…", tone: "warning" };
  if (p.status === "failed") return { label: "Falhou", tone: "negative" };
  return { label: "Encerrado", tone: "neutral" };
}

export function tomPse(pse: number | null): StatusTone {
  if (pse == null) return "neutral";
  return pse >= 9 ? "negative" : pse >= 7 ? "warning" : "positive";
}

type Saude = { injuries?: unknown; contraindications?: unknown } | null | undefined;
/** Lesões (injuries) ou, se não houver, contraindicações antigas. */
export function limitacoes(hp: Saude): string[] {
  const inj = hp?.injuries as { region: string; notes?: string }[] | null | undefined;
  if (Array.isArray(inj)) return inj.map((i) => i.region + (i.notes ? " · " + i.notes : ""));
  const ci = hp?.contraindications as { exercise_pattern: string; reason: string }[] | null | undefined;
  if (Array.isArray(ci)) return ci.map((c) => c.exercise_pattern + " · " + c.reason);
  return [];
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function textoDoLink(nome: string, url: string): string {
  return `Olá ${primeiroNome(nome)}, esse é o link do seu app de treinos. Sem login — clique e já abre:\n${url}`;
}

/**
 * wa.me exige formato internacional: 10–11 dígitos é número BR (DDD + número) e
 * ganha 55. Decide pelo tamanho, não por startsWith('55'), para não quebrar o DDD 55 (RS).
 */
export function linkWhatsapp(telefone: string | null | undefined, texto: string): string {
  const t = encodeURIComponent(texto);
  if (!telefone) return `https://wa.me/?text=${t}`;
  const d = telefone.replace(/\D/g, "");
  const num = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return `https://wa.me/${num}?text=${t}`;
}

export function linkEmail(email: string | null | undefined, texto: string): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent("Seu app de treinos — PreceptorFISIC")}&body=${encodeURIComponent(texto)}`;
}

/* ────────── Formulário (cadastro e edição) ────────── */

export type FormAluno = {
  name: string;
  birthDate: string;
  sex: string;
  weightKg: string;
  heightCm: string;
  phone: string;
  email: string;
  cardiovascularRisk: Risco;
  diagnoses: string;
  medications: string;
  limitations: string;
  goals: string[];
  weeklySessions: string;
  minutesPerSession: string;
  experienceLevel: string;
  prescribedDifficulty: string;
  trainingSplit: string;
};

export const FORM_VAZIO: FormAluno = {
  name: "",
  birthDate: "",
  sex: "nao_informado",
  weightKg: "",
  heightCm: "",
  phone: "",
  email: "",
  cardiovascularRisk: "baixo",
  diagnoses: "",
  medications: "",
  limitations: "",
  goals: [],
  weeklySessions: "3",
  minutesPerSession: "60",
  experienceLevel: "iniciante",
  prescribedDifficulty: "media",
  trainingSplit: "auto",
};

type Lista<K extends string> = { [P in K]: string }[] | null | undefined;
const juntar = <K extends string>(l: unknown, k: K) =>
  Array.isArray(l) ? (l as Lista<K> & object).map((x) => x[k]).join(", ") : "";

/**
 * Valores iniciais da edição. Só a chave de identidade vai para o texto: os
 * campos ricos (dose, severidade, notas) ficam no jsonb e o servidor preserva no merge.
 */
export function formDoAluno(d: {
  student: { name: string; birthDate: string | null; sex: string; weightKg: number | null; heightCm: number | null; phone: string | null; email: string | null };
  healthProfile: { cardiovascularRisk?: string | null; diagnoses?: unknown; medications?: unknown; injuries?: unknown } | null;
  preferences: { goals?: unknown; weeklySessions?: number | null; minutesPerSession?: number | null; experienceLevel?: string | null; prescribedDifficulty?: string | null; trainingSplit?: string | null } | null;
}): FormAluno {
  const s = d.student;
  const hp = d.healthProfile;
  const p = d.preferences;
  return {
    name: s.name,
    birthDate: s.birthDate ?? "",
    sex: s.sex,
    weightKg: s.weightKg != null ? String(s.weightKg).replace(".", ",") : "",
    heightCm: s.heightCm != null ? String(s.heightCm).replace(".", ",") : "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    cardiovascularRisk: metaRisco(hp?.cardiovascularRisk).id,
    diagnoses: juntar(hp?.diagnoses, "label"),
    medications: juntar(hp?.medications, "name"),
    limitations: juntar(hp?.injuries, "region"),
    goals: Array.isArray(p?.goals) ? (p.goals as string[]) : [],
    weeklySessions: String(p?.weeklySessions ?? 3),
    minutesPerSession: String(p?.minutesPerSession ?? 60),
    experienceLevel: p?.experienceLevel ?? "iniciante",
    prescribedDifficulty: p?.prescribedDifficulty ?? "media",
    trainingSplit: p?.trainingSplit ?? "auto",
  };
}

/** Corpo JSON para POST/PUT /alunos: números inteiros viram number, o resto vai como texto. */
export function payloadDoForm(f: FormAluno) {
  return {
    ...f,
    name: f.name.trim(),
    email: f.email.trim(),
    weeklySessions: Number(f.weeklySessions),
    minutesPerSession: Number(f.minutesPerSession),
  };
}

export function alternar<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
}

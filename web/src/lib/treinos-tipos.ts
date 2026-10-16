// Formatos JSON das respostas de /api/treinos/* (datas chegam como string).
import type {
  CatalogMap,
  PlanData,
  PlanListItem,
  PlanSessionData,
  SessionLogEntry,
  SourceMap,
} from "$lib/server/queries";

type Json<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] extends Date ? string : string | null };

export type PlanoItem = Json<PlanListItem, "createdAt" | "publishedAt">;

export type PlanoDetalhe = {
  id: string;
  studentName: string;
  studentId: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  publishedAt: string | null;
  planData: PlanData;
  sourceMap: SourceMap;
  catalogMap: CatalogMap;
};

export type Validacao = { violations: number; bySeverity: Record<string, number>; rules: string[] };

export type StatusGeracao = {
  id: string;
  status: string;
  progress: number;
  phase: string | null;
  error: string | null;
  generated: boolean;
  failed: boolean;
  partial: PlanData | null;
};

export type ItemCatalogo = {
  id: string;
  externalId: string;
  name: string;
  bodyPart: string;
  targetMuscle: string;
  equipment: string | null;
  difficulty: string | null;
  hasVideo: boolean;
};

export type SessaoResposta = {
  plan: { id: string; studentId: string; studentName: string; sourceMap: SourceMap };
  session: PlanSessionData;
  idx: number;
  recentLogs: (Omit<SessionLogEntry, "sessionDate"> & { sessionDate: string })[];
  videoMap: Record<string, string>;
};

export type ImpressaoResposta = {
  plan: PlanoDetalhe;
  professional: { name: string; specialty: string | null; cref: string | null };
  student: { name: string; birthDate: string | null } | null;
  goals: string[];
};

export type PrescricaoResposta = {
  cota: { usado: number; limite: number | null } | null;
  student: { id: string; name: string; birthDate: string | null };
  diagnoses: string[];
  medications: string[];
  limitations: string[];
  goals: string[];
  equipment: string[];
  weeklySessions: number | null;
  minutesPerSession: number | null;
};

export const chaves = {
  lista: ["treinos"] as const,
  plano: (id: string) => ["treino", id] as const,
  status: (id: string) => ["treino", id, "status"] as const,
  sessao: (id: string, idx: string) => ["treino", id, "sessao", idx] as const,
  impressao: (id: string) => ["treino", id, "imprimir"] as const,
  prescricao: (alunoId: string) => ["aluno", alunoId, "prescricao"] as const,
};

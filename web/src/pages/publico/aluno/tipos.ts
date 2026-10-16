import type { PlanData, PlanSessionData } from "$lib/server/queries";
import type { AlunoVideoMap } from "$lib/server/aluno-app";

export type InicioAluno = {
  student: { id: string; name: string; weightKg: number | null; heightCm: number | null };
  professional: { name: string; cref: string | null };
  plan: { id: string; planData: PlanData } | null;
  streakDays: number;
  sessionsThisWeek: number;
  weeklyTarget: number;
  videoByCatalogId: Record<string, string>;
  unreadMessages: number;
};

export type TreinoAluno = {
  student: { id: string; name: string };
  sessionIdx: number;
  session: PlanSessionData;
  videoMap: AlunoVideoMap;
};

export type MensagemAluno = { id: string; fromRole: "student" | "professional"; body: string; createdAt: string };
export type ConversaAluno = { professionalName: string; messages: MensagemAluno[] };

export type HistoricoAluno = {
  student: { id: string; name: string };
  total: number;
  sessions: {
    id: string;
    sessionDate: string;
    sessionLabel: string | null;
    perceivedEffort: number | null;
    observations: string | null;
    exercisesDone: { completed?: boolean }[] | null;
  }[];
};

export type CadastroAluno = {
  student: { id: string; name: string; birthDate: string | null; profileCompletedAt: string | null };
  professional: { name: string };
  healthProfile: {
    diagnoses?: { label: string }[] | null;
    medications?: { name: string }[] | null;
    injuries?: { region: string; notes?: string }[] | null;
    cardiovascularRisk?: string | null;
  } | null;
  preferences: {
    goals?: string[] | null;
    weeklySessions?: number | null;
    minutesPerSession?: number | null;
    experienceLevel?: string | null;
    prescribedDifficulty?: string | null;
  } | null;
};

/** Chaves do React Query do app do aluno. */
export const chaveAluno = (id: string) => ["aluno-app", id] as const;
export const chaveTreino = (id: string, idx: number) => ["aluno-app", id, "treino", idx] as const;
export const chaveHistorico = (id: string) => ["aluno-app", id, "historico"] as const;
export const chaveMensagens = (id: string) => ["aluno-app", id, "mensagens"] as const;
export const chaveCadastro = (id: string) => ["aluno-app", id, "completar"] as const;

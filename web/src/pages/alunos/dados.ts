// Contrato com server/routes/alunos.ts: tipos das respostas e chaves do React Query.
import type { LoadEvolution, RecentSession, StudentDetail, StudentListItem } from "$lib/server/queries";
import type { Json } from "@/lib/alunos";

export const CHAVE_ALUNOS = ["alunos"] as const;
export const CHAVE_EQUIPE = ["alunos", "equipe"] as const;
export const chaveAluno = (id: string) => ["aluno", id] as const;

export type RespostaLista = { students: StudentListItem[] };
export type RespostaEquipe = { equipe: { id: string; name: string }[]; euId: string };

type PlanoComStatus = StudentDetail["plans"][number] & { status: string };
export type Ficha = Json<{
  detail: Omit<StudentDetail, "plans"> & { plans: PlanoComStatus[] };
  alunoUrl: string;
  fillUrl: string;
  loadEvolution: LoadEvolution;
  recentSessions: RecentSession[];
}>;
export type DetalheAluno = Ficha["detail"];

export type RespostaCadastro =
  | { mode: "completo"; id: string }
  | { mode: "link"; id: string; fillUrl: string; studentName: string };

/**
 * Jornada do aluno: a linha de trabalho do profissional (guia de uso).
 * Regra pura: dado o estado, qual etapa é a atual e qual é o próximo passo.
 */
export type Etapa = "cadastro" | "avaliacao" | "risco" | "plano" | "revisao" | "publicado";

export const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "cadastro", label: "Cadastro" },
  { id: "avaliacao", label: "Avaliação" },
  { id: "risco", label: "Risco CV" },
  { id: "plano", label: "Plano" },
  { id: "revisao", label: "Revisão" },
  { id: "publicado", label: "Publicado" },
];

export type EstadoJornada = {
  alunoId: string;
  /** Perfil clínico preenchido (pelo profissional ou pelo aluno via link). */
  cadastroCompleto: boolean;
  avaliacoes: number;
  riscoDefinido: boolean;
  /** Plano mais recente (qualquer status) ou null. */
  plano: { id: string; status: "pending" | "generating" | "generated" | "published" | "archived" | "failed"; restricoesVermelhasAbertas: number } | null;
};

export type ProximoPasso = { etapa: Etapa; label: string; href: string; detalhe?: string };

export function etapaAtual(e: EstadoJornada): Etapa {
  return proximoPasso(e).etapa;
}

export function proximoPasso(e: EstadoJornada): ProximoPasso {
  const base = `/alunos/${e.alunoId}`;
  if (!e.cadastroCompleto) return { etapa: "cadastro", label: "Completar perfil clínico", href: `${base}/editar` };
  if (e.avaliacoes === 0) return { etapa: "avaliacao", label: "Registrar avaliação", href: `${base}?aba=avaliacoes&nova=1` };
  if (!e.riscoDefinido) return { etapa: "risco", label: "Definir risco cardiovascular", href: `${base}?aba=clinico` };
  const p = e.plano;
  if (!p || p.status === "archived" || p.status === "failed") {
    return {
      etapa: "plano",
      label: "Gerar plano",
      href: `${base}/gerar`,
      detalhe: p?.status === "failed" ? "A última geração falhou." : undefined,
    };
  }
  if (p.status === "pending" || p.status === "generating") return { etapa: "plano", label: "Acompanhar geração", href: `/treinos/${p.id}` };
  if (p.status === "generated") {
    const n = p.restricoesVermelhasAbertas;
    return n > 0
      ? { etapa: "revisao", label: `Revisar ${n} ${n === 1 ? "restrição" : "restrições"}`, href: `/treinos/${p.id}` }
      : { etapa: "revisao", label: "Revisar e publicar", href: `/treinos/${p.id}` };
  }
  return { etapa: "publicado", label: "Ver plano em vigor", href: `/treinos/${p.id}` };
}

/** Índice para o stepper: etapas antes da atual estão concluídas. */
export function indiceEtapa(etapa: Etapa): number {
  return ETAPAS.findIndex((x) => x.id === etapa);
}

// Chaves do React Query do domínio "rotina". Num arquivo só para as telas
// (carregadas por lazy) invalidarem umas às outras sem importar a tela inteira.
export const CHAVE_CATALOGO = ["exercicios", "catalogo"] as const;
export const CHAVE_MEUS_EXERCICIOS = ["exercicios", "meus"] as const;
export const chaveExercicio = (id: string) => ["exercicio", id] as const;

export const CHAVE_AGENDA = ["agenda"] as const;
export const CHAVE_ALUNOS_AGENDA = ["agenda", "alunos"] as const;
export const chaveSessao = (id: string) => ["sessao-agenda", id] as const;

export const CHAVE_CONVERSAS = ["mensagens"] as const;
export const chaveConversa = (id: string) => ["mensagens", id] as const;

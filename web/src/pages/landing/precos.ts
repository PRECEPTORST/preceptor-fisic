/**
 * Tabela de preços da landing. Espelha PAYMENT_LINKS (src/lib/server/asaas.ts)
 * e PLAN_LIMITS (src/lib/server/subscription.ts): mudou lá, muda aqui (o teste
 * ao lado confere os valores contra os dois).
 */
export type Ciclo = "mensal" | "anual";
export type ChavePlano = "basico" | "essencial" | "pro" | "institucional";

export type Plano = {
  chave: ChavePlano;
  nome: string;
  resumo: string;
  /** Centavos. Institucional: "a partir de". */
  mensal: number;
  /** Centavos. null = anual negociado (Institucional). */
  anual: number | null;
  alunos: number | null;
  treinos: number;
  itens: string[];
};

export const TESTE = { dias: 7, treinos: 2, alunos: 10 } as const;

export const WHATS_NUMERO = "553591481514";
export const whatsLink = (texto: string) => `https://wa.me/${WHATS_NUMERO}?text=${encodeURIComponent(texto)}`;
export const WHATS_HUMANO = whatsLink("Olá! Quero falar com alguém do time do PreceptorFISIC.");
export const WHATS_INSTITUCIONAL = whatsLink("Olá! Tenho interesse no plano Institucional do PreceptorFISIC.");

export const PLANOS: Plano[] = [
  {
    chave: "basico",
    nome: "Básico",
    resumo: "Para quem está começando a atender populações especiais.",
    mensal: 3990,
    anual: 39900,
    alunos: 40,
    treinos: 8,
    itens: ["Diretrizes citadas em cada recomendação", "23 regras clínicas antes de publicar", "App do aluno no celular"],
  },
  {
    chave: "essencial",
    nome: "Essencial",
    resumo: "Para uma carteira de alunos já estabelecida.",
    mensal: 4990,
    anual: 49900,
    alunos: 60,
    treinos: 11,
    itens: ["Tudo do Básico", "Mais alunos e mais treinos por mês"],
  },
  {
    chave: "pro",
    nome: "Pro",
    resumo: "Para quem prescreve todos os dias.",
    mensal: 9990,
    anual: 99900,
    alunos: 150,
    treinos: 25,
    itens: ["Tudo do Essencial", "Auditoria completa das gerações", "Prioridade na geração"],
  },
  {
    chave: "institucional",
    nome: "Institucional",
    resumo: "Para clínicas e equipes.",
    mensal: 49990,
    anual: null,
    alunos: null,
    treinos: 100,
    itens: ["Até 5 profissionais", "100 gerações por equipe", "Onboarding dedicado"],
  },
];

const brl = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 3990 → "R$ 39,90" (espaço comum, igual em servidor e navegador). */
export function formatarCentavos(c: number): string {
  return `R$ ${brl.format(c / 100)}`;
}

/** Anual dividido por 12, arredondado em centavos. */
export function equivalenteMensal(anualCentavos: number): number {
  return Math.round(anualCentavos / 12);
}

export type PrecoExibido = {
  valor: string;
  periodo: string;
  aPartirDe: boolean;
  /** "equivale a R$ 33,25/mês" só no anual. */
  equivale?: string;
  /** Observação quando o anual não é autoatendimento. */
  nota?: string;
};

export function precoExibido(p: Plano, ciclo: Ciclo): PrecoExibido {
  const aPartirDe = p.chave === "institucional";
  if (ciclo === "anual" && p.anual != null) {
    return {
      valor: formatarCentavos(p.anual),
      periodo: "/ano",
      aPartirDe,
      equivale: `equivale a ${formatarCentavos(equivalenteMensal(p.anual))}/mês`,
    };
  }
  return {
    valor: formatarCentavos(p.mensal),
    periodo: "/mês",
    aPartirDe,
    nota: ciclo === "anual" && p.anual == null ? "Anual negociado pelo WhatsApp" : undefined,
  };
}

/** Destino do CTA de um card: cadastro que já leva à assinatura do plano escolhido. */
export function hrefCadastro(chave?: Exclude<ChavePlano, "institucional">, ciclo: Ciclo = "mensal"): string {
  if (!chave) return "/login?modo=cadastrar";
  const next = `/assinatura?plan=${chave}_${ciclo}`;
  return `/login?modo=cadastrar&next=${encodeURIComponent(next)}`;
}

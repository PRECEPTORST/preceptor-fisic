// Lógica pura do domínio "conta" (assinatura, onboarding, equipe, upgrade).

export type Especialidade =
  | "prescricao_clinica"
  | "treinamento_funcional"
  | "reabilitacao"
  | "musculacao"
  | "personal"
  | "pilates"
  | "outro";

export const ESPECIALIDADES: { id: Especialidade; label: string; sub: string }[] = [
  { id: "prescricao_clinica", label: "Prescrição clínica", sub: "Pop. especiais, comorbidades" },
  { id: "treinamento_funcional", label: "Funcional", sub: "Capacidade, movimento" },
  { id: "reabilitacao", label: "Reabilitação", sub: "Pós-cirúrgico, lesões" },
  { id: "musculacao", label: "Musculação", sub: "Hipertrofia, força" },
  { id: "personal", label: "Personal", sub: "Atendimento individual" },
  { id: "pilates", label: "Pilates", sub: "Solo, aparelho" },
  { id: "outro", label: "Outro", sub: "" },
];

export function especialidadeValida(v: string | null | undefined): v is Especialidade {
  return ESPECIALIDADES.some((e) => e.id === v);
}

/** Máscara do CPF enquanto digita. É conforto: o servidor normaliza e valida de novo. */
export function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

// ── Planos (mesma tabela do Svelte em /assinatura) ──

export type PlanoBase = "basico" | "essencial" | "pro";
export type Plano = {
  base: PlanoBase;
  nome: string;
  mensal: string;
  anual: string;
  desc: string;
  itens: string[];
  popular?: boolean;
};

export const PLANOS: Plano[] = [
  {
    base: "basico",
    nome: "Básico",
    mensal: "R$ 39,90",
    anual: "R$ 399,00",
    desc: "Para quem está começando a atender população especial.",
    itens: ["Até 40 alunos ativos", "Até 8 treinos por IA/mês", "Histórico completo de planos", "Suporte por e-mail"],
  },
  {
    base: "essencial",
    nome: "Essencial",
    mensal: "R$ 49,90",
    anual: "R$ 499,00",
    desc: "Para o profissional em crescimento.",
    itens: ["Até 60 alunos ativos", "Até 11 treinos por IA/mês", "Histórico completo de planos", "Suporte por e-mail"],
  },
  {
    base: "pro",
    nome: "Pro",
    mensal: "R$ 99,90",
    anual: "R$ 999,00",
    desc: "Para quem vive de prescrição clínica.",
    popular: true,
    itens: ["Até 150 alunos ativos", "Até 25 treinos por IA/mês", "Auditoria completa de cada plano", "Prioridade na geração"],
  },
];

export const CHAVES_PLANO = PLANOS.flatMap((p) => [`${p.base}_mensal`, `${p.base}_anual`]);

export function chavePlano(base: PlanoBase, anual: boolean): string {
  return `${base}_${anual ? "anual" : "mensal"}`;
}

/** Funil da LP: ?plan=pro_mensal já abre o passo de confirmar. Chave desconhecida é ignorada. */
export function planoDaUrl(param: string | null): { base: PlanoBase; anual: boolean } | null {
  if (!param || !CHAVES_PLANO.includes(param)) return null;
  const [base, ciclo] = param.split("_") as [PlanoBase, string];
  return { base, anual: ciclo === "anual" };
}

/** Rótulo humano do plano (espelha $lib/planos.planLabel). */
export function rotuloPlano(plano: string | null | undefined): string | null {
  if (!plano) return null;
  const base = plano.replace(/_legacy$/, "");
  if (base === "admin-test") return "Interno";
  if (base === "trial") return "Teste";
  if (base === "institucional") return "Institucional";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── WhatsApp do time ──

export const WHATSAPP_TIME = "553591481514";
export const linkWhatsapp = (texto: string) => `https://wa.me/${WHATSAPP_TIME}?text=${encodeURIComponent(texto)}`;

// ── Upgrade ──

/** Números do acervo que valem mostrar. Zero não entra: "0 planos" trabalha contra o argumento. */
export function numerosDoAcervo(a: { alunos: number; planos: number; publicados: number }) {
  return [
    { n: a.alunos, label: a.alunos === 1 ? "aluno" : "alunos" },
    { n: a.planos, label: a.planos === 1 ? "plano" : "planos" },
    { n: a.publicados, label: a.publicados === 1 ? "publicado" : "publicados" },
  ].filter((i) => i.n > 0);
}

// ── Equipe ──

export function usoDoPool(usadas: number, limite: number) {
  const restam = Math.max(0, limite - usadas);
  const pct = limite > 0 ? Math.min(100, Math.round((usadas / limite) * 100)) : 100;
  return { restam, pct };
}

/** Teto por profissional: vazio = sem teto; senão inteiro entre 1 e o limite. */
export function validarTeto(bruto: string, limite: number): { ok: true; cap: number | null } | { ok: false; erro: string } {
  const t = bruto.trim();
  if (t === "") return { ok: true, cap: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > limite)
    return { ok: false, erro: `O teto por profissional deve ficar entre 1 e ${limite}, ou vazio para não ter teto.` };
  return { ok: true, cap: n };
}

export const MOTIVO_CONVITE: Record<string, string> = {
  usado: "Esse convite já foi usado.",
  cancelado: "Esse convite foi cancelado pela clínica.",
  expirado: "Esse convite expirou. Peça um novo para a clínica.",
  ja_membro: "Sua conta já faz parte dessa clínica.",
  outra_clinica: "Sua conta já pertence a outra clínica. Saia dela antes de aceitar este convite.",
};

// ── Redefinir senha ──

/** Como o link de recovery chegou: token_hash (cross-device), code (PKCE) ou nada. */
export function tokenDeRecuperacao(params: URLSearchParams): { tipo: "hash"; valor: string } | { tipo: "code"; valor: string } | null {
  const hash = params.get("token_hash");
  if (hash && params.get("type") === "recovery") return { tipo: "hash", valor: hash };
  const code = params.get("code");
  if (code) return { tipo: "code", valor: code };
  return null;
}

export function erroDeSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < 8) return "Senha precisa ter pelo menos 8 caracteres.";
  if (senha !== confirmacao) return "As senhas não coincidem.";
  return null;
}

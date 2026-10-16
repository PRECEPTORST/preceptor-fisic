// Lógica pura do CRM (admin). Sem React, testada em crm.test.ts.
import type { LeadListItem, LeadSource, LeadStage } from "$lib/server/queries";
import type { StatusTone } from "@/components/ui/status-chip";

/** Lead como chega pela API (datas viram string no JSON). */
export type Lead = Omit<LeadListItem, "nextFollowUpAt" | "createdAt" | "updatedAt"> & {
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Contagens = Record<LeadStage, number>;

export const ESTAGIOS: { id: LeadStage; label: string; tom: StatusTone }[] = [
  { id: "visitante", label: "Visitante", tom: "neutral" },
  { id: "cadastrou", label: "Cadastrou", tom: "info" },
  { id: "ativou_aluno", label: "Ativou aluno", tom: "brand" },
  { id: "trial", label: "Trial", tom: "warning" },
  { id: "pagante", label: "Pagante", tom: "positive" },
  { id: "cancelado", label: "Cancelado", tom: "neutral" },
  { id: "perdido", label: "Perdido", tom: "negative" },
];

export const ORIGENS: { id: LeadSource; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "indicacao", label: "Indicação" },
  { id: "anuncio", label: "Anúncio" },
  { id: "site", label: "Site" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "outro", label: "Outro" },
];

/** Classe de preenchimento (barra) por tom; só tokens. */
export const TOM_BARRA: Record<StatusTone, string> = {
  neutral: "bg-ink-mute",
  brand: "bg-brand",
  warning: "bg-warning",
  positive: "bg-positive",
  negative: "bg-negative",
  info: "bg-info",
};

export function estagio(id: LeadStage) {
  return ESTAGIOS.find((e) => e.id === id) ?? ESTAGIOS[0]!;
}
export function origemLabel(id: LeadSource): string {
  return ORIGENS.find((o) => o.id === id)?.label ?? id;
}

const DIA = 86_400_000;

/** Follow-up vencido de lead vivo (cancelado/perdido não contam). */
export function atrasado(l: Pick<Lead, "nextFollowUpAt" | "stage">, agora = Date.now()): boolean {
  return Boolean(
    l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < agora && l.stage !== "cancelado" && l.stage !== "perdido",
  );
}

export function resumoPainel(leads: Lead[], counts: Contagens, agora = Date.now()) {
  const total = leads.length;
  const pagantes = counts.pagante;
  const atrasados = leads
    .filter((l) => atrasado(l, agora))
    .sort((a, b) => new Date(a.nextFollowUpAt!).getTime() - new Date(b.nextFollowUpAt!).getTime());
  const origens = ORIGENS.map((o) => ({ ...o, n: leads.filter((l) => l.source === o.id).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  return {
    total,
    pagantes,
    conversao: total > 0 ? Math.round((pagantes / total) * 100) : 0,
    novos7d: leads.filter((l) => agora - new Date(l.createdAt).getTime() < 7 * DIA).length,
    atrasados,
    estagioMax: Math.max(1, ...ESTAGIOS.map((e) => counts[e.id])),
    origens,
    origemMax: Math.max(1, ...origens.map((r) => r.n)),
    recentes: [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  };
}

export type Ordem = "createdAt" | "name" | "nextFollowUpAt";
export type Filtro = { busca: string; origem: LeadSource | "all"; estagio: LeadStage | "all"; ordem: Ordem };

export function filtrarLeads(leads: Lead[], f: Filtro): Lead[] {
  const q = f.busca.trim().toLowerCase();
  return leads
    .filter((l) => {
      if (f.estagio !== "all" && l.stage !== f.estagio) return false;
      if (f.origem !== "all" && l.source !== f.origem) return false;
      if (q && ![l.name, l.phone, l.email, l.notes].some((v) => (v ?? "").toLowerCase().includes(q))) return false;
      return true;
    })
    .sort((a, b) => {
      if (f.ordem === "name") return a.name.localeCompare(b.name, "pt-BR");
      // Follow-up: o mais urgente primeiro, sem data no fim. Criado: mais novo primeiro.
      if (f.ordem === "nextFollowUpAt") {
        const av = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
        const bv = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
        return av - bv;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function agruparPorEstagio(leads: Lead[]): { estagio: (typeof ESTAGIOS)[number]; leads: Lead[] }[] {
  return ESTAGIOS.map((e) => ({ estagio: e, leads: leads.filter((l) => l.stage === e.id) }));
}

export function leadsCsv(leads: Lead[]): string {
  const header = "nome,email,telefone,estagio,origem,follow_up,criado";
  const rows = leads.map((l) =>
    [
      l.name,
      l.email ?? "",
      l.phone ?? "",
      l.stage,
      l.source,
      l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString().slice(0, 10) : "",
      new Date(l.createdAt).toISOString().slice(0, 10),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

/** wa.me exige formato internacional: número BR local (10–11 dígitos) ganha 55. */
export function telefoneWa(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export function whatsappLinkSenha(link: string, fone: string): string {
  const msg =
    `Olá! Aqui é do PreceptorFISIC.\n\n` +
    `Segue o link para você criar uma nova senha e voltar a acessar sua conta:\n\n${link}\n\n` +
    `O link vale por uma hora e só pode ser usado uma vez. Qualquer coisa, é só chamar por aqui.`;
  return `https://wa.me/${telefoneWa(fone)}?text=${encodeURIComponent(msg)}`;
}

/**
 * Valor para <input type="datetime-local"> no horário de Brasília — o
 * servidor (parseLocalDateTime) interpreta o valor nesse fuso.
 */
export function paraDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ─── Contas ────────────────────────────────────────────────────────────────

export type SituacaoConta = { label: string; tom: StatusTone };

/** Dias restantes arredondando pra cima (mesma regra do contador do app). */
export function diasRestantes(expira: string | null, agora = Date.now()): number {
  if (!expira) return 0;
  const ms = new Date(expira).getTime() - agora;
  return ms <= 0 ? 0 : Math.ceil(ms / DIA);
}

export function situacaoConta(
  c: { subscriptionStatus: string; subscriptionExpiresAt: string | null },
  agora = Date.now(),
): SituacaoConta {
  const venceu = c.subscriptionExpiresAt ? new Date(c.subscriptionExpiresAt).getTime() < agora : true;
  const dias = diasRestantes(c.subscriptionExpiresAt, agora);
  if (c.subscriptionStatus === "active" && !venceu) return { label: "Ativa", tom: "positive" };
  if (c.subscriptionStatus === "trial" && !venceu)
    return { label: dias === 1 ? "Teste · 1 dia" : `Teste · ${dias} dias`, tom: dias <= 2 ? "warning" : "brand" };
  if (c.subscriptionStatus === "past_due") return { label: "Pendente", tom: "warning" };
  return { label: "Sem acesso", tom: "neutral" };
}

/** Franquia em uma linha; null = sem teto, escrito como "ilimitado". */
export function franquia(l: { students: number | null; generations: number | null }): string {
  const alunos = l.students == null ? "alunos ilimitados" : `${l.students} alunos`;
  const ger = l.generations == null ? "gerações ilimitadas" : `${l.generations} gerações/mês`;
  return `${alunos} · ${ger}`;
}

export function filtrarContas<T extends { name: string; email: string; cref: string | null }>(contas: T[], busca: string): T[] {
  const q = busca.trim().toLowerCase();
  if (!q) return contas;
  return contas.filter(
    (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.cref ?? "").toLowerCase().includes(q),
  );
}

// ─── Feedbacks ─────────────────────────────────────────────────────────────

export const CATEGORIA_FEEDBACK: Record<string, { label: string; tom: StatusTone }> = {
  bug: { label: "Bug / erro", tom: "negative" },
  sugestao: { label: "Sugestão", tom: "brand" },
  duvida: { label: "Dúvida", tom: "info" },
  elogio: { label: "Elogio", tom: "positive" },
  outro: { label: "Outro", tom: "neutral" },
};

/** Quebra uma linha de markdown leve em trechos normais e **negrito** (renderizados como texto, sem HTML). */
export function trechosNegrito(linha: string): { texto: string; negrito: boolean }[] {
  const out: { texto: string; negrito: boolean }[] = [];
  const re = /\*\*([^*\n]+)\*\*/g;
  let ult = 0;
  for (const m of linha.matchAll(re)) {
    if (m.index! > ult) out.push({ texto: linha.slice(ult, m.index), negrito: false });
    out.push({ texto: m[1]!, negrito: true });
    ult = m.index! + m[0].length;
  }
  if (ult < linha.length) out.push({ texto: linha.slice(ult), negrito: false });
  return out;
}

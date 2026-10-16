// Prova que a API do CRM recusa não-admin em TODA rota, sem confiar no front.
// Roda no vitest da raiz (que resolve $lib e $env); o do web não resolve $lib.
import { beforeEach, describe, expect, it, vi } from "vitest";

const prof = vi.hoisted(() => ({ atual: { id: "p1", isAdmin: false } as { id: string; isAdmin: boolean } | null }));
const chamadas = vi.hoisted(() => ({ n: 0 }));

vi.mock("../../../web/node_modules/@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (t: string) =>
        t === "ok" ? { data: { user: { id: "u1", email: "u@x.com" } }, error: null } : { data: { user: null }, error: new Error("x") },
    },
  }),
}));

vi.mock("$lib/server/queries", () => {
  const conta = async () => {
    chamadas.n++;
    return [];
  };
  return {
    getProfessionalByAuthId: async () => prof.atual,
    getAllLeads: conta,
    getLeadCountsByStage: conta,
    getLeadById: conta,
    createLead: conta,
    updateLead: conta,
    updateLeadStage: conta,
    deleteLead: conta,
    getAllFeedback: conta,
  };
});
vi.mock("$lib/server/organization", () => ({ hasAccess: async () => true }));
vi.mock("$lib/server/tz", () => ({ parseLocalDateTime: () => null }));
vi.mock("$lib/server/crm", () => ({
  listarContasComFranquia: async () => {
    chamadas.n++;
    return [];
  },
  gerarLinkRecuperacao: async () => {
    chamadas.n++;
    return { ok: true, email: "a@a", resetUrl: "x" };
  },
  resumirFeedbacks: async () => {
    chamadas.n++;
    return { ok: true, summary: "", summarizedCount: 0 };
  },
}));

const { crm } = await import("../../../web/server/routes/crm");

const ROTAS: [string, string][] = [
  ["GET", "/crm"],
  ["POST", "/crm/leads"],
  ["GET", "/crm/leads/l1"],
  ["PUT", "/crm/leads/l1"],
  ["PATCH", "/crm/leads/l1/estagio"],
  ["DELETE", "/crm/leads/l1"],
  ["GET", "/crm/contas"],
  ["POST", "/crm/contas/link"],
  ["GET", "/crm/feedbacks"],
  ["POST", "/crm/feedbacks/resumo"],
];

function chamar(metodo: string, path: string, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const body = metodo === "GET" || metodo === "DELETE" ? undefined : JSON.stringify({ name: "X", stage: "trial", email: "a@a" });
  return crm.request(path, { method: metodo, headers, body });
}

beforeEach(() => {
  process.env.PUBLIC_SUPABASE_URL = "http://supa.test";
  process.env.PUBLIC_SUPABASE_ANON_KEY = "anon";
  chamadas.n = 0;
});

describe("API do CRM", () => {
  it("cobre todas as rotas registradas", () => {
    const registradas = new Set(crm.routes.map((r) => `${r.method} ${r.path}`));
    expect([...registradas].sort()).toEqual(ROTAS.map(([m, p]) => `${m} ${p.replace("l1", ":id")}`).sort());
  });

  it.each(ROTAS)("%s %s → 403 para não-admin, sem tocar no banco", async (m, p) => {
    prof.atual = { id: "p1", isAdmin: false };
    const res = await chamar(m, p, "ok");
    expect(res.status).toBe(403);
    expect(chamadas.n).toBe(0);
  });

  it.each(ROTAS)("%s %s → 401 sem sessão", async (m, p) => {
    const res = await chamar(m, p);
    expect(res.status).toBe(401);
  });

  it.each(ROTAS)("%s %s → passa para admin", async (m, p) => {
    prof.atual = { id: "p1", isAdmin: true };
    const res = await chamar(m, p, "ok");
    expect(res.status).toBeLessThan(400);
  });
});

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { checkStudentAccess, signWithSecret, verifyWithSecret } from "../../../src/lib/server/aluno-token-core";
import { LINK_INVALIDO, requireAluno, tokenDaRequisicao, type AlunoVars } from "./aluno-acesso";

// Mesma composição de verifyStudentAccess (aluno-token.ts), com o banco trocado
// por um Map de versões vigentes do link. HMAC e comparação são as reais.
const SECRET = "e".repeat(64);
const ID = "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b";
const OUTRO = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const versoes = new Map<string, number>();
const assinar = (id: string, v = 1) => signWithSecret(SECRET, id, v);
const verificar = (id: string, token: string | null) =>
  checkStudentAccess(id, token, async (x) => versoes.get(x), (x, t, v) => verifyWithSecret(SECRET, x, t, v));

let consultas = 0;
function app() {
  const r = new Hono<{ Variables: AlunoVars }>().basePath("/api");
  r.onError((err, c) => (err instanceof HTTPException ? c.json({ error: err.message }, err.status) : c.json({}, 500)));
  // Mesmo padrão de montagem de server/routes/publico.ts.
  r.use("/aluno/:id/*", requireAluno(verificar));
  r.use("/aluno/:id", requireAluno(verificar));
  r.get("/aluno/:id", (c) => c.json({ id: c.get("alunoId") }));
  r.get("/aluno/:id/historico", (c) => {
    consultas++;
    return c.json({ id: c.get("alunoId") });
  });
  r.post("/aluno/:id/mensagens", (c) => c.json({ ok: true }, 201));
  return r;
}

beforeEach(() => {
  versoes.clear();
  versoes.set(ID, 1);
  versoes.set(OUTRO, 1);
  consultas = 0;
});

const get = (path: string, token?: string) =>
  app().request(`/api/aluno/${ID}${path}`, { headers: token ? { "x-aluno-token": token } : {} });

describe("API do aluno: token do link", () => {
  it("token válido da versão vigente → 200", async () => {
    const res = await get("/historico", assinar(ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID });
  });

  it("aceita o token por ?t= e protege também a rota raiz", async () => {
    expect((await get(`/historico?t=${assinar(ID)}`)).status).toBe(200);
    expect((await get("", assinar(ID))).status).toBe(200);
    expect((await get("")).status).toBe(401);
  });

  it("sem token → 401 e o handler não roda", async () => {
    const res = await get("/historico");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: LINK_INVALIDO });
    expect(consultas).toBe(0);
  });

  it("token inválido → 401", async () => {
    expect((await get("/historico", "0".repeat(24))).status).toBe(401);
    expect((await get("/historico", assinar(ID).slice(0, 23))).status).toBe(401);
    expect(consultas).toBe(0);
  });

  it("token de versão antiga (link revogado) → 401; o novo passa", async () => {
    const antigo = assinar(ID, 1);
    versoes.set(ID, 2);
    expect((await get("/historico", antigo)).status).toBe(401);
    expect((await get("/historico", assinar(ID, 2))).status).toBe(200);
  });

  it("token de outro aluno → 401", async () => {
    expect((await get("/historico", assinar(OUTRO))).status).toBe(401);
  });

  it("aluno inexistente ou id malformado → 401", async () => {
    versoes.delete(ID);
    expect((await get("/historico", assinar(ID))).status).toBe(401);
    const res = await app().request(`/api/aluno/nao-e-uuid/historico`, { headers: { "x-aluno-token": assinar("nao-e-uuid") } });
    expect(res.status).toBe(401);
  });

  it("vale para escrita", async () => {
    const res = await app().request(`/api/aluno/${ID}/mensagens`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-aluno-token": "errado" },
      body: JSON.stringify({ body: "oi" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("tokenDaRequisicao", () => {
  it("prefere o header e ignora vazio", () => {
    expect(tokenDaRequisicao("a", "b")).toBe("a");
    expect(tokenDaRequisicao(" ", "b")).toBe("b");
    expect(tokenDaRequisicao(undefined, undefined)).toBeNull();
  });
});

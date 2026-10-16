// Autorização do app do aluno na API (usado por server/routes/publico.ts).
// Fica aqui, sem importar $lib, para o teste rodar no vitest do web/.
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

export type AlunoVars = { alunoId: string; alunoToken: string | null };

/** Valida (studentId, token). Em produção: verifyStudentAccess de $lib/server/aluno-token. */
export type VerificarAcesso = (studentId: string, token: string | null) => Promise<boolean>;

export const LINK_INVALIDO = "Link inválido ou expirado. Peça um novo link ao seu treinador.";

/** Token do link: header `x-aluno-token` (o front usa) ou `?t=` (manifest, links antigos). */
export function tokenDaRequisicao(header: string | undefined, query: string | undefined): string | null {
  return header?.trim() || query?.trim() || null;
}

/**
 * Sem sessão Supabase: o dono do recurso é provado pelo token HMAC do link.
 * Token ausente, errado, de outro aluno ou de versão revogada → 401, sem
 * dizer qual dos casos (não ajuda quem tenta adivinhar).
 */
export function requireAluno(verificar: VerificarAcesso) {
  return createMiddleware<{ Variables: AlunoVars }>(async (c, next) => {
    const id = c.req.param("id") ?? "";
    const token = tokenDaRequisicao(c.req.header("x-aluno-token"), c.req.query("t"));
    if (!(await verificar(id, token))) throw new HTTPException(401, { message: LINK_INVALIDO });
    c.set("alunoId", id);
    c.set("alunoToken", token);
    await next();
  });
}

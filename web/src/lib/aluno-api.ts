// Cliente da API do app do aluno. Sem sessão Supabase: o token do link vai
// no header x-aluno-token (fora da URL da API, não cai em log de acesso).
import { ApiError } from "./api";

export async function apiAluno<T>(id: string, token: string | null, path = "", init: { method?: string; json?: unknown } = {}): Promise<T> {
  const headers = new Headers();
  if (token) headers.set("x-aluno-token", token);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  const res = await fetch(`/api/aluno/${encodeURIComponent(id)}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/** Sufixo `?t=` para links internos do app do aluno (o token mora na URL do link). */
export const comToken = (token: string | null, extra = "") => {
  const p = new URLSearchParams();
  if (token) p.set("t", token);
  const q = p.toString();
  return q ? `?${q}${extra ? `&${extra}` : ""}` : extra ? `?${extra}` : "";
};

import { createClient } from "@supabase/supabase-js";

// Mesmas chaves públicas do SvelteKit (PUBLIC_*), lidas do .env da raiz.
const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && key);

/**
 * Cliente só para AUTH. Dados nunca passam por aqui: o PostgREST está fechado
 * para escrita (auditoria S1) e toda leitura/escrita vai pela API (/api/*).
 */
export const supabase = createClient(url ?? "http://localhost", key ?? "anon", {
  auth: { persistSession: true, autoRefreshToken: true },
});

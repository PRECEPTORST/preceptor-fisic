import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Filtros na query string (brief §4.5): sobrevivem ao voltar e ao compartilhar o link. */
export function useFiltrosUrl<K extends string>(padroes: Record<K, string>) {
  const [params, setParams] = useSearchParams();
  const valores = Object.fromEntries(
    (Object.keys(padroes) as K[]).map((k) => [k, params.get(k) ?? padroes[k]]),
  ) as Record<K, string>;
  const set = useCallback(
    (k: K, v: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (!v || v === padroes[k]) n.delete(k);
          else n.set(k, v);
          return n;
        },
        { replace: true },
      ),
    [setParams, padroes],
  );
  const limpar = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  const ativos = (Object.keys(padroes) as K[]).some((k) => valores[k] !== padroes[k]);
  return { valores, set, limpar, ativos };
}

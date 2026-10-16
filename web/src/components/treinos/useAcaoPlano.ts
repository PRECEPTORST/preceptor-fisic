import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chaves } from "@/lib/treinos-tipos";

type Vars = { path: string; method?: "POST" | "PATCH" | "DELETE"; json?: unknown };

/**
 * Mutação numa rota de /api/treinos/:id. Cada uso tem o próprio estado de
 * pendente; no sucesso invalida o plano e a lista.
 */
export function useAcaoPlano<R = unknown>(planoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = "POST", json }: Vars) =>
      api<R>(`/treinos/${planoId}${path}`, { method, json: json ?? {} }),
    onSuccess: async (_r, v) => {
      // Plano excluído: tira do cache em vez de refazer a leitura (daria 404).
      if (v.method === "DELETE" && v.path === "") {
        qc.removeQueries({ queryKey: chaves.plano(planoId) });
        await qc.invalidateQueries({ queryKey: chaves.lista });
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.plano(planoId) }),
        qc.invalidateQueries({ queryKey: chaves.lista }),
      ]);
    },
  });
}

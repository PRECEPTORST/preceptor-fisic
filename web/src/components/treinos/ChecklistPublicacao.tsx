import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Circle, ShieldAlert } from "lucide-react";
import type { PlanRestriction, SourceMap } from "$lib/server/queries";
import { citacao, dataBR, motivoBloqueio, nivelLabel, plural, type SrcRef } from "@/lib/treinos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAcaoPlano } from "./useAcaoPlano";

export type Resolvivel = PlanRestriction & { resolved_at?: string; resolution?: string };

const COR = { red: "text-negative", yellow: "text-warning", green: "text-positive" } as const;
const ORDEM = { red: 0, yellow: 1, green: 2 } as const;

/**
 * Checklist de publicação: restrições (vermelho → verde) com motivo e fonte,
 * "Assumir responsabilidade e liberar" nas críticas do rascunho, e o Publicar
 * com o motivo do bloqueio sempre escrito.
 */
export function ChecklistPublicacao({
  planoId,
  status,
  restricoes,
  sourceMap,
}: {
  planoId: string;
  status: string;
  restricoes: Resolvivel[];
  sourceMap: SourceMap;
}) {
  const resolver = useAcaoPlano(planoId);
  const publicar = useAcaoPlano(planoId);
  const criticas = restricoes.filter((r) => r.level === "red" && !r.resolved_at).length;
  const motivo = motivoBloqueio(status, criticas);
  const rascunho = status === "generated";
  const itens = restricoes.map((r, i) => ({ r, i })).sort((a, b) => ORDEM[a.r.level] - ORDEM[b.r.level]);

  return (
    <section aria-labelledby="checklist" className="rounded-lg border border-line bg-bg-elevated shadow-card">
      <header className="border-b border-line p-5 pb-4">
        <h2 id="checklist" className="text-h6 font-medium text-ink">
          Checklist de publicação
        </h2>
        <p className="mt-1 text-caption text-ink-mute">
          {restricoes.length === 0 ? (
            "Nenhuma restrição clínica neste treino."
          ) : (
            <>
              <span className="num">{restricoes.length}</span> {plural(restricoes.length, "restrição", "restrições")} ·{" "}
              <span className="num">{criticas}</span> {plural(criticas, "crítica pendente", "críticas pendentes")}
            </>
          )}
        </p>
      </header>

      {itens.length > 0 && (
        <ul className="divide-y divide-line">
          {itens.map(({ r, i }) => {
            const c = citacao(r.source as SrcRef, sourceMap);
            const chave = r.source?.chunk_id ?? r.source?.source_id ?? "";
            const fonte = chave ? sourceMap[chave] : undefined;
            const Icone = r.resolved_at ? CheckCircle2 : r.level === "red" ? ShieldAlert : r.level === "yellow" ? AlertTriangle : Circle;
            return (
              <li key={r.title + i} className={cn("p-4", r.resolved_at && "opacity-70")}>
                <div className="flex gap-2.5">
                  <Icone className={cn("mt-0.5 size-4 shrink-0", r.resolved_at ? "text-positive" : COR[r.level])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-ink">
                      <span className="sr-only">{nivelLabel(r.level)}: </span>
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-soft">{r.description}</p>
                    {r.affected_exercises?.length > 0 && (
                      <p className="mt-1 text-caption text-ink-mute">Afeta: {r.affected_exercises.join(", ")}</p>
                    )}
                    {c.label && <p className="mt-1 text-caption text-ink-mute">Fonte: {c.label}</p>}
                    {fonte?.excerpt && (
                      <details className="mt-1 text-caption">
                        <summary className="cursor-pointer text-ink-soft hover:text-ink">Ver trecho da diretriz</summary>
                        <blockquote className="mt-1.5 border-l-2 border-line pl-3 italic text-ink-soft">
                          “{fonte.excerpt}
                          {fonte.excerpt.length >= 280 ? "…" : ""}”
                        </blockquote>
                      </details>
                    )}
                    {r.resolved_at && (
                      <p className="mt-1 text-caption text-positive">
                        {r.resolution === "dismissed" ? "Dispensada" : "Responsabilidade assumida"} em{" "}
                        <span className="num">{dataBR(r.resolved_at)}</span>
                      </p>
                    )}
                    {r.level === "red" && !r.resolved_at && rascunho && (
                      <ConfirmDialog
                        titulo="Assumir responsabilidade clínica?"
                        descricao="A restrição deixa de bloquear a publicação, e a decisão fica registrada no seu nome na trilha de auditoria."
                        confirmar="Assumir e liberar"
                        destrutivo={false}
                        onConfirmar={() =>
                          resolver
                            .mutateAsync({ path: `/restricoes/${i}/resolver`, json: { resolution: "overridden" } })
                            .then(() => toast.success("Restrição liberada sob sua responsabilidade."))
                            .catch((e: Error) => toast.error(`Não consegui liberar: ${e.message}`))
                        }
                        trigger={
                          <Button size="sm" variant="outline" className="mt-2">
                            Assumir responsabilidade e liberar
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="space-y-2 border-t border-line p-5">
        {motivo && (
          <p className={cn("text-caption", criticas > 0 && rascunho ? "text-negative" : "text-ink-mute")} role="status">
            {motivo}
          </p>
        )}
        {(rascunho || status === "published") && (
          <Button
            className="w-full"
            disabled={Boolean(motivo) || publicar.isPending}
            onClick={() =>
              publicar.mutate(
                { path: "/publicar" },
                {
                  onSuccess: () => toast.success("Treino publicado. O aluno já vê no app."),
                  onError: (e) => toast.error(`Não consegui publicar: ${e.message}`),
                },
              )
            }
          >
            <Check aria-hidden /> {status === "published" ? "Publicado" : publicar.isPending ? "Publicando…" : "Publicar para o aluno"}
          </Button>
        )}
      </footer>
    </section>
  );
}

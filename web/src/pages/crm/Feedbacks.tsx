import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CATEGORIA_FEEDBACK, trechosNegrito } from "@/lib/crm";
import { data, numero } from "@/lib/format";
import { useTitulo } from "@/lib/useTitulo";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { AbasCrm } from "./comum";
import { CHAVES, type Feedback } from "./dados";

/** Resumo em markdown leve: só **negrito**, renderizado como texto (sem HTML). */
function Resumo({ texto }: { texto: string }) {
  return (
    <div className="whitespace-pre-wrap text-body leading-relaxed text-ink-soft">
      {texto.split("\n").map((linha, i) => (
        <p key={i} className="min-h-[1lh]">
          {trechosNegrito(linha).map((t, j) => (t.negrito ? <strong key={j} className="font-semibold text-ink">{t.texto}</strong> : <span key={j}>{t.texto}</span>))}
        </p>
      ))}
    </div>
  );
}

export default function CrmFeedbacks() {
  useTitulo("Feedbacks · CRM · PreceptorFISIC");
  const q = useQuery({ queryKey: CHAVES.feedbacks, queryFn: () => api<{ feedbacks: Feedback[] }>("/crm/feedbacks") });
  const [resumo, setResumo] = useState<{ summary: string; summarizedCount: number } | null>(null);
  const resumir = useMutation({
    mutationFn: () => api<{ summary: string; summarizedCount: number }>("/crm/feedbacks/resumo", { method: "POST" }),
    onSuccess: setResumo,
    onError: (e: Error) => toast.error(`Não consegui resumir: ${e.message}`),
  });
  const total = q.data?.feedbacks.length ?? 0;

  return (
    <>
      <PageHeader
        title="Feedbacks dos beta testers"
        description={q.data ? <span className="num">{numero(total)} recebidos</span> : undefined}
        actions={
          <Button variant="outline" onClick={() => resumir.mutate()} disabled={resumir.isPending || total === 0}>
            {resumir.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {resumir.isPending ? "Resumindo com IA" : "Gerar resumo com IA"}
          </Button>
        }
      />
      <AbasCrm />
      <div className="space-y-6">
        {resumo && (
          <section className="animate-soft-fade rounded-lg border border-brand/40 bg-bg-elevated p-5 shadow-card" aria-labelledby="fb-resumo">
            <h2 id="fb-resumo" className="eyebrow text-brand">
              Resumo por IA{resumo.summarizedCount ? <span className="num"> · {resumo.summarizedCount} feedbacks</span> : null}
            </h2>
            <div className="mt-3">
              <Resumo texto={resumo.summary} />
            </div>
          </section>
        )}
        <QueryState
          query={q}
          skeleton={<SkeletonLista linhas={5} />}
          isEmpty={(d) => d.feedbacks.length === 0}
          empty={<EmptyState title="Nenhum feedback recebido ainda" description="O que os beta testers mandarem pelo app aparece aqui." />}
        >
          {({ feedbacks }) => (
            <ul className="cascata divide-y divide-line overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card">
              {feedbacks.map((f) => {
                const cat = CATEGORIA_FEEDBACK[f.category] ?? { label: f.category, tom: "neutral" as const };
                return (
                  <li key={f.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip tone={cat.tom}>{cat.label}</StatusChip>
                      <span className="text-caption font-medium text-ink">{f.authorName ?? "Anônimo"}</span>
                      {f.page && <span className="truncate font-mono text-micro text-ink-mute">{f.page}</span>}
                      <span className="num ml-auto text-caption text-ink-mute">{data(f.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-body text-ink-soft">{f.message}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
      </div>
    </>
  );
}

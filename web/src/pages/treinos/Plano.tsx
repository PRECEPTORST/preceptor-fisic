import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronUp, RotateCcw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { data, numero } from "@/lib/format";
import { gerando, letraSessao, plural, statusLabel, statusTom } from "@/lib/treinos";
import { chaves, type PlanoDetalhe } from "@/lib/treinos-tipos";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { AcoesPlano } from "@/components/treinos/AcoesPlano";
import { ChecklistPublicacao, type Resolvivel } from "@/components/treinos/ChecklistPublicacao";
import { GeracaoAoVivo } from "@/components/treinos/GeracaoAoVivo";
import { Painel } from "@/components/treinos/Painel";
import { SessaoEditor } from "@/components/treinos/SessaoEditor";
import { VolumeMuscular } from "@/components/treinos/VolumeMuscular";
import { Voltar } from "@/components/treinos/Voltar";
import { useAcaoPlano } from "@/components/treinos/useAcaoPlano";


/**
 * Editor de treino (brief §4.2). Em geração: plano ao vivo. Falhou: tentar de
 * novo ou excluir. Pronto: sessões à esquerda e checklist de publicação fixa à
 * direita (no celular, barra fixa embaixo que abre a checklist em painel).
 */
export default function TreinoPlano() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: chaves.plano(id), queryFn: () => api<{ plan: PlanoDetalhe }>(`/treinos/${id}`) });

  return (
    <QueryState query={q} skeleton={<PlanoSkeleton />}>
      {({ plan }) => {
        if (gerando(plan.status))
          return <GeracaoAoVivo planoId={plan.id} aluno={plan.studentName} fila={plan.status === "pending"} />;
        if (plan.status === "failed") return <Falhou plan={plan} />;
        return <Editor plan={plan} />;
      }}
    </QueryState>
  );
}

function Editor({ plan }: { plan: PlanoDetalhe }) {
  const [checklist, setChecklist] = useState(false);
  const pd = plan.planData;
  const sessoes = pd.weekly_sessions ?? [];
  const restricoes = (pd.restrictions ?? []) as Resolvivel[];
  const criticas = restricoes.filter((r) => r.level === "red" && !r.resolved_at).length;
  const checklistEl = (
    <ChecklistPublicacao planoId={plan.id} status={plan.status} restricoes={restricoes} sourceMap={plan.sourceMap} />
  );

  return (
    <div className="pb-20 lg:pb-0">
      <Voltar to={`/alunos/${plan.studentId}`}>{plan.studentName}</Voltar>
      <PageHeader
        eyebrow={
          <>
            {plan.studentName} · criado em <span className="num">{data(plan.createdAt)}</span>
          </>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            Treino <StatusChip tone={statusTom(plan.status)}>{statusLabel(plan.status)}</StatusChip>
          </span>
        }
        actions={<AcoesPlano planoId={plan.id} status={plan.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-label="Resumo" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
            <p className="text-body text-ink-soft">{pd.summary || "Sem resumo. Descreva o objetivo na capa da impressão."}</p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
              <div>
                <dt className="eyebrow">Sessões / semana</dt>
                <dd className="num mt-1 text-h6 font-medium text-ink">{numero(sessoes.length)}</dd>
              </div>
              {pd.program_weeks ? (
                <div>
                  <dt className="eyebrow">Duração</dt>
                  <dd className="mt-1 text-h6 font-medium text-ink">
                    <span className="num">{pd.program_weeks}</span> semanas
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="eyebrow">Restrições</dt>
                <dd className="mt-1 text-h6 font-medium text-ink">
                  <span className="num">{restricoes.length}</span>
                </dd>
              </div>
            </dl>
            {sessoes.length > 1 && (
              <nav aria-label="Sessões" className="mt-4 flex flex-wrap gap-2">
                {sessoes.map((s, i) => (
                  <a
                    key={i}
                    href={`#sessao-${i}`}
                    className="rounded-md border border-line px-2.5 py-1 text-caption text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <span className="num font-medium text-ink">{letraSessao(i)}</span> · {s.label ?? `Sessão ${i + 1}`}
                  </a>
                ))}
              </nav>
            )}
          </section>

          <section aria-labelledby="sessoes" className="space-y-4">
            <h2 id="sessoes" className="sr-only">
              Sessões de treino
            </h2>
            {sessoes.length === 0 ? (
              <EmptyState compact title="Treino sem sessões definidas" />
            ) : (
              sessoes.map((s, i) => (
                <SessaoEditor
                  key={i}
                  planoId={plan.id}
                  sessao={s}
                  i={i}
                  catalogMap={plan.catalogMap}
                  somenteLeitura={plan.status === "archived"}
                />
              ))
            )}
          </section>

          <VolumeMuscular sessoes={sessoes} />
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block">{checklistEl}</aside>
      </div>

      {/* Celular: barra fixa com o estado da checklist. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg-elevated px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => setChecklist(true)}
          className="flex min-h-11 w-full items-center gap-3 text-left"
          aria-haspopup="dialog"
        >
          {criticas > 0 ? (
            <ShieldAlert className="size-5 shrink-0 text-negative" aria-hidden />
          ) : (
            <ShieldCheck className="size-5 shrink-0 text-positive" aria-hidden />
          )}
          <span className={cn("flex-1 text-body", criticas > 0 ? "text-negative" : "text-ink")}>
            {criticas > 0 ? (
              <>
                <span className="num">{criticas}</span> {plural(criticas, "restrição crítica", "restrições críticas")} · Revisar
              </>
            ) : (
              <>
                <span className="num">{restricoes.length}</span> {plural(restricoes.length, "restrição", "restrições")} ·{" "}
                {plan.status === "generated" ? "Pronto para publicar" : statusLabel(plan.status)}
              </>
            )}
          </span>
          <ChevronUp className="size-4 text-ink-mute" aria-hidden />
        </button>
      </div>
      <Painel aberto={checklist} onFechar={() => setChecklist(false)} titulo="Publicação">
        {checklistEl}
      </Painel>
    </div>
  );
}

function Falhou({ plan }: { plan: PlanoDetalhe }) {
  const navigate = useNavigate();
  const excluir = useAcaoPlano(plan.id);
  return (
    <div className="mx-auto max-w-xl">
      <Voltar to={`/alunos/${plan.studentId}`}>{plan.studentName}</Voltar>
      <EmptyState
        decorative="/!!"
        title="A geração falhou"
        description="O PreceptorFISIC não conseguiu produzir um treino válido. Tente de novo; se repetir, monte na mão."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={`/alunos/${plan.studentId}/gerar`}>
                <RotateCcw aria-hidden /> Gerar de novo
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/alunos/${plan.studentId}/manual`}>Montar na mão</Link>
            </Button>
            <ConfirmDialog
              titulo="Excluir este treino com falha?"
              descricao="Não dá para desfazer."
              confirmar="Excluir"
              onConfirmar={() =>
                excluir
                  .mutateAsync({ path: "", method: "DELETE" })
                  .then(() => {
                    toast.success("Treino excluído.");
                    navigate("/treinos", { replace: true });
                  })
                  .catch((e: Error) => toast.error(`Não consegui excluir: ${e.message}`))
              }
              trigger={
                <Button variant="ghost">
                  <Trash2 aria-hidden /> Excluir
                </Button>
              }
            />
          </div>
        }
      />
    </div>
  );
}

function PlanoSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <Skeleton className="hidden h-80 lg:block" />
      </div>
    </div>
  );
}

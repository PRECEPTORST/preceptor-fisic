import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ExerciseLibraryItem } from "$lib/server/db/schema";
import { ApiError, api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ExercicioForm, type ExercicioEntrada } from "@/components/rotina/ExercicioForm";
import { ConfirmarExclusao } from "@/components/rotina/ConfirmarExclusao";
import { CHAVE_MEUS_EXERCICIOS, chaveExercicio } from "./chaves";
import { Voltar } from "@/components/rotina/Voltar";

export default function ExercicioEditar() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaveExercicio(id),
    queryFn: () => api<{ exercise: ExerciseLibraryItem }>(`/exercicios/${id}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const naoAchou = q.error instanceof ApiError && q.error.status === 404;
  const depois = (msg: string) => {
    qc.invalidateQueries({ queryKey: CHAVE_MEUS_EXERCICIOS });
    qc.removeQueries({ queryKey: chaveExercicio(id) });
    toast.success(msg);
    nav("/exercicios/meus");
  };
  const salvar = useMutation({
    mutationFn: (d: ExercicioEntrada) => api(`/exercicios/${id}`, { method: "PUT", json: d }),
    onSuccess: () => depois("Exercício salvo."),
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });
  const excluir = useMutation({
    mutationFn: () => api(`/exercicios/${id}`, { method: "DELETE" }),
    onSuccess: () => depois("Exercício excluído."),
    onError: (e) => toast.error(`Não consegui excluir: ${e.message}`),
  });

  return (
    <>
      <Voltar to="/exercicios/meus" rotulo="Meus exercícios" />
      {naoAchou ? (
        <EmptyState
          compact
          decorative="/404"
          title="Exercício não encontrado"
          description="Ele pode ter sido excluído."
          action={
            <Button asChild variant="outline">
              <Link to="/exercicios/meus">Voltar para meus exercícios</Link>
            </Button>
          }
        />
      ) : (
      <QueryState
        query={q}
        skeleton={
          <div className="max-w-3xl space-y-4" aria-busy="true" aria-label="Carregando">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        {({ exercise: ex }) => (
          <>
            <PageHeader eyebrow="Editar exercício" title={ex.name} />
            <ExercicioForm
              key={ex.id}
              inicial={{
                code: ex.code ?? "",
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                equipment: ex.equipment ?? "",
                level: ex.level ?? "",
                pattern: ex.pattern ?? "",
                executionNotes: ex.executionNotes ?? "",
                contraindications: ex.contraindications ?? [],
              }}
              salvando={salvar.isPending}
              rotuloSalvar="Salvar alterações"
              onSalvar={(d) => salvar.mutate(d)}
              rodape={
                <ConfirmarExclusao
                  titulo="Excluir este exercício?"
                  descricao={`"${ex.name}" sai da sua biblioteca. Planos já gerados não mudam.`}
                  excluindo={excluir.isPending}
                  onConfirmar={() => excluir.mutate()}
                />
              }
            />
          </>
        )}
      </QueryState>
      )}
    </>
  );
}

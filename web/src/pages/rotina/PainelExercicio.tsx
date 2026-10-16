import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ExerciseLibraryItem } from "$lib/server/db/schema";
import { ApiError, api } from "@/lib/api";
import { QueryState } from "@/components/QueryState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EXERCICIO_VAZIO, ExercicioForm, type ExercicioEntrada } from "@/components/rotina/ExercicioForm";
import { Painel } from "@/components/rotina/Painel";
import { CHAVE_MEUS_EXERCICIOS, chaveExercicio } from "./chaves";

/** Novo exercício (id = null) ou edição, em painel sobre a lista. */
export function PainelExercicio({ id, aberto, onFechar }: { id: string | null; aberto: boolean; onFechar: () => void }) {
  const [sujo, setSujo] = useState(false);
  const fechar = () => {
    setSujo(false);
    onFechar();
  };
  return (
    <Painel
      aberto={aberto}
      onFechar={fechar}
      sujo={sujo}
      eyebrow="Meus exercícios"
      titulo={id ? "Editar exercício" : "Novo exercício"}
    >
      {aberto && (id ? <Editar id={id} onFechar={fechar} onSujo={setSujo} /> : <Novo onFechar={fechar} onSujo={setSujo} />)}
    </Painel>
  );
}

type Props = { onFechar: () => void; onSujo: (s: boolean) => void };

function Novo({ onFechar, onSujo }: Props) {
  const qc = useQueryClient();
  const criar = useMutation({
    mutationFn: (d: ExercicioEntrada) => api<{ id: string }>("/exercicios", { method: "POST", json: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_MEUS_EXERCICIOS });
      toast.success("Exercício adicionado à sua biblioteca.");
      onFechar();
    },
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });
  return (
    <ExercicioForm
      inicial={EXERCICIO_VAZIO}
      salvando={criar.isPending}
      rotuloSalvar="Adicionar exercício"
      onSalvar={(d) => criar.mutate(d)}
      onCancelar={onFechar}
      onSujo={onSujo}
    />
  );
}

function Editar({ id, onFechar, onSujo }: Props & { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaveExercicio(id),
    queryFn: () => api<{ exercise: ExerciseLibraryItem }>(`/exercicios/${id}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const depois = (msg: string) => {
    qc.invalidateQueries({ queryKey: CHAVE_MEUS_EXERCICIOS });
    qc.removeQueries({ queryKey: chaveExercicio(id) });
    toast.success(msg);
    onFechar();
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

  if (q.error instanceof ApiError && q.error.status === 404)
    return <EmptyState compact decorative="/404" title="Exercício não encontrado" description="Ele pode ter sido excluído." />;
  return (
    <QueryState
      query={q}
      skeleton={
        <div className="space-y-4" aria-busy="true" aria-label="Carregando">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      {({ exercise: ex }) => (
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
          rotuloSalvar="Salvar"
          onSalvar={(d) => salvar.mutate(d)}
          onCancelar={onFechar}
          onSujo={onSujo}
          extra={
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="icon" aria-label="Excluir exercício" className="text-negative hover:bg-negative-soft hover:text-negative">
                  <Trash2 aria-hidden />
                </Button>
              }
              titulo="Excluir este exercício?"
              descricao={`"${ex.name}" sai da sua biblioteca. Planos já gerados não mudam.`}
              confirmar="Excluir"
              onConfirmar={() => excluir.mutateAsync().catch(() => {})}
            />
          }
        />
      )}
    </QueryState>
  );
}

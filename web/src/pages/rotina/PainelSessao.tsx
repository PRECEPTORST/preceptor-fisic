import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { paraInputs, type SessaoAgenda, type StatusSessao, type TipoSessao } from "@/lib/rotina";
import { QueryState } from "@/components/QueryState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Painel } from "@/components/rotina/Painel";
import { SessaoForm, type SessaoEntrada } from "@/components/rotina/SessaoForm";
import { CHAVE_AGENDA, CHAVE_ALUNOS_AGENDA, chaveSessao } from "./chaves";

type Detalhe = {
  appointment: SessaoAgenda & { studentId: string | null; notes: string | null };
  students: { id: string; name: string }[];
};

/** Novo compromisso (id = null) ou edição, em painel sobre a semana. `inicio` pré-preenche data/hora. */
export function PainelSessao({
  id,
  aberto,
  inicio,
  onFechar,
}: {
  id: string | null;
  aberto: boolean;
  inicio?: { date: string; time: string } | null;
  onFechar: () => void;
}) {
  const [sujo, setSujo] = useState(false);
  const fechar = () => {
    setSujo(false);
    onFechar();
  };
  return (
    <Painel aberto={aberto} onFechar={fechar} sujo={sujo} eyebrow="Agenda" titulo={id ? "Editar compromisso" : "Novo compromisso"}>
      {aberto &&
        (id ? <Editar id={id} onFechar={fechar} onSujo={setSujo} /> : <Novo inicio={inicio} onFechar={fechar} onSujo={setSujo} />)}
    </Painel>
  );
}

type Props = { onFechar: () => void; onSujo: (s: boolean) => void };

function useInvalidar() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: CHAVE_AGENDA });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    if (id) qc.removeQueries({ queryKey: chaveSessao(id) });
  };
}

function Novo({ inicio, onFechar, onSujo }: Props & { inicio?: { date: string; time: string } | null }) {
  const invalidar = useInvalidar();
  const alunos = useQuery({
    queryKey: CHAVE_ALUNOS_AGENDA,
    queryFn: () => api<{ students: { id: string; name: string }[] }>("/agenda/alunos"),
  });
  const criar = useMutation({
    // status não vai na criação (nasce "scheduled").
    mutationFn: ({ status: _s, ...d }: SessaoEntrada) => api<{ id: string }>("/agenda", { method: "POST", json: d }),
    onSuccess: (_r, d) => {
      invalidar();
      toast.success(d.studentId ? "Compromisso marcado. O aluno recebe o aviso por e-mail." : "Compromisso marcado.");
      onFechar();
    },
    onError: (e) => toast.error(`Não consegui marcar: ${e.message}`),
  });
  return (
    <QueryState query={alunos} skeleton={<Skeleton className="h-[480px] w-full" aria-busy="true" aria-label="Carregando" />}>
      {(d) => (
        <SessaoForm
          inicial={{
            // Data local do navegador (toISOString cairia em "amanhã" depois das 21h).
            date: inicio?.date ?? paraInputs(new Date()).date,
            time: inicio?.time ?? "09:00",
            duration: 60,
            studentId: null,
            type: "treino",
            status: "scheduled",
            label: "",
            notes: "",
          }}
          alunos={d.students}
          salvando={criar.isPending}
          rotuloSalvar="Marcar"
          onSalvar={(x) => criar.mutate(x)}
          onCancelar={onFechar}
          onSujo={onSujo}
        />
      )}
    </QueryState>
  );
}

function Editar({ id, onFechar, onSujo }: Props & { id: string }) {
  const invalidar = useInvalidar();
  const q = useQuery({
    queryKey: chaveSessao(id),
    queryFn: () => api<Detalhe>(`/agenda/${id}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const depois = (msg: string) => {
    invalidar(id);
    toast.success(msg);
    onFechar();
  };
  const salvar = useMutation({
    mutationFn: (d: SessaoEntrada) => api<{ ok: true; notificado: boolean }>(`/agenda/${id}`, { method: "PUT", json: d }),
    onSuccess: (r) => depois(r.notificado ? "Compromisso salvo. Avisei o aluno por e-mail." : "Compromisso salvo."),
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });
  const excluir = useMutation({
    mutationFn: () => api(`/agenda/${id}`, { method: "DELETE" }),
    onSuccess: () => depois("Compromisso excluído."),
    onError: (e) => toast.error(`Não consegui excluir: ${e.message}`),
  });

  if (q.error instanceof ApiError && q.error.status === 404)
    return <EmptyState compact decorative="/404" title="Compromisso não encontrado" description="Ele pode ter sido excluído." />;
  return (
    <QueryState query={q} skeleton={<Skeleton className="h-[520px] w-full" aria-busy="true" aria-label="Carregando" />}>
      {({ appointment: a, students }) => (
        <SessaoForm
          key={a.id}
          comStatus
          inicial={{
            ...paraInputs(a.startsAt),
            duration: a.durationMinutes,
            studentId: a.studentId,
            type: a.type as TipoSessao,
            status: a.status as StatusSessao,
            label: a.label ?? "",
            notes: a.notes ?? "",
          }}
          alunos={students}
          salvando={salvar.isPending}
          rotuloSalvar="Salvar"
          onSalvar={(d) => salvar.mutate(d)}
          onCancelar={onFechar}
          onSujo={onSujo}
          extra={
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="icon" aria-label="Excluir compromisso" className="text-negative hover:bg-negative-soft hover:text-negative">
                  <Trash2 aria-hidden />
                </Button>
              }
              titulo="Excluir este compromisso?"
              descricao="Ele some da agenda e o aluno não recebe aviso. Para avisar o aluno, marque como Cancelada e salve."
              confirmar="Excluir"
              onConfirmar={() => excluir.mutateAsync().catch(() => {})}
            />
          }
        />
      )}
    </QueryState>
  );
}

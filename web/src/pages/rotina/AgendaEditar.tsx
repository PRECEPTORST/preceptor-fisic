import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { paraInputs, type SessaoAgenda, type StatusSessao, type TipoSessao } from "@/lib/rotina";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Voltar } from "@/components/rotina/Voltar";
import { ConfirmarExclusao } from "@/components/rotina/ConfirmarExclusao";
import { SessaoForm, type SessaoEntrada } from "@/components/rotina/SessaoForm";
import { CHAVE_AGENDA, chaveSessao } from "./chaves";

type Resposta = {
  appointment: SessaoAgenda & { studentId: string | null; notes: string | null };
  students: { id: string; name: string }[];
};

export default function AgendaEditar() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaveSessao(id),
    queryFn: () => api<Resposta>(`/agenda/${id}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const naoAchou = q.error instanceof ApiError && q.error.status === 404;
  const depois = (msg: string) => {
    qc.invalidateQueries({ queryKey: CHAVE_AGENDA });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.removeQueries({ queryKey: chaveSessao(id) });
    toast.success(msg);
    nav("/agenda");
  };
  const salvar = useMutation({
    mutationFn: (d: SessaoEntrada) => api<{ ok: true; notificado: boolean }>(`/agenda/${id}`, { method: "PUT", json: d }),
    onSuccess: (r) => depois(r.notificado ? "Sessão salva. Avisei o aluno por e-mail." : "Sessão salva."),
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });
  const excluir = useMutation({
    mutationFn: () => api(`/agenda/${id}`, { method: "DELETE" }),
    onSuccess: () => depois("Sessão excluída."),
    onError: (e) => toast.error(`Não consegui excluir: ${e.message}`),
  });

  return (
    <>
      <Voltar to="/agenda" rotulo="Agenda" />
      {naoAchou ? (
        <EmptyState
          compact
          decorative="/404"
          title="Sessão não encontrada"
          description="Ela pode ter sido excluída."
          action={
            <Button asChild variant="outline">
              <Link to="/agenda">Voltar para a agenda</Link>
            </Button>
          }
        />
      ) : (
        <QueryState
          query={q}
          skeleton={<Skeleton className="h-[560px] max-w-3xl" aria-busy="true" aria-label="Carregando" />}
        >
          {({ appointment: a, students }) => (
            <>
              <PageHeader eyebrow="Editar sessão" title={a.studentName ?? a.label ?? "Sessão"} />
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
                rotuloSalvar="Salvar alterações"
                onSalvar={(d) => salvar.mutate(d)}
                rodape={
                  <ConfirmarExclusao
                    titulo="Excluir esta sessão?"
                    descricao="Ela some da agenda. O aluno não recebe aviso; para avisá-lo, marque a sessão como cancelada."
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

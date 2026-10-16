import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { paraInputs } from "@/lib/rotina";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Skeleton } from "@/components/ui/skeleton";
import { Voltar } from "@/components/rotina/Voltar";
import { SessaoForm, type SessaoEntrada } from "@/components/rotina/SessaoForm";
import { CHAVE_AGENDA, CHAVE_ALUNOS_AGENDA } from "./chaves";

export default function AgendaNova() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const alunos = useQuery({
    queryKey: CHAVE_ALUNOS_AGENDA,
    queryFn: () => api<{ students: { id: string; name: string }[] }>("/agenda/alunos"),
  });
  const criar = useMutation({
    // status não existe na criação (nasce "scheduled").
    mutationFn: ({ status: _s, ...d }: SessaoEntrada) => api<{ id: string }>("/agenda", { method: "POST", json: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_AGENDA });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Sessão marcada.");
      nav("/agenda");
    },
    onError: (e) => toast.error(`Não consegui marcar: ${e.message}`),
  });
  return (
    <>
      <Voltar to="/agenda" rotulo="Agenda" />
      <PageHeader eyebrow="Agenda" title="Nova sessão" />
      <QueryState
        query={alunos}
        skeleton={<Skeleton className="h-[520px] max-w-3xl" aria-busy="true" aria-label="Carregando" />}
      >
        {(d) => (
          <SessaoForm
            inicial={{
              // Data local do navegador (toISOString cairia em "amanhã" depois das 21h).
              date: paraInputs(new Date()).date,
              time: "09:00",
              duration: 60,
              studentId: null,
              type: "treino",
              status: "scheduled",
              label: "",
              notes: "",
            }}
            alunos={d.students}
            salvando={criar.isPending}
            rotuloSalvar="Marcar sessão"
            onSalvar={(x) => criar.mutate(x)}
          />
        )}
      </QueryState>
    </>
  );
}

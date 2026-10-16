import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { LeadStage } from "$lib/server/queries";
import { api } from "@/lib/api";
import { useTitulo } from "@/lib/useTitulo";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, useAvisoSaida } from "@/components/Form";
import { Button } from "@/components/ui/button";
import { CamposLead, corpoLead } from "./comum";
import { CHAVES, FORM_LEAD_VAZIO, type FormLead } from "./dados";

/** Lead novo não nasce cancelado nem perdido (igual ao Svelte). */
const ESTAGIOS_NOVO: LeadStage[] = ["visitante", "cadastrou", "ativou_aluno", "trial", "pagante"];

export default function CrmNovoLead() {
  useTitulo("Novo lead · CRM · PreceptorFISIC");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<FormLead>(FORM_LEAD_VAZIO);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useAvisoSaida(sujo);

  const criar = useMutation({
    mutationFn: () => api<{ id: string }>("/crm/leads", { method: "POST", json: corpoLead(f) }),
    onSuccess: (r) => {
      setSujo(false);
      void qc.invalidateQueries({ queryKey: CHAVES.crm });
      void qc.invalidateQueries({ queryKey: ["sessao"] });
      toast.success("Lead criado.");
      navigate(`/crm/${r.id}`);
    },
    onError: (e: Error) => {
      setErro(e.message);
      toast.error(`Não consegui criar o lead: ${e.message}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!f.name.trim()) {
      setErro("Informe o nome do lead.");
      return;
    }
    criar.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="CRM · Novo lead"
        title="Adicionar lead"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/crm/leads">
              <ArrowLeft aria-hidden /> Leads
            </Link>
          </Button>
        }
      />
      <form onSubmit={enviar} className="space-y-6" noValidate>
        {erro && (
          <p role="alert" className="rounded-lg border border-negative/40 bg-negative-soft p-3 text-body text-negative">
            {erro}
          </p>
        )}
        <CamposLead
          f={f}
          set={(p) => {
            setF((x) => ({ ...x, ...p }));
            setSujo(true);
          }}
          estagios={ESTAGIOS_NOVO}
          erroNome={erro && !f.name.trim() ? erro : null}
        />
        <FormActions enviando={criar.isPending} rotulo="Criar lead" onCancelar={() => navigate("/crm")} />
      </form>
    </div>
  );
}

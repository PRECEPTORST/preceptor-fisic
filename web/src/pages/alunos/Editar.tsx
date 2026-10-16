import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { campoDoErro, formDoAluno, payloadDoForm, semPrefixo, type FormAluno } from "@/lib/alunos";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { FormActions, useAvisoSaida } from "@/components/Form";
import { Button } from "@/components/ui/button";
import { CamposClinicos, CamposIdentidade, CamposPreferencias, ErroForm, FormSkeleton, type Erros } from "@/components/alunos/CamposAluno";
import { CHAVE_ALUNOS, chaveAluno, type Ficha } from "./dados";

export default function EditarAluno() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: chaveAluno(id), queryFn: () => api<Ficha>(`/alunos/${id}`) });
  return (
    <div className="mx-auto max-w-3xl">
      <QueryState query={q} skeleton={<FormSkeleton />}>
        {(d) => <Formulario id={id} ficha={d} />}
      </QueryState>
    </div>
  );
}

function Formulario({ id, ficha }: { id: string; ficha: Ficha }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<FormAluno>(() => formDoAluno(ficha.detail));
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const set = useCallback((p: Partial<FormAluno>) => {
    setF((x) => ({ ...x, ...p }));
    setSujo(true);
  }, []);
  useAvisoSaida(sujo);

  const salvar = useMutation({
    mutationFn: () => api(`/alunos/${id}`, { method: "PUT", json: payloadDoForm(f) }),
    onSuccess: () => {
      setSujo(false);
      void qc.invalidateQueries({ queryKey: chaveAluno(id) });
      void qc.invalidateQueries({ queryKey: CHAVE_ALUNOS });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Alterações salvas.");
      navigate(`/alunos/${id}`);
    },
    onError: (e: Error) => {
      const campo = campoDoErro(e.message);
      if (campo) setErros({ [campo]: semPrefixo(e.message) });
      else setErro(e.message);
      toast.error(`Não consegui salvar: ${semPrefixo(e.message)}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setErros({});
    salvar.mutate();
  }

  return (
    <>
      <PageHeader
        eyebrow={ficha.detail.student.name}
        title="Editar dados"
        actions={
          <Button variant="ghost" asChild>
            <Link to={`/alunos/${id}`}>
              <ArrowLeft aria-hidden /> Ficha
            </Link>
          </Button>
        }
      />
      <form onSubmit={enviar} className="space-y-6">
        <ErroForm msg={erro} />
        <CamposIdentidade f={f} set={set} erros={erros} />
        <CamposClinicos f={f} set={set} erros={erros} risco="lista" />
        <CamposPreferencias f={f} set={set} erros={erros} />
        <FormActions enviando={salvar.isPending} rotulo="Salvar alterações" onCancelar={() => navigate(`/alunos/${id}`)} />
      </form>
    </>
  );
}

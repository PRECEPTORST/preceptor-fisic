import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { camposFoco, letraSessao } from "@/lib/treinos";
import { chaves, type PrescricaoResposta } from "@/lib/treinos-tipos";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Campo, FormActions, FormSection, a11yCampo, useAvisoSaida } from "@/components/Form";
import { Input } from "@/components/ui/input";
import { Voltar } from "@/components/treinos/Voltar";

/**
 * Montar treino na mão: estrutura da semana aqui, exercícios no editor.
 * Não gasta a franquia de IA; as regras clínicas são as mesmas.
 */
export default function TreinoManual() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: chaves.prescricao(id), queryFn: () => api<PrescricaoResposta>(`/alunos/${id}/prescricao`) });
  return (
    <QueryState query={q} skeleton={<SkeletonLista linhas={5} />}>
      {(d) => <Formulario d={d} />}
    </QueryState>
  );
}

const faixa = (v: number | null, min: number, max: number, padrao: number) =>
  typeof v === "number" && v >= min && v <= max ? v : padrao;

function Formulario({ d }: { d: PrescricaoResposta }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Começa pela frequência e duração combinadas com o aluno.
  const [sessoes, setSessoes] = useState(String(faixa(d.weeklySessions, 1, 7, 3)));
  const [minutos, setMinutos] = useState(String(faixa(d.minutesPerSession, 20, 180, 60)));
  const [semanas, setSemanas] = useState("12");
  const [objetivo, setObjetivo] = useState("");
  const [focos, setFocos] = useState<string[]>([]);
  const [sujo, setSujo] = useState(false);
  useAvisoSaida(sujo);

  const n = Number(sessoes);
  const m = Number(minutos);
  const erroSessoes = Number.isInteger(n) && n >= 1 && n <= 7 ? null : "Escolha de 1 a 7 sessões por semana.";
  const erroMinutos = Number.isInteger(m) && m >= 20 && m <= 180 ? null : "A duração deve ficar entre 20 e 180 minutos.";
  const campos = camposFoco(focos, erroSessoes ? 0 : n);

  const criar = useMutation({
    mutationFn: () =>
      api<{ planId: string }>(`/alunos/${d.student.id}/manual`, {
        method: "POST",
        json: { sessions: n, minutes: m, weeks: Number(semanas), objective: objetivo, focos: campos },
      }),
    onSuccess: async (r) => {
      setSujo(false);
      await qc.invalidateQueries({ queryKey: chaves.lista });
      toast.success("Estrutura criada. Agora escolha os exercícios.");
      navigate(`/treinos/${r.planId}`, { replace: true });
    },
    onError: (e: Error) => toast.error(`Não consegui criar o treino: ${e.message}`),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!erroSessoes && !erroMinutos) criar.mutate();
  }
  const mudou = <T,>(f: (v: T) => void) => (v: T) => {
    setSujo(true);
    f(v);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Voltar to={`/alunos/${d.student.id}`}>{d.student.name}</Voltar>
      <PageHeader
        title="Montar treino na mão"
        description={`Para ${d.student.name}. Você define a estrutura aqui e escolhe os exercícios no editor. Não gasta a franquia de IA.`}
      />
      <form onSubmit={enviar} noValidate className="space-y-4">
        <FormSection titulo="Estrutura da semana" descricao="Os dias são distribuídos com descanso entre os treinos, como na geração automática.">
          <Campo id="sessoes" label="Sessões por semana" erro={erroSessoes}>
            <Input {...a11yCampo("sessoes", erroSessoes)} type="number" inputMode="numeric" min={1} max={7} value={sessoes} onChange={(e) => mudou(setSessoes)(e.target.value)} className="num" />
          </Campo>
          <Campo id="minutos" label="Minutos por sessão" erro={erroMinutos}>
            <Input {...a11yCampo("minutos", erroMinutos)} type="number" inputMode="numeric" min={20} max={180} step={5} value={minutos} onChange={(e) => mudou(setMinutos)(e.target.value)} className="num" />
          </Campo>
          <Campo id="semanas" label="Duração do programa" dica="Em semanas (1 a 104). Vai para a capa da impressão.">
            <Input {...a11yCampo("semanas", null, true)} type="number" inputMode="numeric" min={1} max={104} value={semanas} onChange={(e) => mudou(setSemanas)(e.target.value)} className="num" />
          </Campo>
        </FormSection>

        <FormSection titulo="Objetivo do programa" descricao="Aparece na capa da prescrição. Pode escrever depois.">
          <Campo id="objetivo" label="Objetivo" span>
            <Input
              {...a11yCampo("objetivo", null)}
              maxLength={800}
              value={objetivo}
              onChange={(e) => mudou(setObjetivo)(e.target.value)}
              placeholder="Ex.: recuperar força de membros inferiores após artroplastia de joelho"
            />
          </Campo>
        </FormSection>

        <FormSection titulo="Foco de cada treino" descricao='Vira o nome da sessão. Em branco fica "Treino A", "Treino B"…'>
          {campos.map((v, i) => (
            <Campo key={i} id={`foco-${i}`} label={`Treino ${letraSessao(i)}`}>
              <Input
                {...a11yCampo(`foco-${i}`, null)}
                maxLength={300}
                value={v}
                placeholder="Ex.: membros inferiores e core"
                onChange={(e) =>
                  mudou(setFocos)(Object.assign([...campos], { [i]: e.target.value }) as string[])
                }
              />
            </Campo>
          ))}
        </FormSection>

        <FormActions
          enviando={criar.isPending}
          rotulo="Criar e escolher exercícios"
          desabilitado={Boolean(erroSessoes || erroMinutos)}
          onCancelar={() => navigate(`/alunos/${d.student.id}`)}
        />
      </form>
    </div>
  );
}

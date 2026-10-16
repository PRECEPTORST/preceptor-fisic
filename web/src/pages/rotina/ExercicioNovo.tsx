import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Voltar } from "@/components/rotina/Voltar";
import { EXERCICIO_VAZIO, ExercicioForm, type ExercicioEntrada } from "@/components/rotina/ExercicioForm";
import { CHAVE_MEUS_EXERCICIOS } from "./chaves";

export default function ExercicioNovo() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const criar = useMutation({
    mutationFn: (d: ExercicioEntrada) => api<{ id: string }>("/exercicios", { method: "POST", json: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_MEUS_EXERCICIOS });
      toast.success("Exercício adicionado à sua biblioteca.");
      nav("/exercicios/meus");
    },
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });
  return (
    <>
      <Voltar to="/exercicios/meus" rotulo="Meus exercícios" />
      <PageHeader eyebrow="Biblioteca" title="Novo exercício" />
      <ExercicioForm
        inicial={EXERCICIO_VAZIO}
        salvando={criar.isPending}
        rotuloSalvar="Adicionar exercício"
        onSalvar={(d) => criar.mutate(d)}
      />
    </>
  );
}

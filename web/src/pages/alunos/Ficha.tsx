import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { estadoDaFicha } from "@/lib/alunos";
import { QueryState } from "@/components/QueryState";
import { JornadaAluno } from "@/components/JornadaAluno";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvisoPendente, FichaHero } from "@/components/alunos/FichaTopo";
import { AbaAvaliacoes, AbaClinico, AbaMensagens, AbaResumo, AbaTreino } from "@/components/alunos/FichaAbas";
import { DialogoLink } from "@/components/alunos/DialogoLink";
import { SheetAvaliacao } from "@/components/alunos/SheetAvaliacao";
import { CHAVE_ALUNOS, chaveAluno, type Ficha } from "./dados";

const ABAS = [
  { id: "resumo", label: "Resumo" },
  { id: "treino", label: "Treino" },
  { id: "avaliacoes", label: "Avaliações" },
  { id: "clinico", label: "Clínico" },
  { id: "mensagens", label: "Mensagens" },
] as const;

/** Ficha = espaço de trabalho do aluno (brief §4.1). Aba e painel de avaliação ficam na URL (?aba=&nova=1). */
export default function FichaAluno() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: chaveAluno(id), queryFn: () => api<Ficha>(`/alunos/${id}`) });
  return (
    <QueryState query={q} skeleton={<FichaSkeleton />}>
      {(f) => <Conteudo f={f} />}
    </QueryState>
  );
}

function Conteudo({ f }: { f: Ficha }) {
  const d = f.detail;
  const id = d.student.id;
  const chave = chaveAluno(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [link, setLink] = useState(false);
  const aba = ABAS.some((a) => a.id === params.get("aba")) ? params.get("aba")! : "resumo";
  const nova = params.get("nova") === "1";

  const mudar = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v == null) n.delete(k);
        else n.set(k, v);
        return n;
      },
      { replace: true },
    );

  const excluir = useMutation({
    mutationFn: () => api(`/alunos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHAVE_ALUNOS });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.removeQueries({ queryKey: chave });
      toast.success(`${d.student.name} foi excluído.`);
      navigate("/alunos");
    },
    onError: (e: Error) => toast.error(`Não consegui excluir: ${e.message}`),
  });

  return (
    <div className="animate-soft-fade space-y-6">
      <FichaHero d={d} onLink={() => setLink(true)} onExcluir={() => excluir.mutate()} excluindo={excluir.isPending} />
      {!d.student.profileCompletedAt && <AvisoPendente fillUrl={f.fillUrl} />}
      <JornadaAluno estado={estadoDaFicha(d)} />

      <Tabs value={aba} onValueChange={(v) => mudar("aba", v === "resumo" ? null : v)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {ABAS.map((a) => (
              <TabsTrigger key={a.id} value={a.id}>
                {a.label}
                {a.id === "treino" && d.plans.length > 0 && <span className="num ml-1.5 text-ink-mute">{d.plans.length}</span>}
                {a.id === "avaliacoes" && d.assessments.length > 0 && <span className="num ml-1.5 text-ink-mute">{d.assessments.length}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="resumo" className="mt-6">
          <AbaResumo f={f} />
        </TabsContent>
        <TabsContent value="treino" className="mt-6">
          <AbaTreino f={f} />
        </TabsContent>
        <TabsContent value="avaliacoes" className="mt-6">
          <AbaAvaliacoes f={f} onNova={() => mudar("nova", "1")} />
        </TabsContent>
        <TabsContent value="clinico" className="mt-6">
          <AbaClinico f={f} chave={chave} />
        </TabsContent>
        <TabsContent value="mensagens" className="mt-6">
          <AbaMensagens f={f} />
        </TabsContent>
      </Tabs>

      <DialogoLink aberto={link} onAberto={setLink} aluno={d.student} url={f.alunoUrl} chave={chave} />
      <SheetAvaliacao
        aberto={nova}
        onAberto={(v) => mudar("nova", v ? "1" : null)}
        alunoId={id}
        peso={d.student.weightKg}
        altura={d.student.heightCm}
        chaves={[chave, CHAVE_ALUNOS, ["dashboard"]]}
      />
    </div>
  );
}

function FichaSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Hand, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { numero } from "@/lib/format";
import {
  altoRisco,
  DIVISOES,
  EQUIPAMENTOS,
  idade,
  LIMITE_OBSERVACOES,
  montarObservacoes,
  NIVEIS,
  objetivoCurto,
} from "@/lib/treinos";
import { chaves, type PrescricaoResposta } from "@/lib/treinos-tipos";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Campo, a11yCampo, useAvisoSaida } from "@/components/Form";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GeracaoAoVivo } from "@/components/treinos/GeracaoAoVivo";
import { Voltar } from "@/components/treinos/Voltar";

/**
 * Gerar treino com IA (brief §4.3): 1 contexto, 2 parâmetros, 3 gerar com
 * stream ao vivo na mesma página; ao terminar, abre o editor.
 */
export default function TreinoGerar() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: chaves.prescricao(id), queryFn: () => api<PrescricaoResposta>(`/alunos/${id}/prescricao`) });
  return (
    <QueryState query={q} skeleton={<SkeletonLista linhas={6} />}>
      {(d) => <Fluxo d={d} />}
    </QueryState>
  );
}

function Passo({ n, titulo, descricao, ativo, children }: { n: number; titulo: string; descricao?: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`passo-${n}`} className="rounded-lg border border-line bg-bg-elevated shadow-card">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span
          className={cn(
            "num flex size-7 shrink-0 items-center justify-center rounded-full border text-caption",
            ativo ? "border-brand bg-brand text-brand-on" : "border-line text-ink-mute",
          )}
          aria-hidden
        >
          {n}
        </span>
        <div>
          <h2 id={`passo-${n}`} className="text-h6 font-medium text-ink">
            {titulo}
          </h2>
          {descricao && <p className="text-caption text-ink-mute">{descricao}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Fluxo({ d }: { d: PrescricaoResposta }) {
  const navigate = useNavigate();
  const [equip, setEquip] = useState<string[]>(d.equipment);
  const [notas, setNotas] = useState("");
  const [divisao, setDivisao] = useState("auto");
  const [freq, setFreq] = useState<string>(d.weeklySessions ? String(d.weeklySessions) : "");
  const [nivel, setNivel] = useState("auto");
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [erro, setErro] = useState<{ status: number; msg: string } | null>(null);

  const freqNum = freq ? Number(freq) : null;
  // Só manda frequência se o profissional mudou da combinada com o aluno.
  const obs = montarObservacoes(notas, {
    divisao,
    frequencia: freqNum && freqNum !== d.weeklySessions ? freqNum : null,
    nivel,
  });
  const longo = obs.length > LIMITE_OBSERVACOES;
  const anos = idade(d.student.birthDate);
  const risco = d.diagnoses.some(altoRisco);
  const semCota = d.cota?.limite != null && d.cota.usado >= d.cota.limite;
  useAvisoSaida(!planoId && notas.trim().length > 0);

  const gerar = useMutation({
    mutationFn: () =>
      api<{ planId: string }>(`/alunos/${d.student.id}/gerar`, { method: "POST", json: { notes: obs || undefined, equipment: equip } }),
    onSuccess: (r) => {
      setErro(null);
      setPlanoId(r.planId);
    },
    onError: (e: Error) => {
      const status = e instanceof ApiError ? e.status : 500;
      setErro({ status, msg: e.message });
      toast.error(`Não consegui iniciar a geração: ${e.message}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!longo) gerar.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Voltar to={`/alunos/${d.student.id}`}>{d.student.name}</Voltar>
      <PageHeader
        title="Gerar treino com IA"
        description={`Para ${d.student.name}. Confira o contexto, ajuste os parâmetros e gere.`}
        actions={
          d.cota && (
            <p className="text-caption text-ink-mute" aria-label="Franquia de gerações">
              {d.cota.limite == null ? (
                <>
                  <span className="num">{numero(d.cota.usado)}</span> gerações neste ciclo
                </>
              ) : (
                <>
                  <span className={cn("num text-body font-medium", semCota ? "text-negative" : "text-ink")}>
                    {numero(Math.max(0, d.cota.limite - d.cota.usado))}
                  </span>{" "}
                  de <span className="num">{numero(d.cota.limite)}</span> gerações restantes
                </>
              )}
            </p>
          )
        }
      />

      <form onSubmit={enviar} className="space-y-4">
        <Passo n={1} titulo="Contexto que a IA vai usar" descricao="Vem da ficha clínica. Ajuste o equipamento e escreva o que a ficha não diz." ativo={!planoId}>
          <div className="flex items-center gap-3">
            <Avatar nome={d.student.name} size={40} />
            <div>
              <p className="font-medium text-ink">{d.student.name}</p>
              <p className="text-caption text-ink-mute">
                {anos != null && (
                  <>
                    <span className="num">{anos}</span> anos ·{" "}
                  </>
                )}
                {objetivoCurto(d.goals)}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <Lista titulo="Condições" itens={d.diagnoses} destacar={altoRisco} />
            <Lista titulo="Limitações" itens={d.limitations} />
            <Lista titulo="Medicações" itens={d.medications} />
          </dl>
          {risco && (
            <p role="note" className="mt-4 flex gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-caption text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Condição de alto risco. O treino passa pelas regras de segurança clínica e as restrições críticas bloqueiam a publicação.
            </p>
          )}
          <Link to={`/alunos/${d.student.id}`} className="mt-3 inline-block text-caption text-ink-mute hover:text-brand">
            Corrigir na ficha clínica →
          </Link>

          <fieldset className="mt-5">
            <legend className="text-body font-medium text-ink">Equipamento disponível</legend>
            <p className="text-caption text-ink-mute">A IA só prescreve com o que o aluno tem.</p>
            <ToggleGroup type="multiple" value={equip} onValueChange={setEquip} className="mt-2 flex flex-wrap justify-start gap-1.5" aria-label="Equipamento disponível">
              {EQUIPAMENTOS.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} size="sm" variant="outline" className="data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand">
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <div className="mt-5">
            <Campo id="notas" label="Observação profissional (opcional)" erro={longo ? `Passou de ${LIMITE_OBSERVACOES} caracteres. Resuma o texto.` : null} dica="O que a IA deve considerar e não está na ficha.">
              <Textarea
                {...a11yCampo("notas", longo ? "x" : null, true)}
                rows={4}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ex.: evitar impacto; prefere treinar de manhã; voltou de lesão no ombro há 2 meses."
              />
            </Campo>
            <p className={cn("num mt-1 text-right text-caption", longo ? "text-negative" : "text-ink-mute")}>
              {obs.length}/{LIMITE_OBSERVACOES}
            </p>
          </div>
        </Passo>

        <Passo n={2} titulo="Parâmetros" descricao="Opcional. Sem escolha, a IA decide pelo perfil." ativo={!planoId}>
          <div className="space-y-4">
            <Segmento rotulo="Divisão" valor={divisao} onChange={setDivisao} opcoes={DIVISOES} />
            <Segmento
              rotulo="Frequência semanal"
              valor={freq}
              onChange={setFreq}
              opcoes={[1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), `${n}x`] as const)}
              dica={d.weeklySessions ? `Combinado com o aluno: ${d.weeklySessions}x por semana.` : undefined}
            />
            <Segmento rotulo="Nível" valor={nivel} onChange={setNivel} opcoes={NIVEIS} />
          </div>
        </Passo>

        <Passo n={3} titulo="Gerar" ativo={Boolean(planoId)}>
          {planoId ? (
            <GeracaoAoVivo
              planoId={planoId}
              aluno={d.student.name}
              fila
              onFim={(ok) => {
                if (ok) {
                  toast.success("Treino gerado. Revise as restrições antes de publicar.");
                  navigate(`/treinos/${planoId}`, { replace: true });
                } else {
                  toast.error("A geração falhou. Tente de novo ou monte na mão.");
                  navigate(`/treinos/${planoId}`, { replace: true });
                }
              }}
            />
          ) : (
            <div className="space-y-3">
              {erro && (
                <p
                  role="alert"
                  className={cn(
                    "rounded-md border p-3 text-caption",
                    erro.status === 429 ? "border-warning/40 bg-warning-soft text-warning" : "border-negative/40 bg-negative-soft text-negative",
                  )}
                >
                  {erro.status === 429 ? "Limite de geração atingido. " : erro.status === 402 ? "Franquia do ciclo esgotada. " : ""}
                  {erro.msg}
                  {erro.status === 402 && (
                    <>
                      {" "}
                      <Link to="/assinatura" className="underline">
                        Ver assinatura
                      </Link>
                    </>
                  )}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" size="lg" disabled={gerar.isPending || longo || semCota} className="sm:flex-1">
                  <Sparkles aria-hidden /> {gerar.isPending ? "Iniciando…" : "Gerar treino"}
                </Button>
                <Button type="button" variant="outline" size="lg" asChild>
                  <Link to={`/alunos/${d.student.id}/manual`}>
                    <Hand aria-hidden /> Montar na mão
                  </Link>
                </Button>
              </div>
              <p className="text-caption text-ink-mute">
                Montar na mão não gasta a franquia. As regras clínicas são as mesmas nos dois caminhos.
              </p>
            </div>
          )}
        </Passo>
      </form>
    </div>
  );
}

function Lista({ titulo, itens, destacar }: { titulo: string; itens: string[]; destacar?: (s: string) => boolean }) {
  return (
    <div>
      <dt className="eyebrow">{titulo}</dt>
      <dd className="mt-1 text-body">
        {itens.length === 0 ? (
          <span className="text-ink-mute">Nada registrado</span>
        ) : (
          <ul className="space-y-0.5">
            {itens.map((x, i) => (
              <li key={x + i} className={destacar?.(x) ? "text-warning" : "text-ink-soft"}>
                {x}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

function Segmento({
  rotulo,
  valor,
  onChange,
  opcoes,
  dica,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: readonly (readonly [string, string])[];
  dica?: string;
}) {
  return (
    <div>
      <p className="text-body font-medium text-ink">{rotulo}</p>
      {dica && <p className="text-caption text-ink-mute">{dica}</p>}
      <ToggleGroup
        type="single"
        value={valor}
        onValueChange={(v) => onChange(v)}
        aria-label={rotulo}
        className="mt-2 flex flex-wrap justify-start gap-1.5"
      >
        {opcoes.map(([k, l]) => (
          <ToggleGroupItem key={k} value={k} size="sm" variant="outline" className="data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand">
            {l}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

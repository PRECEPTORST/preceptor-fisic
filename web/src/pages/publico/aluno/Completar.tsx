import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { apiAluno } from "@/lib/aluno-api";
import { useTitulo } from "@/lib/useTitulo";
import { cn } from "@/lib/utils";
import { AlunoShell, useAlunoLink } from "@/components/publico/AlunoShell";
import { AlunoEstado } from "@/components/publico/AlunoEstado";
import { Campo, FormActions, FormSection, a11yCampo, useAvisoSaida } from "@/components/Form";
import { SkeletonLista } from "@/components/QueryState";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { chaveAluno, chaveCadastro, type CadastroAluno } from "./tipos";

const OBJETIVOS = [
  { id: "emagrecimento", label: "Emagrecimento" },
  { id: "hipertrofia", label: "Hipertrofia" },
  { id: "forca", label: "Força" },
  { id: "condicionamento_cardiovascular", label: "Cardio" },
  { id: "qualidade_de_vida", label: "Saúde geral" },
  { id: "reabilitacao", label: "Reabilitação" },
  { id: "performance", label: "Performance" },
];

export default function Completar() {
  const { id, token } = useAlunoLink();
  const q = useQuery({ queryKey: chaveCadastro(id), queryFn: () => apiAluno<CadastroAluno>(id, token, "/completar") });
  useTitulo("Completar cadastro · PreceptorFISIC");
  return (
    <AlunoShell semAbas titulo="Completar cadastro" subtitulo="PreceptorFISIC">
      <AlunoEstado query={q} skeleton={<SkeletonLista linhas={6} />}>
        {(d) => <Formulario d={d} />}
      </AlunoEstado>
    </AlunoShell>
  );
}

// Native <select>: no celular abre o seletor do sistema, que é o melhor alvo de toque.
function Selecao({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...p}
      className="flex h-12 w-full rounded-md border border-input bg-bg px-3 text-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-negative"
    >
      {children}
    </select>
  );
}

function Formulario({ d }: { d: CadastroAluno }) {
  const { id, token, base, q } = useAlunoLink();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const topo = useRef<HTMLDivElement>(null);
  const hp = d.healthProfile;
  const pr = d.preferences;

  const [f, setF] = useState({
    birthDate: d.student.birthDate ?? "",
    phone: "",
    weightKg: "",
    heightCm: "",
    diagnoses: (hp?.diagnoses ?? []).map((x) => x.label).join(", "),
    medications: (hp?.medications ?? []).map((x) => x.name).join(", "),
    limitations: (hp?.injuries ?? []).map((i) => i.region + (i.notes ? " · " + i.notes : "")).join(", "),
    cardiovascularRisk: hp?.cardiovascularRisk ?? "baixo",
    goals: pr?.goals ?? [],
    weeklySessions: String(pr?.weeklySessions ?? 3),
    minutesPerSession: String(pr?.minutesPerSession ?? 60),
    experienceLevel: pr?.experienceLevel ?? "iniciante",
    prescribedDifficulty: pr?.prescribedDifficulty ?? "media",
    acceptPrivacy: false,
  });
  const [sujo, setSujo] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  useAvisoSaida(sujo);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setSujo(true);
    setErros((e) => ({ ...e, [k]: "" }));
  };

  const salvar = useMutation({
    mutationFn: () =>
      apiAluno(id, token, "/completar", {
        method: "POST",
        json: { ...f, weeklySessions: Number(f.weeklySessions), minutesPerSession: Number(f.minutesPerSession) },
      }),
    onSuccess: () => {
      setSujo(false);
      toast.success("Cadastro salvo. Obrigado!");
      qc.invalidateQueries({ queryKey: chaveAluno(id) });
      qc.invalidateQueries({ queryKey: chaveCadastro(id) });
      navigate(`${base}${q}`);
    },
    onError: (e: Error) => {
      setErros({ geral: e.message });
      topo.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  });

  function validar(): Record<string, string> {
    const e: Record<string, string> = {};
    const ws = Number(f.weeklySessions);
    const mp = Number(f.minutesPerSession);
    if (f.goals.length === 0) e.goals = "Escolha ao menos um objetivo.";
    if (!Number.isInteger(ws) || ws < 1 || ws > 7) e.weeklySessions = "Entre 1 e 7.";
    if (!Number.isInteger(mp) || mp < 15 || mp > 180) e.minutesPerSession = "Entre 15 e 180 minutos.";
    if (!f.acceptPrivacy) e.acceptPrivacy = "É preciso aceitar a Política de Privacidade para continuar.";
    return e;
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) {
      topo.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    salvar.mutate();
  }

  const listaErros = Object.entries(erros).filter(([, v]) => v);

  return (
    <form onSubmit={enviar} noValidate className="animate-soft-fade space-y-5">
      <div>
        <h2 className="text-h5 font-medium">Olá, {d.student.name.split(" ")[0]}</h2>
        <p className="mt-1 text-body text-ink-soft">
          {d.professional.name} começou seu cadastro. Complete seus dados para receber treinos sob medida.
        </p>
      </div>

      {d.student.profileCompletedAt && (
        <p role="status" className="rounded-lg border border-positive/40 bg-positive-soft px-4 py-3 text-body text-positive">
          Seu cadastro já está completo. Se quiser, atualize as informações abaixo.
        </p>
      )}

      <div ref={topo}>
        {listaErros.length > 0 && (
          <div role="alert" className="rounded-lg border border-negative/40 bg-negative-soft px-4 py-3 text-body">
            <p className="font-medium text-negative">Não consegui salvar. Confira:</p>
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              {listaErros.map(([k, v]) => (
                <li key={k}>{v}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <FormSection titulo="Sobre você">
        <Campo id="birthDate" label="Data de nascimento">
          <Input type="date" className="h-12 text-body-lg" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} {...a11yCampo("birthDate")} />
        </Campo>
        <Campo id="phone" label="Telefone">
          <Input type="tel" autoComplete="tel" className="h-12 text-body-lg" placeholder="+55 11 9…" value={f.phone} onChange={(e) => set("phone", e.target.value)} {...a11yCampo("phone")} />
        </Campo>
        <Campo id="weightKg" label="Peso (kg)">
          <Input inputMode="decimal" className="num h-12 text-body-lg" placeholder="70" value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} {...a11yCampo("weightKg")} />
        </Campo>
        <Campo id="heightCm" label="Altura (cm)">
          <Input inputMode="numeric" className="num h-12 text-body-lg" placeholder="172" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} {...a11yCampo("heightCm")} />
        </Campo>
      </FormSection>

      <FormSection titulo="Saúde" descricao="Separe por vírgula. Na dúvida, deixe em branco: seu treinador revisa depois.">
        <Campo id="diagnoses" label="Tem algum diagnóstico?" span>
          <Textarea rows={2} className="text-body-lg" placeholder="hipertensão, asma leve…" value={f.diagnoses} onChange={(e) => set("diagnoses", e.target.value)} {...a11yCampo("diagnoses")} />
        </Campo>
        <Campo id="medications" label="Usa alguma medicação?" span>
          <Textarea rows={2} className="text-body-lg" placeholder="losartana 50 mg…" value={f.medications} onChange={(e) => set("medications", e.target.value)} {...a11yCampo("medications")} />
        </Campo>
        <Campo id="limitations" label="Tem alguma limitação física ou lesão?" span>
          <Textarea rows={2} className="text-body-lg" placeholder="dor lombar ao agachar, ombro direito limitado…" value={f.limitations} onChange={(e) => set("limitations", e.target.value)} {...a11yCampo("limitations")} />
        </Campo>
        <Campo id="cardiovascularRisk" label="Risco cardiovascular" dica="Na dúvida, deixe “Baixo”: seu treinador revisa depois." span>
          <Selecao value={f.cardiovascularRisk} onChange={(e) => set("cardiovascularRisk", e.target.value)} {...a11yCampo("cardiovascularRisk", null, true)}>
            <option value="baixo">Baixo: sem problemas conhecidos</option>
            <option value="moderado">Moderado</option>
            <option value="alto">Alto</option>
            <option value="muito_alto">Muito alto</option>
          </Selecao>
        </Campo>
      </FormSection>

      <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <h2 id="obj" className="eyebrow">
          Seus objetivos
        </h2>
        <p className="mt-1 text-caption text-ink-mute">Escolha um ou mais.</p>
        <div role="group" aria-labelledby="obj" aria-describedby={erros.goals ? "goals-erro" : undefined} className="mt-4 flex flex-wrap gap-2">
          {OBJETIVOS.map((g) => {
            const on = f.goals.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => set("goals", on ? f.goals.filter((x) => x !== g.id) : [...f.goals, g.id])}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-body transition-colors",
                  on ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft hover:text-ink",
                )}
              >
                {on ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {g.label}
              </button>
            );
          })}
        </div>
        {erros.goals && (
          <p id="goals-erro" className="mt-2 text-caption text-negative">
            {erros.goals}
          </p>
        )}
      </section>

      <FormSection titulo="Preferências de treino">
        <Campo id="weeklySessions" label="Treinos por semana" erro={erros.weeklySessions}>
          <Input inputMode="numeric" className="num h-12 text-body-lg" value={f.weeklySessions} onChange={(e) => set("weeklySessions", e.target.value)} {...a11yCampo("weeklySessions", erros.weeklySessions)} />
        </Campo>
        <Campo id="minutesPerSession" label="Minutos por treino" erro={erros.minutesPerSession}>
          <Input inputMode="numeric" className="num h-12 text-body-lg" value={f.minutesPerSession} onChange={(e) => set("minutesPerSession", e.target.value)} {...a11yCampo("minutesPerSession", erros.minutesPerSession)} />
        </Campo>
        <Campo id="experienceLevel" label="Sua experiência com treino" span>
          <Selecao value={f.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)} {...a11yCampo("experienceLevel")}>
            <option value="iniciante">Iniciante: pouca ou nenhuma experiência</option>
            <option value="intermediario">Intermediário: treino há alguns meses</option>
            <option value="avancado">Avançado: treino consistente há anos</option>
          </Selecao>
        </Campo>
        <Campo id="prescribedDifficulty" label="Dificuldade dos exercícios" dica="Novo na academia? Prefira “Pequena” para começar sem exercícios complexos." span>
          <Selecao value={f.prescribedDifficulty} onChange={(e) => set("prescribedDifficulty", e.target.value)} {...a11yCampo("prescribedDifficulty", null, true)}>
            <option value="pequena">Pequena: exercícios simples e seguros</option>
            <option value="media">Média: equilíbrio</option>
            <option value="alta">Alta: exercícios mais desafiadores</option>
          </Selecao>
        </Campo>
      </FormSection>

      {/* LGPD art. 11: dado de saúde exige consentimento explícito do titular (validado também na API). */}
      <div className="rounded-lg border border-line bg-bg-elevated p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Checkbox
            id="acceptPrivacy"
            checked={f.acceptPrivacy}
            onCheckedChange={(v) => set("acceptPrivacy", v === true)}
            className="mt-0.5 size-6"
            aria-invalid={erros.acceptPrivacy ? true : undefined}
            aria-describedby={erros.acceptPrivacy ? "acceptPrivacy-erro" : undefined}
          />
          <label htmlFor="acceptPrivacy" className="text-body">
            Autorizo o tratamento dos meus dados de saúde para a prescrição de treinos, conforme a{" "}
            <Link to="/legal/privacidade" target="_blank" className="text-brand underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </label>
        </div>
        {erros.acceptPrivacy && (
          <p id="acceptPrivacy-erro" className="mt-2 text-caption text-negative">
            {erros.acceptPrivacy}
          </p>
        )}
      </div>

      <FormActions enviando={salvar.isPending} rotulo={salvar.isPending ? "Salvando…" : "Concluir cadastro"} />
    </form>
  );
}

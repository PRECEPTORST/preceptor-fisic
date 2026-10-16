import { useCallback } from "react";
import {
  DIFICULDADES,
  ESTRUTURAS,
  EXPERIENCIAS,
  OBJETIVOS,
  RISCOS,
  SEXOS,
  idade,
  type FormAluno,
  type Risco,
} from "@/lib/alunos";
import { Campo, FormSection, a11yCampo } from "@/components/Form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalculadoraRiscoSbc } from "./CalculadoraRiscoSbc";

type Set = (p: Partial<FormAluno>) => void;
export type Erros = Partial<Record<keyof FormAluno, string>>;
type Props = { f: FormAluno; set: Set; erros: Erros };

function Escolha({ id, valor, onChange, opcoes }: { id: string; valor: string; onChange: (v: string) => void; opcoes: readonly { id: string; label: string }[] }) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Texto({ k, label, f, set, erros, dica, ...rest }: Props & { k: keyof FormAluno; label: string; dica?: string } & React.ComponentProps<typeof Input>) {
  return (
    <Campo id={k} label={label} erro={erros[k]} dica={dica}>
      <Input {...a11yCampo(k, erros[k], !!dica)} value={f[k] as string} onChange={(e) => set({ [k]: e.target.value })} {...rest} />
    </Campo>
  );
}

/** Identidade. No modo link pede só nome, nascimento e e-mail. */
export function CamposIdentidade({ link = false, ...p }: Props & { link?: boolean }) {
  return (
    <FormSection titulo="Identidade" descricao={link ? "O aluno completa o resto pelo link." : undefined}>
      <Texto {...p} k="name" label="Nome completo" required minLength={2} maxLength={160} autoComplete="off" placeholder="Ana Beatriz Silva" />
      <Texto {...p} k="birthDate" label={link ? "Data de nascimento" : "Data de nascimento (opcional)"} type="date" required={link} className="num" />
      {link ? (
        <Texto {...p} k="email" label="E-mail" type="email" required placeholder="ana@email.com" />
      ) : (
        <>
          <Campo id="sex" label="Sexo">
            <Escolha id="sex" valor={p.f.sex} onChange={(sex) => p.set({ sex })} opcoes={SEXOS} />
          </Campo>
          {/* type=text: com type=number o navegador apaga "70,5" e o servidor nunca vê a vírgula. */}
          <Texto {...p} k="weightKg" label="Peso (kg)" inputMode="decimal" className="num" placeholder="62,4" />
          <Texto {...p} k="heightCm" label="Altura (cm)" inputMode="decimal" className="num" placeholder="165" />
          <Texto {...p} k="phone" label="Telefone" type="tel" className="num" placeholder="(11) 9…" />
          <Texto {...p} k="email" label="E-mail" type="email" placeholder="ana@email.com" dica="Com e-mail, envio o link do app ao cadastrar." />
        </>
      )}
    </FormSection>
  );
}

function Area({ k, label, f, set, dica, ph }: Props & { k: "diagnoses" | "medications" | "limitations"; label: string; dica?: string; ph: string }) {
  return (
    <Campo id={k} label={label} dica={dica} span>
      <Textarea {...a11yCampo(k, null, !!dica)} rows={2} placeholder={ph} value={f[k]} onChange={(e) => set({ [k]: e.target.value })} />
    </Campo>
  );
}

/** Perfil clínico. Risco CV: calculadora SBC no cadastro, escolha direta na edição. */
export function CamposClinicos({ risco, ...p }: Props & { risco: "calculadora" | "lista" }) {
  const { set } = p;
  const onNivel = useCallback((n: Risco) => set({ cardiovascularRisk: n }), [set]);
  return (
    <FormSection titulo="Perfil clínico" descricao="Separe os itens por vírgula. Tudo aqui entra no contexto da IA ao gerar o plano.">
      <Area {...p} k="diagnoses" label="Diagnósticos" ph="hipertensão estágio 2, asma leve" />
      <Area {...p} k="medications" label="Medicações em uso" ph="losartana 50 mg/dia, metformina 850 mg" />
      <Area {...p} k="limitations" label="Limitações físicas ou lesões" dica="Articulações, regiões com dor, restrições de amplitude." ph="dor lombar ao agachar, ombro direito limitado acima de 90°" />
      {risco === "calculadora" ? (
        <div className="sm:col-span-2">
          <CalculadoraRiscoSbc idade={idade(p.f.birthDate)} sexo={p.f.sex} onNivel={onNivel} />
        </div>
      ) : (
        <Campo id="cardiovascularRisk" label="Risco cardiovascular" dica="Para recalcular pelo escore SBC, use a aba Clínico da ficha.">
          <Escolha id="cardiovascularRisk" valor={p.f.cardiovascularRisk} onChange={(v) => set({ cardiovascularRisk: v as Risco })} opcoes={RISCOS} />
        </Campo>
      )}
    </FormSection>
  );
}

export function CamposPreferencias(p: Props) {
  const { f, set } = p;
  return (
    <FormSection titulo="Preferências de treino" descricao="Na estrutura automática, a IA escolhe full-body para 1 a 3 sessões, upper/lower para 4 e push/pull/legs para 5 ou 6.">
      <div className="space-y-1.5 sm:col-span-2">
        <p id="objetivos-rotulo" className="text-body font-medium text-ink">
          Objetivos
        </p>
        <ToggleGroup type="multiple" variant="outline" value={f.goals} onValueChange={(goals) => set({ goals })} aria-labelledby="objetivos-rotulo" className="flex-wrap justify-start">
          {OBJETIVOS.map((g) => (
            <ToggleGroupItem key={g.id} value={g.id} className="data-[state=on]:border-brand/50 data-[state=on]:bg-brand-soft data-[state=on]:text-brand">
              {g.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Texto {...p} k="weeklySessions" label="Sessões por semana" type="number" min={1} max={7} required className="num" />
      <Texto {...p} k="minutesPerSession" label="Minutos por sessão" type="number" min={15} max={180} required className="num" />
      <Campo id="experienceLevel" label="Experiência">
        <Escolha id="experienceLevel" valor={f.experienceLevel} onChange={(experienceLevel) => set({ experienceLevel })} opcoes={EXPERIENCIAS} />
      </Campo>
      <Campo id="prescribedDifficulty" label="Dificuldade dos exercícios" dica="Controla a complexidade técnica.">
        <Escolha id="prescribedDifficulty" valor={f.prescribedDifficulty} onChange={(prescribedDifficulty) => set({ prescribedDifficulty })} opcoes={DIFICULDADES} />
      </Campo>
      <Campo id="trainingSplit" label="Estrutura do treino">
        <Escolha id="trainingSplit" valor={f.trainingSplit} onChange={(trainingSplit) => set({ trainingSplit })} opcoes={ESTRUTURAS} />
      </Campo>
    </FormSection>
  );
}

/** Resumo de erro no topo (quando o erro não tem campo, ou há mais de um). */
export function ErroForm({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div role="alert" className="rounded-lg border border-negative/40 bg-negative-soft px-4 py-3 text-body text-negative">
      {msg}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

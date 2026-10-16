import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campo, FormActions, FormSection, a11yCampo } from "@/components/Form";
import { EQUIPAMENTOS, GRUPOS, NIVEIS, PADROES, parseContraindicacoes } from "@/lib/rotina";
import { Chip } from "./Chip";

export type ExercicioEntrada = {
  code: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  level: string;
  pattern: string;
  executionNotes: string;
  contraindications: string[];
};

export const EXERCICIO_VAZIO: ExercicioEntrada = {
  code: "",
  name: "",
  muscleGroup: "",
  equipment: "",
  level: "",
  pattern: "",
  executionNotes: "",
  contraindications: [],
};

// O Select do Radix não aceita value "", então "nenhum" é um sentinela.
const NENHUM = "_";
type Erros = Partial<Record<"name" | "muscleGroup", string>>;

/** Formulário de exercício (painel de novo e de editar). Mesmos campos do SvelteKit. */
export function ExercicioForm({
  inicial,
  salvando,
  rotuloSalvar,
  onSalvar,
  onCancelar,
  onSujo,
  extra,
}: {
  inicial: ExercicioEntrada;
  salvando: boolean;
  rotuloSalvar: string;
  onSalvar: (d: ExercicioEntrada) => void;
  onCancelar: () => void;
  onSujo?: (sujo: boolean) => void;
  extra?: ReactNode;
}) {
  const [d, setD] = useState(inicial);
  const [contra, setContra] = useState(inicial.contraindications.join(", "));
  const [erros, setErros] = useState<Erros>({});
  const set = <K extends keyof ExercicioEntrada>(k: K, v: ExercicioEntrada[K]) => setD((x) => ({ ...x, [k]: v }));
  const sujo = JSON.stringify(d) !== JSON.stringify(inicial) || contra !== inicial.contraindications.join(", ");
  useEffect(() => onSujo?.(sujo), [sujo, onSujo]);

  // Valor antigo fora da lista fixa continua aparecendo (e selecionado).
  const com = (lista: string[], v: string) => (v && !lista.includes(v) ? [v, ...lista] : lista);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const er: Erros = {};
    if (!d.name.trim()) er.name = "Dê um nome ao exercício.";
    if (!d.muscleGroup) er.muscleGroup = "Escolha o grupo muscular.";
    setErros(er);
    if (Object.keys(er).length) {
      document.getElementById(er.name ? "ex-name" : "ex-grupo")?.focus();
      return;
    }
    onSalvar({ ...d, name: d.name.trim(), code: d.code.trim(), contraindications: parseContraindicacoes(contra) });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {Object.keys(erros).length > 1 && (
        <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft px-4 py-3 text-body text-negative">
          Faltam {Object.keys(erros).length} campos obrigatórios.
        </p>
      )}
      <FormSection titulo="Identidade">
        <Campo id="ex-name" label="Nome" erro={erros.name} span>
          <Input
            {...a11yCampo("ex-name", erros.name)}
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Agachamento búlgaro"
          />
        </Campo>
        <Campo id="ex-code" label="Código" dica="Opcional, para você achar rápido.">
          <Input {...a11yCampo("ex-code", null, true)} value={d.code} onChange={(e) => set("code", e.target.value)} placeholder="EX021" />
        </Campo>
        <Campo id="ex-level" label="Nível">
          <Select value={d.level || NENHUM} onValueChange={(v) => set("level", v === NENHUM ? "" : v)}>
            <SelectTrigger id="ex-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Nenhum</SelectItem>
              {NIVEIS.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.label}
                </SelectItem>
              ))}
              {d.level && !NIVEIS.some((n) => n.id === d.level) && <SelectItem value={d.level}>{d.level}</SelectItem>}
            </SelectContent>
          </Select>
        </Campo>
        <fieldset className="space-y-2 sm:col-span-2" aria-describedby={erros.muscleGroup ? "ex-grupo-erro" : undefined}>
          <legend className="text-body font-medium text-ink">Grupo muscular</legend>
          <div id="ex-grupo" tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none">
            {com(GRUPOS, d.muscleGroup).map((g) => (
              <Chip key={g} ativo={d.muscleGroup === g} onClick={() => set("muscleGroup", g)}>
                {g}
              </Chip>
            ))}
          </div>
          {erros.muscleGroup && (
            <p id="ex-grupo-erro" className="text-caption text-negative">
              {erros.muscleGroup}
            </p>
          )}
        </fieldset>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-body font-medium text-ink">Equipamento</legend>
          <div className="flex flex-wrap gap-1.5">
            {com(EQUIPAMENTOS, d.equipment).map((q) => (
              <Chip key={q} ativo={d.equipment === q} onClick={() => set("equipment", d.equipment === q ? "" : q)}>
                {q}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Campo id="ex-pattern" label="Padrão de movimento">
          <Select value={d.pattern || NENHUM} onValueChange={(v) => set("pattern", v === NENHUM ? "" : v)}>
            <SelectTrigger id="ex-pattern">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Nenhum</SelectItem>
              {com(PADROES, d.pattern).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      </FormSection>
      <FormSection titulo="Execução e segurança" descricao="Aparece para você ao montar o plano.">
        <Campo id="ex-notes" label="Forma de execução" span>
          <Textarea
            id="ex-notes"
            rows={4}
            value={d.executionNotes}
            onChange={(e) => set("executionNotes", e.target.value)}
            placeholder="Pé de trás apoiado no banco, tronco levemente inclinado…"
          />
        </Campo>
        <Campo id="ex-contra" label="Contraindicações" dica="Separe por vírgula: dor no joelho, hérnia lombar" span>
          <Input {...a11yCampo("ex-contra", null, true)} value={contra} onChange={(e) => setContra(e.target.value)} />
        </Campo>
      </FormSection>
      <FormActions enviando={salvando} rotulo={rotuloSalvar} onCancelar={onCancelar} extra={extra} />
    </form>
  );
}

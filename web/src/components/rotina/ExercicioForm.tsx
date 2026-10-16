import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/** Formulário de exercício (novo e editar). Mesmos campos do SvelteKit. */
export function ExercicioForm({
  inicial,
  salvando,
  rotuloSalvar,
  onSalvar,
  rodape,
}: {
  inicial: ExercicioEntrada;
  salvando: boolean;
  rotuloSalvar: string;
  onSalvar: (d: ExercicioEntrada) => void;
  rodape?: ReactNode;
}) {
  const [d, setD] = useState(inicial);
  const [contra, setContra] = useState(inicial.contraindications.join(", "));
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof ExercicioEntrada>(k: K, v: ExercicioEntrada[K]) => setD((x) => ({ ...x, [k]: v }));
  // Valor antigo fora da lista fixa continua aparecendo (e selecionado).
  const grupos = d.muscleGroup && !GRUPOS.includes(d.muscleGroup) ? [d.muscleGroup, ...GRUPOS] : GRUPOS;
  const equips = d.equipment && !EQUIPAMENTOS.includes(d.equipment) ? [d.equipment, ...EQUIPAMENTOS] : EQUIPAMENTOS;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return setErro("Dê um nome ao exercício.");
    if (!d.muscleGroup) return setErro("Escolha o grupo muscular.");
    setErro(null);
    onSalvar({ ...d, name: d.name.trim(), code: d.code.trim(), contraindications: parseContraindicacoes(contra) });
  }

  return (
    <form onSubmit={enviar} className="max-w-3xl space-y-4" noValidate>
      {erro && (
        <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft px-4 py-3 text-body text-negative">
          {erro}
        </p>
      )}
      <section className="space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <p className="eyebrow">Identidade</p>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="ex-code">Código</Label>
            <Input id="ex-code" value={d.code} onChange={(e) => set("code", e.target.value)} placeholder="EX021" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-name">Nome *</Label>
            <Input
              id="ex-name"
              required
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Agachamento búlgaro"
            />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-body font-medium">Grupo muscular *</legend>
          <div className="flex flex-wrap gap-1.5">
            {grupos.map((g) => (
              <Chip key={g} ativo={d.muscleGroup === g} onClick={() => set("muscleGroup", g)}>
                {g}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-body font-medium">Equipamento</legend>
          <div className="flex flex-wrap gap-1.5">
            {equips.map((q) => (
              <Chip key={q} ativo={d.equipment === q} onClick={() => set("equipment", d.equipment === q ? "" : q)}>
                {q}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ex-pattern">Padrão de movimento</Label>
            <Select value={d.pattern || NENHUM} onValueChange={(v) => set("pattern", v === NENHUM ? "" : v)}>
              <SelectTrigger id="ex-pattern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                {(d.pattern && !PADROES.includes(d.pattern) ? [d.pattern, ...PADROES] : PADROES).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-level">Nível</Label>
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
          </div>
        </div>
      </section>
      <section className="space-y-4 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <p className="eyebrow">Execução</p>
        <div className="space-y-2">
          <Label htmlFor="ex-notes">Forma de execução</Label>
          <Textarea
            id="ex-notes"
            rows={4}
            value={d.executionNotes}
            onChange={(e) => set("executionNotes", e.target.value)}
            placeholder="Pé de trás apoiado no banco, tronco levemente inclinado…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ex-contra">Contraindicações</Label>
          <Input
            id="ex-contra"
            value={contra}
            onChange={(e) => setContra(e.target.value)}
            placeholder="Separe por vírgula: dor no joelho, hérnia lombar"
          />
        </div>
      </section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>{rodape}</div>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : rotuloSalvar}
        </Button>
      </div>
    </form>
  );
}

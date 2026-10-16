import { useId, useState, type FormEvent } from "react";
import type { PlanExercise } from "$lib/server/queries";
import { ACOES_MUSCULARES } from "@/lib/treinos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type DadosEdicao = {
  name: string;
  sets: number | null;
  reps: string;
  rest_seconds: number | null;
  intensity: string;
  load_guidance: string;
  cadence: string;
  range_of_motion: string;
  muscle_action: string;
  execution_notes: string;
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Edição de um exercício (inclui os campos da ficha impressa que a IA raramente preenche). */
export function EditorExercicio({
  ex,
  pendente,
  onSalvar,
  onCancelar,
}: {
  ex: PlanExercise;
  pendente: boolean;
  onSalvar: (d: DadosEdicao) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [f, setF] = useState({
    name: ex.name,
    sets: ex.sets != null ? String(ex.sets) : "",
    reps: ex.reps ?? "",
    rest_seconds: ex.rest_seconds != null ? String(ex.rest_seconds) : "",
    intensity: ex.intensity ?? "",
    load_guidance: ex.load_guidance ?? "",
    cadence: ex.cadence ?? "",
    range_of_motion: ex.range_of_motion ?? "",
    muscle_action: ex.muscle_action ?? "",
    execution_notes: ex.execution_notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  function enviar(e: FormEvent) {
    e.preventDefault();
    onSalvar({ ...f, sets: num(f.sets), rest_seconds: num(f.rest_seconds) });
  }

  const campo = (k: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`${id}-${k}`} className="text-caption text-ink-soft">
        {label}
      </Label>
      <Input id={`${id}-${k}`} value={f[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <form onSubmit={enviar} className="space-y-4">
      {campo("name", "Nome do exercício", { required: true, minLength: 2, maxLength: 200 })}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {campo("sets", "Séries", { type: "number", min: 1, max: 20, inputMode: "numeric" })}
        {campo("reps", "Repetições", { placeholder: "ex.: 8-12" })}
        {campo("rest_seconds", "Descanso (s)", { type: "number", min: 0, max: 900, inputMode: "numeric" })}
        {campo("intensity", "Intensidade", { placeholder: "ex.: 80% 1RM" })}
      </div>
      {campo("load_guidance", "Carga (orientação)", { placeholder: "ex.: carga moderada, PSE 7" })}
      <div className="grid gap-3 sm:grid-cols-3">
        {campo("cadence", "Cadência", { placeholder: "ex.: 2/2" })}
        {campo("range_of_motion", "Amplitude", { placeholder: "ex.: 90° ou total" })}
        <div className="space-y-1">
          <Label htmlFor={`${id}-acao`} className="text-caption text-ink-soft">
            Ação muscular
          </Label>
          <select
            id={`${id}-acao`}
            value={f.muscle_action}
            onChange={set("muscle_action")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {ACOES_MUSCULARES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-notes`} className="text-caption text-ink-soft">
          Observações de execução
        </Label>
        <Textarea id={`${id}-notes`} rows={2} value={f.execution_notes} onChange={set("execution_notes")} maxLength={2000} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

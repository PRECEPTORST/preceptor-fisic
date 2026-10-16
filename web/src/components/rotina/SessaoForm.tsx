import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS, TIPOS, duracaoValida, type StatusSessao, type TipoSessao } from "@/lib/rotina";
import { cn } from "@/lib/utils";
import { Chip } from "./Chip";

export type SessaoEntrada = {
  date: string;
  time: string;
  duration: number;
  studentId: string | null;
  type: TipoSessao;
  status: StatusSessao;
  label: string;
  notes: string;
};

const SEM_ALUNO = "_";

/** Formulário de sessão (nova e editar). Status só aparece na edição. */
export function SessaoForm({
  inicial,
  alunos,
  comStatus,
  salvando,
  rotuloSalvar,
  onSalvar,
  rodape,
}: {
  inicial: SessaoEntrada;
  alunos: { id: string; name: string }[];
  comStatus?: boolean;
  salvando: boolean;
  rotuloSalvar: string;
  onSalvar: (d: SessaoEntrada) => void;
  rodape?: ReactNode;
}) {
  const [d, setD] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof SessaoEntrada>(k: K, v: SessaoEntrada[K]) => setD((x) => ({ ...x, [k]: v }));

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!d.date || !d.time) return setErro("Preencha data e horário.");
    if (!duracaoValida(d.duration)) return setErro("A duração vai de 15 a 240 minutos.");
    setErro(null);
    onSalvar(d);
  }

  return (
    <form onSubmit={enviar} className="max-w-3xl space-y-4" noValidate>
      {erro && (
        <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft px-4 py-3 text-body text-negative">
          {erro}
        </p>
      )}
      <section className="space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <fieldset className="space-y-2">
          <legend className="eyebrow">Tipo</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={d.type === t.id}
                onClick={() => set("type", t.id)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-md border px-3 text-body transition-colors",
                  d.type === t.id ? cn("bg-bg-subtle text-ink", t.borda) : "border-line text-ink-soft hover:border-line-strong",
                )}
              >
                <span className={cn("size-2.5 rounded-sm", t.ponto)} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        {comStatus && (
          <fieldset className="space-y-2">
            <legend className="eyebrow">Status</legend>
            <div className="flex flex-wrap gap-1.5">
              {STATUS.map((s) => (
                <Chip key={s.id} ativo={d.status === s.id} onClick={() => set("status", s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="se-date">Data *</Label>
            <Input id="se-date" type="date" required value={d.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="se-time">Horário *</Label>
            <Input id="se-time" type="time" required value={d.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="se-dur">Duração (min) *</Label>
            <Input
              id="se-dur"
              type="number"
              inputMode="numeric"
              min={15}
              max={240}
              step={15}
              required
              className="num"
              value={Number.isNaN(d.duration) ? "" : d.duration}
              onChange={(e) => set("duration", e.target.valueAsNumber)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-aluno">Aluno</Label>
          <Select value={d.studentId ?? SEM_ALUNO} onValueChange={(v) => set("studentId", v === SEM_ALUNO ? null : v)}>
            <SelectTrigger id="se-aluno">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_ALUNO}>Sem aluno (bloqueio interno)</SelectItem>
              {alunos.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {d.studentId && <p className="text-caption text-ink-mute">O aluno recebe um e-mail se tiver e-mail cadastrado.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-label">Título (opcional)</Label>
          <Input
            id="se-label"
            value={d.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Reavaliação, treino A…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-notes">Notas (opcional)</Label>
          <Textarea id="se-notes" rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
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

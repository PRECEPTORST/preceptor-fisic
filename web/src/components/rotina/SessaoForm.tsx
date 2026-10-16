import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Campo, FormActions, FormSection, a11yCampo } from "@/components/Form";
import { STATUS, TIPOS, duracaoValida, type StatusSessao, type TipoSessao } from "@/lib/rotina";
import { cn } from "@/lib/utils";

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
const DURACOES = [30, 45, 60, 90];
type Erros = Partial<Record<"date" | "time" | "duration", string>>;

/** Formulário de compromisso (painel de novo e de editar). Status só na edição. */
export function SessaoForm({
  inicial,
  alunos,
  comStatus,
  salvando,
  rotuloSalvar,
  onSalvar,
  onCancelar,
  onSujo,
  extra,
}: {
  inicial: SessaoEntrada;
  alunos: { id: string; name: string }[];
  comStatus?: boolean;
  salvando: boolean;
  rotuloSalvar: string;
  onSalvar: (d: SessaoEntrada) => void;
  onCancelar: () => void;
  onSujo?: (sujo: boolean) => void;
  extra?: ReactNode;
}) {
  const [d, setD] = useState(inicial);
  const [erros, setErros] = useState<Erros>({});
  const set = <K extends keyof SessaoEntrada>(k: K, v: SessaoEntrada[K]) => setD((x) => ({ ...x, [k]: v }));
  const sujo = JSON.stringify(d) !== JSON.stringify(inicial);
  useEffect(() => onSujo?.(sujo), [sujo, onSujo]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const er: Erros = {};
    if (!d.date) er.date = "Escolha a data.";
    if (!d.time) er.time = "Escolha o horário.";
    if (!duracaoValida(d.duration)) er.duration = "De 15 a 240 minutos.";
    setErros(er);
    const primeiro = Object.keys(er)[0];
    if (primeiro) return document.getElementById(`se-${primeiro}`)?.focus();
    onSalvar(d);
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {Object.keys(erros).length > 1 && (
        <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft px-4 py-3 text-body text-negative">
          Confira os {Object.keys(erros).length} campos marcados.
        </p>
      )}
      <FormSection titulo="Quando">
        <Campo id="se-date" label="Data" erro={erros.date}>
          <Input {...a11yCampo("se-date", erros.date)} type="date" value={d.date} onChange={(e) => set("date", e.target.value)} />
        </Campo>
        <Campo id="se-time" label="Horário" erro={erros.time}>
          <Input {...a11yCampo("se-time", erros.time)} type="time" value={d.time} onChange={(e) => set("time", e.target.value)} />
        </Campo>
        <Campo id="se-duration" label="Duração (min)" erro={erros.duration} span>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={DURACOES.includes(d.duration) ? String(d.duration) : ""}
              onValueChange={(v) => v && set("duration", Number(v))}
              aria-label="Duração rápida"
            >
              {DURACOES.map((n) => (
                <ToggleGroupItem key={n} value={String(n)} className="num">
                  {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Input
              {...a11yCampo("se-duration", erros.duration)}
              type="number"
              inputMode="numeric"
              min={15}
              max={240}
              step={15}
              className="num w-24"
              value={Number.isNaN(d.duration) ? "" : d.duration}
              onChange={(e) => set("duration", e.target.valueAsNumber)}
            />
          </div>
        </Campo>
      </FormSection>
      <FormSection titulo="O quê">
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-body font-medium text-ink">Tipo</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={d.type === t.id}
                onClick={() => set("type", t.id)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-md border px-3 text-body transition-colors",
                  d.type === t.id ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-soft hover:border-line-strong",
                )}
              >
                <span className={cn("size-2.5 rounded-sm", t.ponto)} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        {comStatus && (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-body font-medium text-ink">Status</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              className="justify-start"
              value={d.status}
              onValueChange={(v) => v && set("status", v as StatusSessao)}
            >
              {STATUS.map((s) => (
                <ToggleGroupItem key={s.id} value={s.id}>
                  {s.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {d.status === "cancelled" && inicial.status !== "cancelled" && d.studentId && (
              <p className="text-caption text-ink-mute">Ao salvar, o aluno recebe um e-mail de cancelamento.</p>
            )}
          </fieldset>
        )}
        <Campo
          id="se-aluno"
          label="Aluno"
          dica={d.studentId ? "O aluno recebe um e-mail se tiver e-mail cadastrado." : undefined}
          span
        >
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
        </Campo>
        <Campo id="se-label" label="Título (opcional)" span>
          <Input id="se-label" value={d.label} onChange={(e) => set("label", e.target.value)} placeholder="Reavaliação, treino A…" />
        </Campo>
        <Campo id="se-notes" label="Notas (opcional)" span>
          <Textarea id="se-notes" rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        </Campo>
      </FormSection>
      <FormActions enviando={salvando} rotulo={rotuloSalvar} onCancelar={onCancelar} extra={extra} />
    </form>
  );
}

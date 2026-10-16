import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { categoriaImc, decimalBR, imc } from "@/lib/alunos";
import { cn } from "@/lib/utils";
import { Campo, a11yCampo } from "@/components/Form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEhCelular } from "./useEhCelular";
import { TOM_TEXTO } from "./tons";

type Chave = "weightKg" | "heightCm" | "bodyFatPct" | "leanMassKg" | "restingHr" | "bpSys" | "bpDia" | "notes";
type Valores = Record<Chave, string>;

const CAMPOS: { k: Exclude<Chave, "notes">; label: string; inteiro?: boolean; grupo: string }[] = [
  { k: "weightKg", label: "Peso (kg)", grupo: "Antropometria" },
  { k: "heightCm", label: "Altura (cm)", grupo: "Antropometria" },
  { k: "bodyFatPct", label: "Gordura (%)", grupo: "Composição corporal" },
  { k: "leanMassKg", label: "Massa magra (kg)", grupo: "Composição corporal" },
  { k: "restingHr", label: "FC de repouso (bpm)", inteiro: true, grupo: "Cardiovascular" },
  { k: "bpSys", label: "PA sistólica (mmHg)", inteiro: true, grupo: "Cardiovascular" },
  { k: "bpDia", label: "PA diastólica (mmHg)", inteiro: true, grupo: "Cardiovascular" },
];

/** Nova avaliação física em painel, sobre a ficha (brief §2.4). Peso e altura vêm do cadastro. */
export function SheetAvaliacao({
  aberto,
  onAberto,
  alunoId,
  peso,
  altura,
  chaves,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  alunoId: string;
  peso: number | null;
  altura: number | null;
  chaves: readonly (readonly unknown[])[];
}) {
  const qc = useQueryClient();
  const celular = useEhCelular();
  const inicial = (): Valores => ({
    weightKg: peso != null ? String(peso).replace(".", ",") : "",
    heightCm: altura != null ? String(altura).replace(".", ",") : "",
    bodyFatPct: "",
    leanMassKg: "",
    restingHr: "",
    bpSys: "",
    bpDia: "",
    notes: "",
  });
  const [v, setV] = useState<Valores>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setV(inicial());
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const valorImc = imc(decimalBR(v.weightKg), decimalBR(v.heightCm));
  const cat = categoriaImc(valorImc);

  const salvar = useMutation({
    mutationFn: () => api(`/alunos/${alunoId}/avaliacoes`, { method: "POST", json: v }),
    onSuccess: () => {
      for (const k of chaves) void qc.invalidateQueries({ queryKey: k });
      toast.success("Avaliação salva.");
      onAberto(false);
    },
    onError: (e: Error) => {
      setErro(e.message);
      toast.error(`Não consegui salvar: ${e.message}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    salvar.mutate();
  }

  const grupos = [...new Set(CAMPOS.map((c) => c.grupo))];
  return (
    <Sheet open={aberto} onOpenChange={onAberto}>
      <SheetContent side={celular ? "bottom" : "right"} className={cn("overflow-y-auto", celular ? "max-h-[92dvh]" : "w-full sm:max-w-md")}>
        <SheetHeader>
          <SheetTitle>Nova avaliação</SheetTitle>
          <SheetDescription>Preencha o que mediu hoje. Campo vazio fica de fora.</SheetDescription>
        </SheetHeader>
        <form onSubmit={enviar} className="mt-4 space-y-5">
          {erro && (
            <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft px-3 py-2 text-caption text-negative">
              {erro}
            </p>
          )}
          {grupos.map((g) => (
            <fieldset key={g} className="space-y-3">
              <legend className="eyebrow">{g}</legend>
              <div className="grid grid-cols-2 gap-3">
                {CAMPOS.filter((c) => c.grupo === g).map((c) => (
                  <Campo key={c.k} id={`av-${c.k}`} label={c.label}>
                    <Input
                      {...a11yCampo(`av-${c.k}`)}
                      inputMode={c.inteiro ? "numeric" : "decimal"}
                      className="num"
                      value={v[c.k]}
                      onChange={(e) => setV((x) => ({ ...x, [c.k]: e.target.value }))}
                    />
                  </Campo>
                ))}
                {g === "Antropometria" && (
                  <p className="col-span-2 flex items-baseline gap-2 text-caption text-ink-mute" aria-live="polite">
                    IMC <span className={cn("num text-body font-medium", TOM_TEXTO[cat.tone])}>{valorImc != null ? String(valorImc).replace(".", ",") : "—"}</span>
                    {valorImc != null && <span>{cat.label}</span>}
                  </p>
                )}
              </div>
            </fieldset>
          ))}
          <Campo id="av-notes" label="Observações clínicas">
            <Textarea id="av-notes" rows={3} value={v.notes} onChange={(e) => setV((x) => ({ ...x, notes: e.target.value }))} placeholder="Boa progressão. Manter divisão e subir carga em puxada." />
          </Campo>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => onAberto(false)} disabled={salvar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Salvar avaliação
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

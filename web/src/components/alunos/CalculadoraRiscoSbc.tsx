import { useEffect, useId, useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { stratifySbc, sbcCategoryLabel, type ErgSex, type SbcCategory, type SbcLevel } from "$lib/clinical/sbc-risk";
import { decimalBR } from "@/lib/alunos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TOM: Record<SbcCategory, string> = {
  baixo: "border-positive/40 bg-positive-soft text-positive",
  intermediario: "border-warning/40 bg-warning-soft text-warning",
  alto: "border-negative/40 bg-negative-soft text-negative",
  muito_alto: "border-negative/40 bg-negative-soft text-negative",
};

const ehSexoBiologico = (s: string): s is ErgSex => s === "masculino" || s === "feminino";

/**
 * Escore de Risco Global da SBC (Framingham 2008, 10 anos). Porta de SbcRiskCalculator.svelte.
 * - `onNivel`: modo campo (cadastro). Emite o nível calculado, ou "baixo" sem exames.
 * - `onAplicar`: modo ficha. Mostra o botão "Aplicar ao perfil".
 */
export function CalculadoraRiscoSbc({
  idade,
  sexo,
  pasInicial = null,
  onNivel,
  onAplicar,
  aplicando = false,
}: {
  idade: number | null;
  sexo: string;
  pasInicial?: number | null;
  onNivel?: (nivel: SbcLevel) => void;
  onAplicar?: (nivel: SbcLevel) => void;
  aplicando?: boolean;
}) {
  const uid = useId();
  const [ct, setCt] = useState("");
  const [hdl, setHdl] = useState("");
  const [pas, setPas] = useState(pasInicial != null ? String(pasInicial) : "");
  const [flags, setFlags] = useState({ onBpMed: false, smoker: false, diabetes: false, establishedCvd: false, highRiskCondition: false });

  const resultado = useMemo(() => {
    const c = decimalBR(ct);
    const h = decimalBR(hdl);
    const p = decimalBR(pas);
    if (!ehSexoBiologico(sexo) || idade == null || !c || !h || !p) return null;
    return stratifySbc(
      { sex: sexo, age: idade, totalCholesterol: c, hdl: h, systolicBp: p, onBpMed: flags.onBpMed, smoker: flags.smoker, diabetes: flags.diabetes },
      { establishedCvd: flags.establishedCvd, highRiskCondition: flags.highRiskCondition },
    );
  }, [ct, hdl, pas, sexo, idade, flags]);

  const nivel: SbcLevel = resultado?.level ?? "baixo";
  useEffect(() => {
    onNivel?.(nivel);
  }, [nivel, onNivel]);

  const campos = [
    { id: "ct", label: "Colesterol total (mg/dL)", valor: ct, set: setCt, ph: "213" },
    { id: "hdl", label: "HDL (mg/dL)", valor: hdl, set: setHdl, ph: "50" },
    { id: "pas", label: "PA sistólica (mmHg)", valor: pas, set: setPas, ph: "140" },
  ];
  const marcas: { k: keyof typeof flags; label: string }[] = [
    { k: "onBpMed", label: "Em anti-hipertensivo" },
    { k: "smoker", label: "Tabagista" },
    { k: "diabetes", label: "Diabetes" },
    { k: "establishedCvd", label: "Doença aterosclerótica estabelecida (IAM/AVC/DAP prévios) → muito alto" },
    { k: "highRiskCondition", label: "Condição de alto risco (DRC, LDL ≥ 190, aterosclerose subclínica…) → alto" },
  ];

  return (
    <section aria-labelledby={`${uid}-t`} className="rounded-lg border border-line bg-bg-subtle p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-soft text-brand" aria-hidden>
          <HeartPulse className="size-4" />
        </span>
        <div>
          <h3 id={`${uid}-t`} className="text-body font-medium text-ink">
            Risco cardiovascular (SBC)
          </h3>
          <p className="eyebrow">Escore de Risco Global · 10 anos</p>
        </div>
      </div>

      {!ehSexoBiologico(sexo) ? (
        <p className="mt-4 text-body text-warning">O escore exige sexo biológico (masculino ou feminino). Ajuste o sexo do aluno.</p>
      ) : idade == null ? (
        <p className="mt-4 text-body text-warning">Falta a data de nascimento, que o escore precisa.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {campos.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={`${uid}-${f.id}`}>{f.label}</Label>
                <Input
                  id={`${uid}-${f.id}`}
                  inputMode="decimal"
                  className="num"
                  placeholder={f.ph}
                  value={f.valor}
                  onChange={(e) => f.set(e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {marcas.map((m, i) => (
              <div key={m.k} className={cn("flex items-start gap-2", i >= 3 && "sm:col-span-3")}>
                <Checkbox
                  id={`${uid}-${m.k}`}
                  checked={flags[m.k]}
                  onCheckedChange={(v) => setFlags((f) => ({ ...f, [m.k]: v === true }))}
                  className="mt-0.5"
                />
                <Label htmlFor={`${uid}-${m.k}`} className="text-body font-normal leading-snug text-ink-soft">
                  {m.label}
                </Label>
              </div>
            ))}
          </div>

          {resultado ? (
            <div className="space-y-2" aria-live="polite">
              <div className={cn("flex items-baseline gap-3 rounded-lg border px-4 py-3", TOM[resultado.category])}>
                <span className="num text-h5 font-semibold">{resultado.reclassified ? "—" : `${resultado.riskPct}%`}</span>
                <span>
                  <span className="block text-body font-semibold">{sbcCategoryLabel(resultado.category)}</span>
                  <span className="eyebrow block">risco em 10 anos</span>
                </span>
              </div>
              {resultado.notes.map((n) => (
                <p key={n} className="text-caption text-ink-mute">
                  {n}
                </p>
              ))}
              {onAplicar && (
                <Button size="sm" disabled={aplicando} onClick={() => onAplicar(resultado.level)}>
                  {aplicando ? "Salvando…" : `Aplicar ao perfil (${sbcCategoryLabel(resultado.category)})`}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-caption text-ink-mute">
              Preencha colesterol total, HDL e PA sistólica para calcular
              {onNivel ? ". Sem os exames, o cadastro fica com risco baixo e você recalcula na ficha." : "."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

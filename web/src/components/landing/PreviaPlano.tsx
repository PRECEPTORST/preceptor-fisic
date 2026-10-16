import { useRef, type CSSProperties, type PointerEvent } from "react";
import { BookOpen, ShieldCheck, TriangleAlert } from "lucide-react";

const g = (n: number) => ({ ["--g" as string]: n }) as CSSProperties;

/**
 * Prévia do produto no hero: um plano gerado como aparece no app, com fontes
 * citadas e uma restrição validada. HTML/CSS, não imagem. Aluno fictício.
 */
export function PreviaPlano() {
  const ref = useRef<HTMLElement>(null);
  // Inclina até 4° na direção do ponteiro (só mouse; reduced-motion zera no CSS).
  const mover = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
  };
  const soltar = () => {
    ref.current?.style.removeProperty("--rx");
    ref.current?.style.removeProperty("--ry");
  };
  return (
    <figure
      ref={ref}
      onPointerMove={mover}
      onPointerLeave={soltar}
      aria-label="Exemplo de plano gerado para um aluno com hipertensão"
      className="lp-flutua relative overflow-hidden rounded-lg border border-line bg-bg-elevated text-left shadow-pop"
    >
      <span aria-hidden="true" className="lp-barra absolute inset-x-0 top-0 h-0.5 bg-brand" />
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="eyebrow">Plano gerado · exemplo</p>
          <p className="mt-1 truncate text-body font-medium text-ink">Aluno com hipertensão estágio 1, 58 anos</p>
        </div>
        <span className="relative shrink-0">
          <span aria-hidden="true" className="lp-estado-gerando absolute right-0 top-0 whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-caption font-medium text-brand">
            Gerando…
          </span>
          <span className="lp-estado-validado block rounded-full bg-positive-soft px-2.5 py-1 text-caption font-medium text-positive">
            Validado
          </span>
        </span>
      </div>

      <ul className="divide-y divide-line">
        {[
          { nome: "Caminhada em esteira", dose: "30 min · 40–60% FCR", fonte: "1" },
          { nome: "Leg press", dose: "2 × 12 · RPE 5–6", fonte: "2" },
          { nome: "Remada sentada", dose: "2 × 12 · sem apneia", fonte: "2" },
        ].map((e, i) => (
          <li key={e.nome} style={g(i)} className="lp-gera flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-body text-ink">{e.nome}</p>
              <p className="num text-caption text-ink-mute">{e.dose}</p>
            </div>
            <span className="num shrink-0 rounded border border-line px-1.5 py-0.5 text-caption text-ink-soft">
              [{e.fonte}]
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-5 py-4">
        <div style={g(3)} className="lp-gera flex gap-3 rounded-md border border-warning/30 bg-warning-soft p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-caption">
            <p className="font-medium text-ink">Cuidado: evitar manobra de Valsalva</p>
            <p className="text-ink-soft">Respiração contínua nas séries de força. Regra clínica de hipertensão.</p>
          </div>
        </div>
        <div style={g(4)} className="lp-gera mt-3 flex items-center gap-2 text-caption text-ink-soft">
          <ShieldCheck className="size-4 text-positive" aria-hidden="true" />
          23 regras clínicas conferidas antes de publicar
        </div>
      </div>

      <figcaption style={g(5)} className="lp-gera space-y-1.5 border-t border-line bg-bg-subtle px-5 py-4 text-caption">
        <p className="eyebrow flex items-center gap-1.5">
          <BookOpen className="size-3.5" aria-hidden="true" /> Fontes citadas
        </p>
        <p className="text-ink-soft">
          <span className="num text-ink-mute">[1]</span> ACC/AHA · Diretriz de Hipertensão (2025)
        </p>
        <p className="text-ink-soft">
          <span className="num text-ink-mute">[2]</span> ACSM · Guidelines for Exercise Testing and Prescription
        </p>
      </figcaption>
    </figure>
  );
}

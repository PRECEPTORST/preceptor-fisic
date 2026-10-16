import type { ReactNode } from "react";

/** Número com rótulo (brief §5: número sempre mono/tabular). */
export function Stat({ label, valor, extra }: { label: ReactNode; valor: ReactNode; extra?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
      <p className="eyebrow">{label}</p>
      <p className="num mt-3 text-h3 font-medium text-ink">{valor}</p>
      {extra && <p className="num mt-1 text-caption text-ink-mute">{extra}</p>}
    </div>
  );
}

import { useMemo } from "react";
import { caminho, externa, recortar, veredito, type Metrica, type SemanaCarga } from "@/lib/carga";
import { numero } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Mini-série. A cor vem de uma classe de texto (token), aplicada via currentColor. */
export function Sparkline({ valores, className, largura = 96, altura = 24, rotulo }: { valores: number[]; className?: string; largura?: number; altura?: number; rotulo?: string }) {
  if (valores.length < 2) return null;
  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura}
      height={altura}
      className={cn("shrink-0 overflow-visible", className)}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      <path d={caminho(valores, largura, altura)} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const W = 640;
const H = 180;
const TOM_VEREDITO = { positive: "text-positive", warning: "text-warning", neutral: "text-ink-soft" } as const;

/** Carga externa (tonelagem ou volume) × interna (PSE × duração), cada uma na própria escala. */
export function GraficoCarga({ semanas, metrica }: { semanas: SemanaCarga[]; metrica: Metrica }) {
  const pts = useMemo(() => recortar(semanas), [semanas]);
  const v = useMemo(() => veredito(semanas, metrica), [semanas, metrica]);
  const ext = pts.map((w) => externa(w, metrica));
  const int = pts.map((w) => w.internalLoad);
  const ultima = [...pts].reverse().find((w) => w.sessions > 0);
  const passo = Math.max(1, Math.ceil(pts.length / 6));
  const unidade = metrica === "tonnage" ? "kg" : "reps";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("text-body font-semibold", TOM_VEREDITO[v.tom])}>{v.label}</span>
        <span className="text-caption text-ink-mute">{v.detalhe}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 22}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Carga das últimas ${pts.length} semanas. ${v.label}.`}
      >
        {[0.25, 0.5, 0.75].map((y) => (
          <line key={y} x1={0} x2={W} y1={H * y} y2={H * y} className="text-line" stroke="currentColor" strokeWidth={1} />
        ))}
        <path d={caminho(ext, W, H, 8)} fill="none" stroke="currentColor" strokeWidth={2.25} className="text-brand" strokeLinejoin="round" />
        <path d={caminho(int, W, H, 8)} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="5 4" className="text-info" strokeLinejoin="round" />
        {pts.map((w, i) =>
          i % passo === 0 || i === pts.length - 1 ? (
            <text
              key={w.weekStart + i}
              x={8 + (pts.length === 1 ? (W - 16) / 2 : (i / (pts.length - 1)) * (W - 16))}
              y={H + 16}
              textAnchor="middle"
              className="fill-current font-mono text-[11px] text-ink-mute"
            >
              {w.weekLabel}
            </text>
          ) : null,
        )}
      </svg>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-caption">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-brand" aria-hidden />
          <dt className="text-ink-mute">Externa ({metrica === "tonnage" ? "peso levantado" : "volume"})</dt>
          <dd className="num text-ink">{ultima ? `${numero(Math.round(externa(ultima, metrica)))} ${unidade}` : "—"}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-info" aria-hidden />
          <dt className="text-ink-mute">Interna (PSE × min)</dt>
          <dd className="num text-ink">{ultima ? `${numero(Math.round(ultima.internalLoad))} UA` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

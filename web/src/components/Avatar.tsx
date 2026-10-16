import { cn } from "@/lib/utils";

/** Iniciais sobre um tom derivado do nome (estável entre visitas). */
export function hueDoNome(nome: string): number {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const a = partes[0]?.[0] ?? "?";
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

export function Avatar({ nome, size = 36, className }: { nome: string; size?: number; className?: string }) {
  const h = hueDoNome(nome);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium text-ink", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `hsl(${h} 45% var(--avatar-l, 22%))`,
        boxShadow: "inset 0 0 0 1px var(--c-border)",
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

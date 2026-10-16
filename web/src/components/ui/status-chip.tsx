import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "brand" | "warning" | "positive" | "negative" | "info";

const TONE: Record<StatusTone, string> = {
  neutral: "text-ink-mute bg-bg-subtle border-line",
  brand: "text-brand bg-brand-soft border-brand/40",
  warning: "text-warning bg-warning-soft border-warning/40",
  positive: "text-positive bg-positive-soft border-positive/40",
  negative: "text-negative bg-negative-soft border-negative/40",
  info: "text-info bg-info-soft border-info/40",
};

interface StatusChipProps {
  tone?: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

/** Chip de estado. O mapeamento estado → tom fica no domínio (ex.: lib/planos.ts), não aqui. */
export function StatusChip({ tone = "neutral", children, dot = true, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-micro uppercase",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

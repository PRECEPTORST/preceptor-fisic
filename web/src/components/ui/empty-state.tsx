import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Glifo grande em mono (padrão Cockpit), ex.: "/00". */
  decorative?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ decorative = "/00", title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? "py-10" : "py-20"}`}>
      <div
        className="select-none font-mono font-medium leading-none text-brand opacity-30"
        style={{ fontSize: compact ? 48 : "clamp(64px, 9vw, 96px)", letterSpacing: "-0.02em" }}
        aria-hidden
      >
        {decorative}
      </div>
      <h3 className="mt-6 text-h6 font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-[420px] text-body text-ink-mute">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

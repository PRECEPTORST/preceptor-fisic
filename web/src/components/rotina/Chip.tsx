import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Chip de filtro (toggle). aria-pressed diz ao leitor de tela qual está ativo. */
export function Chip({ ativo, onClick, children }: { ativo?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-caption transition-colors",
        ativo
          ? "border-brand/50 bg-brand-soft text-brand"
          : "border-line bg-bg-elevated text-ink-soft hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Linha de filtros com rótulo pequeno. No celular rola na horizontal em vez de quebrar em várias linhas. */
export function LinhaFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="flex items-center gap-2">
      <span className="eyebrow w-14 shrink-0">{rotulo}</span>
      <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {children}
      </div>
    </div>
  );
}

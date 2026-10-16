import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Seção de formulário (brief §4.6): eyebrow + descrição + grid 1→2 colunas. */
export function FormSection({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-bg-elevated p-5 shadow-card", className)}>
      <h2 className="eyebrow">{titulo}</h2>
      {descricao && <p className="mt-1 text-caption text-ink-mute">{descricao}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Campo: Label + controle + dica/erro ligados por aria-describedby. Use `span` no grid para ocupar 2 colunas. */
export function Campo({
  id,
  label,
  erro,
  dica,
  span,
  children,
}: {
  id: string;
  label: ReactNode;
  erro?: string | null;
  dica?: ReactNode;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", span && "sm:col-span-2")}>
      <label htmlFor={id} className="text-body font-medium text-ink">
        {label}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-caption text-negative">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-caption text-ink-mute">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

/** Props de acessibilidade para o controle dentro de <Campo>. */
export function a11yCampo(id: string, erro?: string | null, dica?: boolean) {
  return {
    id,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": erro ? `${id}-erro` : dica ? `${id}-dica` : undefined,
  } as const;
}

/** Barra fixa de ações no rodapé (Cancelar / Salvar). */
export function FormActions({
  enviando,
  rotulo = "Salvar",
  onCancelar,
  extra,
  desabilitado,
}: {
  enviando?: boolean;
  rotulo?: string;
  onCancelar?: () => void;
  extra?: ReactNode;
  desabilitado?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center gap-2 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex-1">{extra}</div>
      {onCancelar && (
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
      )}
      <Button type="submit" disabled={enviando || desabilitado}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />}
        {rotulo}
      </Button>
    </div>
  );
}

/** Pede confirmação ao fechar/recarregar a aba com alterações não salvas. */
export function useAvisoSaida(sujo: boolean) {
  useEffect(() => {
    if (!sujo) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [sujo]);
}

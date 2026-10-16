import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/**
 * Padrão de tela do Cockpit em um componente: carregando → skeleton no
 * formato final; erro → mensagem + tentar de novo; vazio → EmptyState.
 * A auditoria achou 41 de 43 páginas sem estado de carregando.
 */
export function QueryState<T>({
  query,
  skeleton,
  empty,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton?: ReactNode;
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <SkeletonLista />}</>;
  if (query.isError)
    return (
      <div role="alert" className="rounded-lg border border-negative/40 bg-negative-soft p-4 text-body">
        <p className="font-medium text-negative">Não consegui carregar.</p>
        <p className="mt-1 text-ink-soft">{query.error.message}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => query.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

export function SkeletonLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

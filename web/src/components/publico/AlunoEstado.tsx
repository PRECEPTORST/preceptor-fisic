import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { QueryState } from "@/components/QueryState";
import { EmptyState } from "@/components/ui/empty-state";

/** QueryState do app do aluno: link inválido (401) ganha tela própria, sem "tentar de novo". */
export function AlunoEstado<T>(props: {
  query: UseQueryResult<T>;
  skeleton: ReactNode;
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (d: T) => ReactNode;
}) {
  const e = props.query.error;
  if (e instanceof ApiError && e.status === 401) {
    return (
      <EmptyState
        decorative="/401"
        title="Este link não vale mais"
        description="Ele pode ter sido trocado pelo seu treinador ou estar incompleto. Peça um link novo para ele."
      />
    );
  }
  return <QueryState {...props} />;
}

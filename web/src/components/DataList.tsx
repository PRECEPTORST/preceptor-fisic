import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type Coluna<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Classes da célula (largura, alinhamento). Números: "text-right num". */
  className?: string;
  /** Esconde no card mobile (informação secundária). */
  ocultarNoMobile?: boolean;
};

/**
 * Lista responsiva (brief §4.5): tabela no desktop, cards abaixo de md.
 * A linha inteira é um Link quando `href` existe (teclado e leitor de tela ok).
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  href,
  primary,
  caption,
}: {
  rows: T[];
  columns: Coluna<T>[];
  rowKey: (r: T) => string;
  href?: (r: T) => string;
  /** Conteúdo principal do card mobile (ex.: avatar + nome). Padrão: 1ª coluna. */
  primary?: (r: T) => ReactNode;
  caption?: string;
}) {
  const [primeira, ...resto] = columns;
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card">
      <table className="hidden w-full text-body md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn("eyebrow px-4 py-3 text-left font-normal", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="relative transition-colors hover:bg-bg-subtle">
              {columns.map((c, i) => (
                <td key={c.id} className={cn("px-4 py-3 align-middle", c.className)}>
                  {i === 0 && href ? (
                    <Link to={href(r)} className="after:absolute after:inset-0 focus-visible:outline-none">
                      {c.cell(r)}
                    </Link>
                  ) : (
                    c.cell(r)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => {
          const corpo = (
            <>
              <div className="min-w-0">{primary ? primary(r) : primeira?.cell(r)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {resto
                  .filter((c) => !c.ocultarNoMobile)
                  .map((c) => (
                    <div key={c.id} className="min-w-0">
                      <dt className="eyebrow text-micro">{c.header}</dt>
                      <dd className="truncate text-caption text-ink-soft">{c.cell(r)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(r)}>
              {href ? (
                <Link to={href(r)} className="block px-4 py-3 active:bg-bg-subtle">
                  {corpo}
                </Link>
              ) : (
                <div className="px-4 py-3">{corpo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

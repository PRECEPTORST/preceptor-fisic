// Mesmo contrato de src/lib/server/sessao.ts (ROTAS_LIVRES): sem acesso, só estas abrem.
export const ROTAS_LIVRES = ["/upgrade", "/assinatura", "/configuracoes", "/guia", "/convite"];

export function rotaLivre(pathname: string): boolean {
  return ROTAS_LIVRES.some((p) => pathname.startsWith(p));
}

/** Para onde mandar depois do login: só caminho interno (evita open redirect). */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

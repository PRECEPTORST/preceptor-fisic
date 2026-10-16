// Formatação pt-BR. Números sempre renderizados com a classe `num`.
const nf = new Intl.NumberFormat("pt-BR");
const df = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dtf = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const numero = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
export const data = (d: string | Date | null | undefined) => (d ? df.format(new Date(d)) : "—");
export const dataHora = (d: string | Date | null | undefined) => (d ? dtf.format(new Date(d)) : "—");

/** "há 3 dias", "hoje", "ontem". */
export function diasAtras(dias: number | null | undefined): string {
  if (dias == null) return "nunca";
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

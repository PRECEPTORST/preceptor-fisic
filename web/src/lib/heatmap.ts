/** Nível 0–4 de uma célula do heatmap, relativo ao máximo do período. */
export function nivel(valor: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (valor <= 0 || max <= 0) return 0;
  const r = valor / max;
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}

/** 182 dias (mais antigo primeiro) → 26 colunas de 7. */
export function semanas(cells: number[]): number[][] {
  const out: number[][] = [];
  for (let w = 0; w < 26; w++) out.push(cells.slice(w * 7, w * 7 + 7));
  return out;
}

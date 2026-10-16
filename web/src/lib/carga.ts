// Evolução de carga (externa × interna): lógica pura do gráfico da ficha.
// Porta de src/lib/components/ui/load-chart.svelte.

export type SemanaCarga = {
  weekStart: string;
  weekLabel: string;
  tonnage: number;
  repVolume: number;
  internalLoad: number;
  sessions: number;
  avgRpe: number | null;
};
export type Metrica = "tonnage" | "volume";

export const externa = (w: SemanaCarga, m: Metrica) => (m === "tonnage" ? w.tonnage : w.repVolume);

/** Corta as semanas vazias antes da primeira sessão. */
export function recortar(semanas: SemanaCarga[]): SemanaCarga[] {
  const i = semanas.findIndex((w) => w.sessions > 0);
  return i < 0 ? semanas : semanas.slice(i);
}

export type Veredito = { label: string; tom: "positive" | "warning" | "neutral"; detalhe: string };

/** Compara a metade recente com a antiga das semanas com treino (precisa de 4). */
export function veredito(semanas: SemanaCarga[], m: Metrica): Veredito {
  const ativas = recortar(semanas).filter((w) => w.sessions > 0 && externa(w, m) > 0 && w.internalLoad > 0);
  if (ativas.length < 4) {
    return {
      label: "Coletando dados",
      tom: "neutral",
      detalhe: `Precisa de ~4 semanas de treino para avaliar a tendência (tem ${ativas.length}).`,
    };
  }
  const meio = Math.floor(ativas.length / 2);
  const antigas = ativas.slice(0, meio);
  const recentes = ativas.slice(meio);
  const media = (arr: SemanaCarga[], f: (w: SemanaCarga) => number) => arr.reduce((s, w) => s + f(w), 0) / arr.length;
  const extA = media(antigas, (w) => externa(w, m));
  const extR = media(recentes, (w) => externa(w, m));
  const dExt = extA > 0 ? ((extR - extA) / extA) * 100 : 0;
  const custo = (w: SemanaCarga) => w.internalLoad / Math.max(1, externa(w, m));
  const cA = media(antigas, custo);
  const cR = media(recentes, custo);
  const dCusto = cA > 0 ? ((cR - cA) / cA) * 100 : 0;

  if (dExt >= 8 && dCusto <= 5)
    return {
      label: "Adaptando bem",
      tom: "positive",
      detalhe: `Carga externa +${dExt.toFixed(0)}% e o custo interno se manteve. O corpo aguenta mais trabalho pelo mesmo esforço.`,
    };
  if (dExt >= 8 && dCusto > 20)
    return {
      label: "Carga subindo rápido",
      tom: "warning",
      detalhe: `Carga +${dExt.toFixed(0)}%, mas o custo interno subiu ${dCusto.toFixed(0)}%. Atenção à fadiga acumulada.`,
    };
  if (Math.abs(dExt) < 8 && dCusto <= -8)
    return {
      label: "Condicionando",
      tom: "positive",
      detalhe: `Mesma carga externa com custo interno ${Math.abs(dCusto).toFixed(0)}% menor. Sinal claro de condicionamento.`,
    };
  if (dExt <= -15)
    return {
      label: "Volume caindo",
      tom: "warning",
      detalhe: `Carga externa ${dExt.toFixed(0)}%. Pausa, lesão ou desmotivação? Vale conversar.`,
    };
  return { label: "Estável", tom: "neutral", detalhe: "Carga e esforço consistentes nas últimas semanas." };
}

/** Path SVG de uma série normalizada em [0,1] dentro de w×h, com respiro `pad`. */
export function caminho(valores: number[], w: number, h: number, pad = 2): string {
  if (valores.length === 0) return "";
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const span = max - min || 1;
  const n = valores.length;
  const x = (i: number) => pad + (n === 1 ? (w - 2 * pad) / 2 : (i / (n - 1)) * (w - 2 * pad));
  const y = (v: number) => pad + (h - 2 * pad) * (1 - (v - min) / span);
  return valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

import { describe, expect, it } from "vitest";
import {
  aplicarFiltro,
  diasDaSemana,
  duracaoValida,
  faixaDeHoras,
  filtrarConversas,
  filtrarMeus,
  horaCurta,
  paraInputs,
  parseContraindicacoes,
  posterDoVideo,
  resumoDaSemana,
  sessoesDoDia,
  type SessaoAgenda,
} from "./rotina";

const s = (id: string, h: number, m: number, dur: number, extra: Partial<SessaoAgenda> = {}): SessaoAgenda => ({
  id,
  startsAt: new Date(2026, 9, 14, h, m).toISOString(),
  durationMinutes: dur,
  type: "treino",
  status: "scheduled",
  label: null,
  studentName: null,
  ...extra,
});

describe("exercícios", () => {
  it("parseContraindicacoes separa por vírgula, ; e quebra de linha", () => {
    expect(parseContraindicacoes(" joelho, lombar;\nombro ,, ")).toEqual(["joelho", "lombar", "ombro"]);
    expect(parseContraindicacoes("")).toEqual([]);
  });
  it("posterDoVideo troca .gif por .jpg", () => {
    expect(posterDoVideo("https://x/a.gif")).toBe("https://x/a.jpg");
    expect(posterDoVideo("https://x/a.mp4")).toBe("https://x/a.mp4");
  });
  it("filtrarMeus casa grupo, equipamento e busca em nome/padrão/equipamento", () => {
    const l = [
      { name: "Agachamento", muscleGroup: "Membros inferiores", equipment: "Barra", pattern: "Squat" },
      { name: "Remada", muscleGroup: "Costas", equipment: "Polia", pattern: "Pull" },
    ];
    expect(filtrarMeus(l, { grupo: "Costas", equipamento: "", busca: "" })).toHaveLength(1);
    expect(filtrarMeus(l, { grupo: "", equipamento: "", busca: "squat" })[0]!.name).toBe("Agachamento");
    expect(filtrarMeus(l, { grupo: "", equipamento: "Barra", busca: "remada" })).toHaveLength(0);
  });
  it("aplicarFiltro zera a página ao trocar filtro e remove vazios", () => {
    const u = aplicarFiltro(new URLSearchParams("q=sup&page=3&bp=back"), { bp: "" });
    expect(u.toString()).toBe("q=sup");
    expect(aplicarFiltro(new URLSearchParams("q=a"), { page: "2" }).get("page")).toBe("2");
  });
});

describe("agenda", () => {
  it("diasDaSemana devolve 7 dias seguidos", () => {
    const d = diasDaSemana(new Date(2026, 9, 12));
    expect(d).toHaveLength(7);
    expect(d[6]!.getDate()).toBe(18);
  });
  it("faixaDeHoras expande para sessões cedo e tarde", () => {
    expect(faixaDeHoras([])).toEqual(Array.from({ length: 13 }, (_, i) => 7 + i));
    const f = faixaDeHoras([s("a", 5, 30, 60), s("b", 21, 0, 60)]);
    expect(f[0]).toBe(5);
    expect(f[f.length - 1]).toBe(21);
  });
  it("sessoesDoDia põe sobrepostas lado a lado", () => {
    const r = sessoesDoDia([s("a", 9, 0, 60), s("b", 9, 30, 60), s("c", 11, 0, 30)], new Date(2026, 9, 14));
    expect(r.map((x) => [x.id, x.col, x.cols])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
    expect(sessoesDoDia([s("a", 9, 0, 60)], new Date(2026, 9, 15))).toHaveLength(0);
  });
  it("resumoDaSemana ignora canceladas", () => {
    const r = resumoDaSemana([
      { type: "treino", status: "scheduled" },
      { type: "avaliacao", status: "completed" },
      { type: "treino", status: "cancelled" },
    ]);
    expect(r.total).toBe(2);
    expect(r.canceladas).toBe(1);
    expect(r.porTipo.find((t) => t.id === "treino")!.n).toBe(1);
  });
  it("paraInputs usa data e hora locais", () => {
    expect(paraInputs(new Date(2026, 0, 5, 7, 3))).toEqual({ date: "2026-01-05", time: "07:03" });
  });
  it("duracaoValida aceita 15 a 240 inteiros", () => {
    expect(duracaoValida(15)).toBe(true);
    expect(duracaoValida(240)).toBe(true);
    expect(duracaoValida(10)).toBe(false);
    expect(duracaoValida(Number.NaN)).toBe(false);
    expect(duracaoValida(30.5)).toBe(false);
  });
});

describe("mensagens", () => {
  const agora = new Date(2026, 9, 16, 15, 0);
  it("horaCurta", () => {
    expect(horaCurta(null, agora)).toBe("—");
    expect(horaCurta(new Date(2026, 9, 16, 9, 5), agora)).toBe("09:05");
    expect(horaCurta(new Date(2026, 9, 15, 20, 0), agora)).toBe("ontem");
    expect(horaCurta(new Date(2026, 9, 12, 15, 0), agora)).toBe("4d");
  });
  it("filtrarConversas por nome e não lidas", () => {
    const l = [
      { studentName: "Ana Souza", unread: 0 },
      { studentName: "Bruno", unread: 2 },
    ];
    expect(filtrarConversas(l, "ana", false)).toHaveLength(1);
    expect(filtrarConversas(l, "", true)[0]!.studentName).toBe("Bruno");
  });
});

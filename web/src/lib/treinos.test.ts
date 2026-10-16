import { describe, expect, it } from "vitest";
import {
  camposFoco,
  citacao,
  concluido,
  dataBR,
  filtrarPlanos,
  fmtCadencia,
  fmtIntensidade,
  fmtPausa,
  idade,
  intensidadeUsada,
  linhasForca,
  mensagemValidacao,
  objetivoCapa,
  seriesFeitas,
  seriesRegistradas,
  statusLabel,
  termoInicial,
} from "./treinos";

describe("treinos", () => {
  it("filtra planos: gerando conta como ativo", () => {
    const p = [
      { id: 1, isActive: true, status: "published" },
      { id: 2, isActive: false, status: "generating" },
      { id: 3, isActive: false, status: "archived" },
    ];
    expect(filtrarPlanos(p, "todos")).toHaveLength(3);
    expect(filtrarPlanos(p, "ativos").map((x) => x.id)).toEqual([1, 2]);
    expect(filtrarPlanos(p, "encerrados").map((x) => x.id)).toEqual([3]);
    expect(statusLabel("generated")).toBe("Rascunho");
  });

  it("termo inicial da troca vem do grupo muscular ou do nome", () => {
    expect(termoInicial({ name: "Rosca", muscle_groups: ["bíceps braquial"] })).toBe("bíceps");
    expect(termoInicial({ name: "Rosca bíceps" })).toBe("Rosca");
    expect(termoInicial(undefined)).toBe("");
  });

  it("citação resolve regra, diretriz e inferência", () => {
    const map = {
      c1: { chunkId: "c1", sourceId: "s", title: "Guia", organization: "acsm", year: 2021, pageNumber: 4, excerpt: "x" },
    };
    expect(citacao({ type: "rule", rule_code: "R01" }, map).label).toBe("Regra R01");
    expect(citacao({ chunk_id: "c1" }, map).label).toBe("ACSM, 2021 · p.4 — Guia");
    expect(citacao({ type: "inference" }, map).label).toBe("Inferência clínica");
    expect(citacao(null, map).label).toBe("");
  });

  it("mensagem de validação avisa violações", () => {
    expect(mensagemValidacao("Plano atualizado.", { violations: 2 }).tipo).toBe("warning");
    expect(mensagemValidacao("Plano atualizado.", { violations: 0 }).tipo).toBe("success");
    expect(mensagemValidacao("Plano atualizado.", null).texto).toBe("Plano atualizado.");
  });

  it("séries registradas não inventam carga", () => {
    expect(seriesRegistradas({ set_logs: [{ weight: 20, reps: 10 }] })).toEqual([{ weight: 20, reps: 10 }]);
    expect(seriesRegistradas({ sets_done: 2, load_used: "12,5kg", reps_done: "10" })).toEqual([
      { weight: 12.5, reps: "10" },
      { weight: 12.5, reps: "10" },
    ]);
    expect(seriesRegistradas({ sets_done: 1, load_used: "leve" })[0]?.weight).toBeNull();
    expect(seriesRegistradas(null)).toEqual([]);
  });

  it("logs: concluído, séries feitas e intensidade", () => {
    const logs = [
      { id: "1", sessionDate: "2026-10-01", sessionLabel: "A", perceivedEffort: 7, exercisesDone: [{ name: "Supino", sets_done: 3, intensity_used: 70 }] },
    ];
    expect(concluido(logs, "Supino")).toBe(true);
    expect(concluido(logs, "Remada")).toBe(false);
    expect(seriesFeitas(logs, "Supino")).toBe(3);
    expect(intensidadeUsada(logs, "Supino")).toBe(70);
  });

  it("datas e idade sem erro de fuso", () => {
    expect(dataBR("1990-05-10")).toBe("10/05/1990");
    expect(dataBR(null)).toBe("—");
    expect(idade("1990-05-10", new Date(2026, 4, 9))).toBe(35);
    expect(idade("1990-05-10", new Date(2026, 4, 10))).toBe(36);
  });

  it("ficha impressa", () => {
    expect(fmtPausa({ name: "x", rest_seconds: 120 })).toBe("2min");
    expect(fmtPausa({ name: "x", rest_seconds: 45 })).toBe("45s");
    expect(fmtPausa({ name: "x", rest_seconds: 0 })).toBe("-");
    expect(fmtCadencia({ name: "x", muscle_action: "isotonica" })).toBe("2/2");
    expect(fmtCadencia({ name: "x", muscle_action: "isometrica" })).toBe("-");
    expect(fmtIntensidade({ name: "x", intensity: "70% 1RM", load_guidance: "PSE 7" })).toBe("70% 1RM · PSE 7");
    expect(linhasForca({ warmup: [{ name: "a" }], main: [{ name: "b" }] }).map((r) => r.tag)).toEqual(["aquecimento", undefined]);
    expect(objetivoCapa("", ["hipertrofia"], "s")).toContain("hipertrofia");
    expect(objetivoCapa("", [], "")).toBe("—");
  });

  it("campos de foco acompanham o número de sessões", () => {
    expect(camposFoco(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(camposFoco(["a"], 3)).toEqual(["a", "", ""]);
  });
});

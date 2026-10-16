import { beforeEach, describe, expect, it } from "vitest";
import { alternarTema, aplicarTema, CHAVE_TEMA, lerTema, normalizarTema } from "./theme";

describe("tema — escuro é o padrão, claro é opcional", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light");
  });

  it("storage vazio ou lixo cai no escuro", () => {
    expect(normalizarTema(null)).toBe("escuro");
    expect(normalizarTema("light")).toBe("escuro");
    expect(normalizarTema("qualquer")).toBe("escuro");
    expect(lerTema()).toBe("escuro");
  });

  it("aplicar claro põe a classe e persiste; escuro remove", () => {
    aplicarTema("claro");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem(CHAVE_TEMA)).toBe("claro");
    aplicarTema("escuro");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("alternar é simétrico", () => {
    expect(alternarTema()).toBe("claro");
    expect(alternarTema()).toBe("escuro");
  });
});

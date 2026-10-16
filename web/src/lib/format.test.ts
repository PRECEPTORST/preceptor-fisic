import { describe, expect, it } from "vitest";
import { diasAtras, numero, pct } from "./format";

describe("format", () => {
  it("diasAtras", () => {
    expect(diasAtras(null)).toBe("nunca");
    expect(diasAtras(0)).toBe("hoje");
    expect(diasAtras(1)).toBe("ontem");
    expect(diasAtras(5)).toBe("há 5 dias");
  });
  it("numero e pct tratam vazio", () => {
    expect(numero(null)).toBe("—");
    expect(numero(1234)).toBe("1.234");
    expect(pct(66.6)).toBe("67%");
  });
});

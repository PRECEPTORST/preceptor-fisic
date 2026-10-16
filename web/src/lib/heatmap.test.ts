import { describe, expect, it } from "vitest";
import { nivel, semanas } from "./heatmap";

describe("heatmap", () => {
  it("nivel", () => {
    expect(nivel(0, 10)).toBe(0);
    expect(nivel(5, 0)).toBe(0);
    expect(nivel(1, 10)).toBe(1);
    expect(nivel(10, 10)).toBe(4);
  });
  it("semanas", () => {
    const s = semanas(Array.from({ length: 182 }, (_, i) => i));
    expect(s).toHaveLength(26);
    expect(s[25]?.[6]).toBe(181);
  });
});

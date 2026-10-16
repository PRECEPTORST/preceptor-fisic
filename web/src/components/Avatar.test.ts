import { describe, expect, it } from "vitest";
import { hueDoNome, iniciais } from "./Avatar";

describe("Avatar", () => {
  it("iniciais", () => {
    expect(iniciais("Ana Paula Souza")).toBe("AS");
    expect(iniciais("ana")).toBe("A");
    expect(iniciais("  ")).toBe("?");
  });
  it("hue é estável e dentro de 0–359", () => {
    expect(hueDoNome("Carla")).toBe(hueDoNome("Carla"));
    expect(hueDoNome("Carla")).toBeLessThan(360);
  });
});

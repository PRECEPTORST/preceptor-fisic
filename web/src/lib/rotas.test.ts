import { describe, expect, it } from "vitest";
import { destinoSeguro, rotaLivre } from "./rotas";

describe("rotas", () => {
  it("destinoSeguro barra open redirect", () => {
    expect(destinoSeguro("https://evil.com")).toBe("/dashboard");
    expect(destinoSeguro("//evil.com")).toBe("/dashboard");
    expect(destinoSeguro("/\\evil.com")).toBe("/dashboard");
    expect(destinoSeguro(null)).toBe("/dashboard");
    expect(destinoSeguro("/alunos/1?x=2")).toBe("/alunos/1?x=2");
  });
  it("rotaLivre", () => {
    expect(rotaLivre("/upgrade")).toBe(true);
    expect(rotaLivre("/guia/x")).toBe(true);
    expect(rotaLivre("/alunos")).toBe(false);
  });
});

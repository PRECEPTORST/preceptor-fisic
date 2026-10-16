import { describe, expect, it } from "vitest";
import {
  chavePlano,
  erroDeSenha,
  mascaraCpf,
  numerosDoAcervo,
  planoDaUrl,
  rotuloPlano,
  tokenDeRecuperacao,
  usoDoPool,
  validarTeto,
} from "./conta";

describe("conta", () => {
  it("mascaraCpf formata e corta em 11 dígitos", () => {
    expect(mascaraCpf("12345678909")).toBe("123.456.789-09");
    expect(mascaraCpf("1234")).toBe("123.4");
    expect(mascaraCpf("123.456.789-0999")).toBe("123.456.789-09");
    expect(mascaraCpf("abc")).toBe("");
  });

  it("planoDaUrl só aceita chave conhecida", () => {
    expect(planoDaUrl("pro_anual")).toEqual({ base: "pro", anual: true });
    expect(planoDaUrl("basico_mensal")).toEqual({ base: "basico", anual: false });
    expect(planoDaUrl("institucional_mensal")).toBeNull();
    expect(planoDaUrl("pro_legacy")).toBeNull();
    expect(planoDaUrl(null)).toBeNull();
    expect(chavePlano("essencial", true)).toBe("essencial_anual");
  });

  it("rotuloPlano esconde o sufixo legado", () => {
    expect(rotuloPlano("essencial_legacy")).toBe("Essencial");
    expect(rotuloPlano("trial")).toBe("Teste");
    expect(rotuloPlano(null)).toBeNull();
  });

  it("numerosDoAcervo tira zeros e acerta plural", () => {
    expect(numerosDoAcervo({ alunos: 1, planos: 0, publicados: 2 })).toEqual([
      { n: 1, label: "aluno" },
      { n: 2, label: "publicados" },
    ]);
  });

  it("usoDoPool não passa de 100% nem fica negativo", () => {
    expect(usoDoPool(120, 100)).toEqual({ restam: 0, pct: 100 });
    expect(usoDoPool(25, 100)).toEqual({ restam: 75, pct: 25 });
  });

  it("validarTeto", () => {
    expect(validarTeto("", 100)).toEqual({ ok: true, cap: null });
    expect(validarTeto("10", 100)).toEqual({ ok: true, cap: 10 });
    expect(validarTeto("0", 100).ok).toBe(false);
    expect(validarTeto("101", 100).ok).toBe(false);
    expect(validarTeto("2.5", 100).ok).toBe(false);
  });

  it("tokenDeRecuperacao prefere token_hash de recovery", () => {
    expect(tokenDeRecuperacao(new URLSearchParams("token_hash=x&type=recovery"))).toEqual({ tipo: "hash", valor: "x" });
    expect(tokenDeRecuperacao(new URLSearchParams("token_hash=x&type=signup"))).toBeNull();
    expect(tokenDeRecuperacao(new URLSearchParams("code=y"))).toEqual({ tipo: "code", valor: "y" });
    expect(tokenDeRecuperacao(new URLSearchParams(""))).toBeNull();
  });

  it("erroDeSenha valida antes de gastar o token", () => {
    expect(erroDeSenha("curta", "curta")).toMatch(/8 caracteres/);
    expect(erroDeSenha("12345678", "12345679")).toMatch(/não coincidem/);
    expect(erroDeSenha("12345678", "12345678")).toBeNull();
  });
});

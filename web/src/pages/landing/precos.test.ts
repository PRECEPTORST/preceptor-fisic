import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PLAN_LIMITS } from "../../../../src/lib/server/subscription";
import { PLANOS, TESTE, equivalenteMensal, formatarCentavos, hrefCadastro, precoExibido } from "./precos";

// asaas.ts importa $env (sem alias no vitest): lê o valor direto do fonte.
const asaas = readFileSync(resolve(__dirname, "../../../../src/lib/server/asaas.ts"), "utf8");
function valorAsaas(chave: string): number {
  const m = new RegExp(`${chave}: \\{[^}]*?value: ([\\d.]+)`).exec(asaas);
  if (!m) throw new Error(`sem ${chave} em PAYMENT_LINKS`);
  return Math.round(Number(m[1]) * 100);
}

const plano = (k: string) => PLANOS.find((p) => p.chave === k)!;

describe("preços da landing", () => {
  it("formata em reais", () => {
    expect(formatarCentavos(3990)).toBe("R$ 39,90");
    expect(formatarCentavos(99900)).toBe("R$ 999,00");
    expect(formatarCentavos(49990)).toBe("R$ 499,90");
  });

  it("equivalente mensal = anual/12 arredondado em centavos", () => {
    expect(equivalenteMensal(39900)).toBe(3325);
    expect(equivalenteMensal(49900)).toBe(4158); // 4158,33…
    expect(equivalenteMensal(99900)).toBe(8325);
  });

  it("mensal e anual exibem o valor certo", () => {
    expect(precoExibido(plano("basico"), "mensal")).toMatchObject({ valor: "R$ 39,90", periodo: "/mês" });
    expect(precoExibido(plano("essencial"), "anual")).toMatchObject({
      valor: "R$ 499,00",
      periodo: "/ano",
      equivale: "equivale a R$ 41,58/mês",
    });
    const inst = precoExibido(plano("institucional"), "anual");
    expect(inst).toMatchObject({ valor: "R$ 499,90", periodo: "/mês", aPartirDe: true });
    expect(inst.nota).toBeTruthy();
  });

  it("bate com PAYMENT_LINKS e PLAN_LIMITS", () => {
    for (const p of PLANOS.filter((x) => x.chave !== "institucional")) {
      expect(valorAsaas(`${p.chave}_mensal`)).toBe(p.mensal);
      expect(valorAsaas(`${p.chave}_anual`)).toBe(p.anual);
      expect(PLAN_LIMITS[p.chave]).toEqual({ students: p.alunos, generations: p.treinos });
    }
    expect(PLAN_LIMITS.institucional!.generations).toBe(100);
    expect(PLAN_LIMITS.trial).toEqual({ students: TESTE.alunos, generations: TESTE.treinos });
  });

  it("CTA usa modo=cadastrar e next para a assinatura", () => {
    expect(hrefCadastro()).toBe("/login?modo=cadastrar");
    expect(decodeURIComponent(hrefCadastro("pro", "anual"))).toBe("/login?modo=cadastrar&next=/assinatura?plan=pro_anual");
  });
});

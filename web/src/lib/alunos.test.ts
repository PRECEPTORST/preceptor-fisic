import { describe, expect, it } from "vitest";
import {
  campoDoErro,
  estadoDaFicha,
  semPrefixo,
  categoriaImc,
  chipPlano,
  condicaoDeRisco,
  decimalBR,
  filtrarAlunos,
  formDoAluno,
  idade,
  imc,
  limitacoes,
  linkWhatsapp,
  objetivosDisponiveis,
  payloadDoForm,
  tendenciaPeso,
  tomAderencia,
} from "./alunos";
import { caminho, veredito, type SemanaCarga } from "./carga";

const lista = [
  { name: "Cláudia Reis", status: "active" as const, goal: "Hipertrofia" },
  { name: "Bruno Lima", status: "paused" as const, goal: "Emagrecimento" },
  { name: "Ana", status: "active" as const, goal: null },
];

describe("lista de alunos", () => {
  it("filtra por status, objetivo e busca sem acento", () => {
    expect(filtrarAlunos(lista, { status: "all", objetivo: "all", busca: "claud" }).map((s) => s.name)).toEqual(["Cláudia Reis"]);
    expect(filtrarAlunos(lista, { status: "paused", objetivo: "all", busca: "" })).toHaveLength(1);
    expect(filtrarAlunos(lista, { status: "active", objetivo: "Emagrecimento", busca: "" })).toHaveLength(0);
  });
  it("lista objetivos únicos e ignora vazio", () => {
    expect(objetivosDisponiveis([...lista, lista[0]!])).toEqual(["Hipertrofia", "Emagrecimento"]);
  });
  it("tom da aderência nas faixas 85/70", () => {
    expect([tomAderencia(85), tomAderencia(70), tomAderencia(69)]).toEqual(["positive", "warning", "negative"]);
  });
});

describe("medidas", () => {
  it("idade completa considera o aniversário", () => {
    const hoje = new Date(2026, 9, 16);
    expect(idade("1990-10-16", hoje)).toBe(36);
    expect(idade("1990-10-17", hoje)).toBe(35);
    expect(idade(null, hoje)).toBeNull();
  });
  it("decimal BR", () => {
    expect(decimalBR("72,5")).toBe(72.5);
    expect(decimalBR("1.234,5")).toBe(1234.5);
    expect(decimalBR("abc")).toBeNull();
    expect(decimalBR("")).toBeNull();
  });
  it("IMC e categoria", () => {
    expect(imc(70, 175)).toBe(22.9);
    expect(imc(70, null)).toBeNull();
    expect(categoriaImc(22.9).label).toBe("normal");
    expect(categoriaImc(31).tone).toBe("negative");
  });
  it("tendência do peso", () => {
    expect(tendenciaPeso([80, 78.5])).toEqual({ delta: -1.5, sentido: "desce" });
    expect(tendenciaPeso([80])).toBeNull();
  });
});

describe("ficha", () => {
  it("chip do plano pelo status real", () => {
    expect(chipPlano({ isActive: false, status: "generating" }).label).toBe("Gerando…");
    expect(chipPlano({ isActive: false, status: "failed" }).tone).toBe("negative");
    expect(chipPlano({ isActive: false, status: "archived" }).label).toBe("Encerrado");
    expect(chipPlano({ isActive: true, status: "published" }).label).toBe("Ativo");
  });
  it("condição de alto risco", () => {
    expect(condicaoDeRisco("Cardiopatia isquêmica")).toBe(true);
    expect(condicaoDeRisco("asma leve")).toBe(false);
  });
  it("WhatsApp prefixa 55 só em número BR local (DDD 55 não confunde)", () => {
    expect(linkWhatsapp("(55) 99999-1234", "oi")).toBe("https://wa.me/5555999991234?text=oi");
    expect(linkWhatsapp("+55 11 99999-1234", "oi")).toBe("https://wa.me/5511999991234?text=oi");
    expect(linkWhatsapp(null, "a b")).toBe("https://wa.me/?text=a%20b");
  });
  it("limitações: lesões, senão contraindicações", () => {
    expect(limitacoes({ injuries: [{ region: "joelho", notes: "menisco" }] })).toEqual(["joelho · menisco"]);
    expect(limitacoes({ contraindications: [{ exercise_pattern: "agachamento", reason: "dor" }] })).toEqual(["agachamento · dor"]);
    expect(limitacoes(null)).toEqual([]);
  });
});

describe("formulário", () => {
  it("edição leva só a chave de identidade e volta como payload", () => {
    const f = formDoAluno({
      student: { name: "Ana", birthDate: "1990-01-02", sex: "feminino", weightKg: 62.4, heightCm: 165, phone: null, email: null },
      healthProfile: { cardiovascularRisk: "alto", diagnoses: [{ label: "asma", severity: "leve" }], medications: [{ name: "x", dose: "1" }], injuries: [] },
      preferences: { goals: ["forca"], weeklySessions: 4, minutesPerSession: 50, experienceLevel: "avancado", prescribedDifficulty: null, trainingSplit: null },
    });
    expect(f.weightKg).toBe("62,4");
    expect(f.diagnoses).toBe("asma");
    expect(f.cardiovascularRisk).toBe("alto");
    expect(f.prescribedDifficulty).toBe("media");
    const p = payloadDoForm(f);
    expect(p.weeklySessions).toBe(4);
    expect(p.minutesPerSession).toBe(50);
  });
});

describe("redesign", () => {
  it("erro da API cai no campo certo", () => {
    expect(campoDoErro("name: nome deve ter ao menos 2 letras")).toBe("name");
    expect(campoDoErro("peso inválido (20 a 400 kg)")).toBe("weightKg");
    expect(campoDoErro("data de nascimento não pode ser no futuro")).toBe("birthDate");
    expect(campoDoErro("Você não pode cadastrar aluno para esse profissional.")).toBeNull();
    expect(semPrefixo("email: e-mail inválido")).toBe("e-mail inválido");
  });
  it("estado da jornada usa o plano mais recente", () => {
    const e = estadoDaFicha({
      student: { id: "a", profileCompletedAt: "2026-01-01" },
      healthProfile: { cardiovascularRisk: "baixo" },
      assessments: [{}],
      plans: [
        { id: "velho", status: "published", createdAt: "2026-01-01" },
        { id: "novo", status: "generated", createdAt: "2026-02-01" },
      ],
    });
    expect(e.plano).toEqual({ id: "novo", status: "generated", restricoesVermelhasAbertas: 0 });
    expect(estadoDaFicha({ student: { id: "a", profileCompletedAt: null }, healthProfile: null, assessments: [], plans: [] }).cadastroCompleto).toBe(false);
  });
});

const sem = (internalLoad: number, tonnage: number): SemanaCarga => ({
  weekStart: "", weekLabel: "", tonnage, repVolume: 0, internalLoad, sessions: 1, avgRpe: null,
});

describe("carga", () => {
  it("coleta dados com menos de 4 semanas", () => {
    expect(veredito([sem(100, 1000)], "tonnage").label).toBe("Coletando dados");
  });
  it("adaptando bem: carga sobe e custo fica", () => {
    expect(veredito([sem(100, 1000), sem(100, 1000), sem(120, 1300), sem(120, 1300)], "tonnage").tom).toBe("positive");
  });
  it("volume caindo", () => {
    expect(veredito([sem(100, 1000), sem(100, 1000), sem(70, 700), sem(70, 700)], "tonnage").label).toBe("Volume caindo");
  });
  it("caminho SVG", () => {
    expect(caminho([], 10, 10)).toBe("");
    expect(caminho([1, 2], 10, 10, 0)).toBe("M0.0,10.0 L10.0,0.0");
  });
});

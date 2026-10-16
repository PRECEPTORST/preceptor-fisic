import { describe, expect, it } from "vitest";
import {
  agruparPorEstagio,
  atrasado,
  filtrarContas,
  filtrarLeads,
  franquia,
  leadsCsv,
  paraDatetimeLocal,
  resumoPainel,
  situacaoConta,
  telefoneWa,
  trechosNegrito,
  type Contagens,
  type Lead,
} from "./crm";

const AGORA = new Date("2026-10-16T12:00:00Z").getTime();
const dia = (n: number) => new Date(AGORA + n * 86_400_000).toISOString();

function lead(p: Partial<Lead>): Lead {
  return {
    id: p.id ?? "x",
    name: "Lead",
    phone: null,
    email: null,
    source: "outro",
    stage: "visitante",
    notes: null,
    nextFollowUpAt: null,
    subjectProfessionalId: null,
    lostReason: null,
    createdAt: dia(-30),
    updatedAt: dia(-30),
    ...p,
  };
}

const counts: Contagens = { visitante: 2, cadastrou: 0, ativou_aluno: 0, trial: 0, pagante: 1, cancelado: 0, perdido: 1 };

describe("atrasado", () => {
  it("só conta follow-up vencido de lead vivo", () => {
    expect(atrasado(lead({ nextFollowUpAt: dia(-1) }), AGORA)).toBe(true);
    expect(atrasado(lead({ nextFollowUpAt: dia(1) }), AGORA)).toBe(false);
    expect(atrasado(lead({ nextFollowUpAt: dia(-1), stage: "perdido" }), AGORA)).toBe(false);
    expect(atrasado(lead({}), AGORA)).toBe(false);
  });
});

describe("resumoPainel", () => {
  const leads = [
    lead({ id: "a", createdAt: dia(-2), source: "instagram", nextFollowUpAt: dia(-1) }),
    lead({ id: "b", createdAt: dia(-10), source: "instagram", nextFollowUpAt: dia(-3) }),
    lead({ id: "c", stage: "pagante", source: "site" }),
    lead({ id: "d", stage: "perdido", nextFollowUpAt: dia(-5) }),
  ];
  const r = resumoPainel(leads, counts, AGORA);
  it("calcula KPIs", () => {
    expect(r.total).toBe(4);
    expect(r.conversao).toBe(25);
    expect(r.novos7d).toBe(1);
  });
  it("ordena atrasados do mais antigo e ignora perdidos", () => {
    expect(r.atrasados.map((l) => l.id)).toEqual(["b", "a"]);
  });
  it("origens por volume", () => {
    expect(r.origens.map((o) => [o.id, o.n])).toEqual([["instagram", 2], ["site", 1], ["outro", 1]]);
  });
});

describe("filtrarLeads", () => {
  const leads = [
    lead({ id: "1", name: "Bruno", email: "b@x.com", createdAt: dia(-1) }),
    lead({ id: "2", name: "Ana", notes: "quer musculação", stage: "trial", nextFollowUpAt: dia(2) }),
    lead({ id: "3", name: "Carla", source: "site", nextFollowUpAt: dia(1) }),
  ];
  const base = { busca: "", origem: "all", estagio: "all", ordem: "createdAt" } as const;
  it("busca em nome, e-mail e notas", () => {
    expect(filtrarLeads(leads, { ...base, busca: "MUSC" }).map((l) => l.id)).toEqual(["2"]);
    expect(filtrarLeads(leads, { ...base, busca: "b@x" }).map((l) => l.id)).toEqual(["1"]);
  });
  it("filtra estágio e origem", () => {
    expect(filtrarLeads(leads, { ...base, estagio: "trial" }).map((l) => l.id)).toEqual(["2"]);
    expect(filtrarLeads(leads, { ...base, origem: "site" }).map((l) => l.id)).toEqual(["3"]);
  });
  it("ordena por nome e por follow-up (sem data no fim)", () => {
    expect(filtrarLeads(leads, { ...base, ordem: "name" }).map((l) => l.name)).toEqual(["Ana", "Bruno", "Carla"]);
    expect(filtrarLeads(leads, { ...base, ordem: "nextFollowUpAt" }).map((l) => l.id)).toEqual(["3", "2", "1"]);
  });
  it("agrupa nas 7 colunas", () => {
    const g = agruparPorEstagio(leads);
    expect(g).toHaveLength(7);
    expect(g.find((x) => x.estagio.id === "trial")?.leads).toHaveLength(1);
  });
});

describe("utilidades", () => {
  it("CSV escapa aspas", () => {
    expect(leadsCsv([lead({ name: 'Zé "Bola"', createdAt: "2026-01-02T00:00:00Z" })]).split("\n")[1]).toBe(
      '"Zé ""Bola""","","","visitante","outro","","2026-01-02"',
    );
  });
  it("telefone wa.me ganha 55 só quando é número local", () => {
    expect(telefoneWa("(35) 99148-1514")).toBe("5535991481514");
    expect(telefoneWa("+55 35 99148-1514")).toBe("5535991481514");
  });
  it("datetime-local no fuso de Brasília", () => {
    expect(paraDatetimeLocal("2026-10-16T15:30:00Z")).toBe("2026-10-16T12:30");
    expect(paraDatetimeLocal(null)).toBe("");
  });
  it("situação da conta", () => {
    expect(situacaoConta({ subscriptionStatus: "active", subscriptionExpiresAt: dia(10) }, AGORA).label).toBe("Ativa");
    expect(situacaoConta({ subscriptionStatus: "trial", subscriptionExpiresAt: dia(0.5) }, AGORA)).toEqual({
      label: "Teste · 1 dia",
      tom: "warning",
    });
    expect(situacaoConta({ subscriptionStatus: "active", subscriptionExpiresAt: dia(-1) }, AGORA).label).toBe("Sem acesso");
    expect(situacaoConta({ subscriptionStatus: "past_due", subscriptionExpiresAt: null }, AGORA).label).toBe("Pendente");
  });
  it("franquia escreve ilimitado", () => {
    expect(franquia({ students: 20, generations: null })).toBe("20 alunos · gerações ilimitadas");
  });
  it("filtra contas por CREF", () => {
    expect(filtrarContas([{ name: "A", email: "a@a", cref: "123-G/SP" }], "g/sp")).toHaveLength(1);
  });
  it("negrito sem HTML", () => {
    expect(trechosNegrito("a **b** <c>")).toEqual([
      { texto: "a ", negrito: false },
      { texto: "b", negrito: true },
      { texto: " <c>", negrito: false },
    ]);
  });
});

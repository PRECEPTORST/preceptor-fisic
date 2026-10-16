import { describe, expect, it } from "vitest";
import { proximoPasso, type EstadoJornada } from "./jornada";

const base: EstadoJornada = { alunoId: "a1", cadastroCompleto: true, avaliacoes: 1, riscoDefinido: true, plano: null };

describe("jornada do aluno", () => {
  it("segue a ordem do guia", () => {
    expect(proximoPasso({ ...base, cadastroCompleto: false }).etapa).toBe("cadastro");
    expect(proximoPasso({ ...base, avaliacoes: 0 }).etapa).toBe("avaliacao");
    expect(proximoPasso({ ...base, riscoDefinido: false }).etapa).toBe("risco");
    expect(proximoPasso(base)).toMatchObject({ etapa: "plano", href: "/alunos/a1/gerar" });
  });
  it("plano gerado com restrição vermelha pede revisão com contagem", () => {
    const p = proximoPasso({ ...base, plano: { id: "p1", status: "generated", restricoesVermelhasAbertas: 2 } });
    expect(p).toMatchObject({ etapa: "revisao", label: "Revisar 2 restrições", href: "/treinos/p1" });
  });
  it("falha e arquivado voltam para gerar", () => {
    expect(proximoPasso({ ...base, plano: { id: "p", status: "failed", restricoesVermelhasAbertas: 0 } }).detalhe).toMatch(/falhou/);
    expect(proximoPasso({ ...base, plano: { id: "p", status: "archived", restricoesVermelhasAbertas: 0 } }).etapa).toBe("plano");
  });
  it("publicado", () => {
    expect(proximoPasso({ ...base, plano: { id: "p", status: "published", restricoesVermelhasAbertas: 0 } }).etapa).toBe("publicado");
  });
});

import {
  dataRelativa,
  duracaoDoTreino,
  montarExerciseLogs,
  normalizarPSE,
  proximaSessao,
  relogio,
  repsPadrao,
  rotuloPSE,
  somar,
  sessaoDeHoje,
  seriesIniciais,
  type EntradaTreino,
} from "./aluno-treino";

const main = [
  { name: "Agachamento", sets: 3, reps: "8-12" },
  { name: "Prancha", sets: 2, reps: "30s" },
  { name: "Flexão", sets: 3, reps: "10" },
];

const entrada = (e: Partial<EntradaTreino> = {}): EntradaTreino => ({
  exercicios: [
    { kind: "weight", series: [{ weight: "40", reps: "12" }, { weight: "42,5", reps: "10" }, { weight: "", reps: "" }], concluido: false, pct: "80" },
    { kind: "time", series: [{ weight: "45", reps: "1" }], concluido: true, pct: "150" },
    { kind: "bodyweight", series: [], concluido: false, pct: "" },
  ],
  rpe: 7,
  observacoes: "",
  duracaoMin: 40,
  ...e,
});

describe("montarExerciseLogs", () => {
  const logs = montarExerciseLogs(main, "p1", 0, entrada());

  it("descarta séries vazias, resume reps e usa a maior carga", () => {
    expect(logs[0]).toMatchObject({
      exercise_id: "p1-0-0",
      sets_done: 2,
      reps_done: "12,10",
      load_used: "42.5kg",
      intensity_used: 80,
      completed: true, // série preenchida conta, mesmo sem o toque em concluído
    });
  });

  it("tempo vira segundos, nunca kg; % fora de 1–100 é ignorado", () => {
    expect(logs[1]?.load_used).toBe("45s");
    expect(logs[1]?.set_logs?.[0]?.unit).toBe("s");
    expect(logs[1]?.intensity_used).toBeUndefined();
  });

  it("sem séries: usa o prescrito e não marca concluído", () => {
    expect(logs[2]).toMatchObject({ sets_done: 3, reps_done: "10", completed: false, set_logs: undefined });
  });
});

describe("normalizações", () => {
  it("PSE só 0–10 inteiro", () => {
    expect(normalizarPSE(7.6)).toBe(8);
    expect(normalizarPSE(15)).toBe(10);
    expect(normalizarPSE(null)).toBeUndefined();
    expect(normalizarPSE(Number.NaN)).toBeUndefined();
  });
  it("duração: decorrida plausível, senão planejada, senão estimativa", () => {
    expect(duracaoDoTreino(42, { main })).toBe(42);
    expect(duracaoDoTreino(1, { main, duration_minutes: 50 })).toBe(50);
    expect(duracaoDoTreino(500, { main })).toBe(28); // 8 séries × 3,5
  });
  it("reps padrão e séries iniciais", () => {
    expect(repsPadrao("8-12")).toBe("12");
    expect(repsPadrao("10 a 15")).toBe("15");
    expect(repsPadrao(undefined)).toBe("");
    expect(seriesIniciais({ sets: 2, reps: "10" })).toEqual([{ weight: "", reps: "10" }, { weight: "", reps: "10" }]);
  });
});

describe("helpers da execução", () => {
  it("PSE, stepper e relógio", () => {
    expect(rotuloPSE(0)).toBe("Repouso");
    expect(rotuloPSE(7)).toBe("Muito pesado");
    expect(rotuloPSE(10)).toBe("Máximo");
    expect(somar("40", 2.5)).toBe("42,5");
    expect(somar("42,5", 2.5)).toBe("45");
    expect(somar("", -1)).toBe("");
    expect(relogio(65)).toBe("1:05");
  });
});

describe("sessão de hoje", () => {
  const seg = new Date(2026, 9, 12); // segunda
  const ter = new Date(2026, 9, 13);
  const grade = [{ day_of_week: "seg" as const }, { day_of_week: "qua" as const }];
  it("com grade: dia marcado, ou descanso com o próximo", () => {
    expect(sessaoDeHoje(grade, seg)).toBe(0);
    expect(sessaoDeHoje(grade, ter)).toBe(-1);
    expect(proximaSessao(grade, ter)).toBe(1);
    expect(proximaSessao(grade, seg)).toBe(-1);
  });
  it("sem grade: rodízio pelo dia da semana", () => {
    expect(sessaoDeHoje([{}, {}, {}], seg)).toBe(1);
    expect(sessaoDeHoje([], seg)).toBe(-1);
  });
  it("data relativa", () => {
    const agora = new Date(2026, 9, 16, 12);
    expect(dataRelativa(new Date(2026, 9, 16, 8).toISOString(), agora)).toBe("hoje");
    expect(dataRelativa(new Date(2026, 9, 15, 8).toISOString(), agora)).toBe("ontem");
  });
});

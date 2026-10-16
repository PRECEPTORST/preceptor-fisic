// Tema do app: escuro é a identidade do Fisic e o padrão; o claro é opcional.
// Contrato (mesmo do Cockpit INV-112, invertido):
//   1. Padrão escuro. Valor ausente ou corrompido no storage cai no escuro.
//   2. Escolha por navegador (localStorage), não por conta.
//   3. Aplicar = presença da classe `light` no <html>. Nenhuma regra de negócio lê o tema.

export type Tema = "escuro" | "claro";

export const CHAVE_TEMA = "fisic_tema";

export function normalizarTema(bruto: string | null | undefined): Tema {
  return bruto === "claro" ? "claro" : "escuro";
}

export function lerTema(): Tema {
  try {
    return normalizarTema(localStorage.getItem(CHAVE_TEMA));
  } catch {
    return "escuro";
  }
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle("light", tema === "claro");
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // sem storage: vale só pra sessão atual
  }
}

export function alternarTema(): Tema {
  const novo: Tema = lerTema() === "claro" ? "escuro" : "claro";
  aplicarTema(novo);
  return novo;
}

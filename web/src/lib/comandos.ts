import type { LucideIcon } from "lucide-react";

/**
 * Registro de comandos da paleta ⌘K (brief §2.5). Cada domínio acrescenta os
 * dele aqui — a navegação do menu entra sozinha (ver CommandPalette).
 */
export type Comando = {
  id: string;
  label: string;
  grupo: "Ações" | "Ir para";
  href: string;
  icon?: LucideIcon;
  palavras?: string[];
  /** Só para admin (CRM). */
  admin?: boolean;
};

export const comandos: Comando[] = [
  { id: "novo-aluno", label: "Novo aluno", grupo: "Ações", href: "/alunos/novo", palavras: ["cadastrar", "criar"] },
  { id: "novo-compromisso", label: "Novo compromisso", grupo: "Ações", href: "/agenda/nova", palavras: ["agendar", "consulta"] },
  { id: "novo-exercicio", label: "Novo exercício", grupo: "Ações", href: "/exercicios/novo" },
  { id: "treinos-rascunho", label: "Treinos em rascunho", grupo: "Ir para", href: "/treinos?status=rascunho", palavras: ["revisar", "publicar", "planos"] },
];

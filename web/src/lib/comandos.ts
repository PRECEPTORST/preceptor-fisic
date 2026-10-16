import { AlarmClock, Kanban, KeyRound, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";

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
  // CRM (só admin). A paleta mostra o grupo "Ações"; a aba CRM já entra pelo menu.
  { id: "crm-novo-lead", label: "Novo lead", grupo: "Ações", href: "/crm/novo", icon: UserPlus, palavras: ["crm", "cadastrar", "contato"], admin: true },
  { id: "crm-leads", label: "Leads do CRM", grupo: "Ações", href: "/crm/leads", icon: Kanban, palavras: ["crm", "funil", "pipeline", "kanban"], admin: true },
  {
    id: "crm-followups",
    label: "Leads por follow-up mais urgente",
    grupo: "Ações",
    href: "/crm/leads?ordem=nextFollowUpAt",
    icon: AlarmClock,
    palavras: ["crm", "atrasado", "retorno"],
    admin: true,
  },
  { id: "crm-contas", label: "Contas e link de nova senha", grupo: "Ações", href: "/crm/contas", icon: KeyRound, palavras: ["crm", "senha", "suporte", "plano", "franquia"], admin: true },
  { id: "crm-feedbacks", label: "Feedbacks dos beta testers", grupo: "Ações", href: "/crm/feedbacks", icon: MessageSquare, palavras: ["crm", "resumo", "ia", "bug"], admin: true },
];

import {
  BookOpen,
  CalendarDays,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Sessao } from "@/hooks/useSessao";

export type ItemNav = { href: string; label: string; icon: LucideIcon; contagem?: number; alerta?: number };

/**
 * Navegação do profissional. Corrige o que a auditoria achou no Svelte:
 * - "Planos" queria dizer treino E plano comercial → agora "Treinos" e "Assinatura".
 * - "Visão geral" (sidebar) × "Visão" (tabbar) → um nome só.
 * - Equipe e Assinatura sumiam no mobile → o menu mobile usa esta mesma lista.
 * - Cada item tem ícone próprio (Equipe usava o de Alunos; Assinatura o de Planos).
 */
export function navPrincipal(s: Sessao | undefined): ItemNav[] {
  const c = s?.sidebarCounts;
  return [
    { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    ...(s?.professional.isAdmin ? [{ href: "/crm", label: "CRM", icon: ShieldCheck, alerta: c?.newLeads }] : []),
    { href: "/alunos", label: "Alunos", icon: Users, contagem: c?.students },
    { href: "/treinos", label: "Treinos", icon: ListChecks },
    { href: "/exercicios", label: "Exercícios", icon: Dumbbell },
    { href: "/mensagens", label: "Mensagens", icon: MessageSquare, alerta: c?.unreadMessages },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    ...(s?.isOrgOwner ? [{ href: "/equipe", label: "Equipe", icon: UsersRound }] : []),
  ];
}

export const navRodape: ItemNav[] = [
  { href: "/guia", label: "Guia", icon: BookOpen },
  { href: "/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/feedback", label: "Feedback", icon: MessagesSquare },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function itemAtivo(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

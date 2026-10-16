import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type Sessao = {
  professional: {
    id: string;
    name: string;
    email: string;
    cref: string | null;
    specialty: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
    organizationId: string | null;
  };
  user: { id: string; email: string | null };
  temAcesso: boolean;
  isOrgOwner: boolean;
  trial: { diasRestantes: number; label: string } | null;
  sidebarCounts: { students: number; unreadMessages: number; newLeads: number };
};

export const CHAVE_SESSAO = ["sessao"] as const;

export function useSessao() {
  const { session } = useAuth();
  return useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: () => api<Sessao>("/sessao"),
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}

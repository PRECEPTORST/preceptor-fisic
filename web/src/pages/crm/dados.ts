import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FeedbackItem, LeadSource, LeadStage } from "$lib/server/queries";
import type { ContaCrm } from "$lib/server/crm";
import { api } from "@/lib/api";
import { estagio, paraDatetimeLocal, type Contagens, type Lead } from "@/lib/crm";

/** Datas viram string no JSON. */
type Json<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

export type Conta = Json<ContaCrm>;
export type Feedback = Json<FeedbackItem>;
export type RespostaCrm = { leads: Lead[]; counts: Contagens };

export const CHAVES = {
  crm: ["crm"] as const,
  lead: (id: string) => ["crm", "lead", id] as const,
  contas: ["crm", "contas"] as const,
  feedbacks: ["crm", "feedbacks"] as const,
};

export function useCrm() {
  return useQuery({ queryKey: CHAVES.crm, queryFn: () => api<RespostaCrm>("/crm") });
}

/** Corpo aceito por POST/PUT /crm/leads. */
export type FormLead = {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  stage: LeadStage;
  nextFollowUpAt: string;
  notes: string;
  lostReason: string;
};

export const FORM_LEAD_VAZIO: FormLead = {
  name: "",
  phone: "",
  email: "",
  source: "outro",
  stage: "visitante",
  nextFollowUpAt: "",
  notes: "",
  lostReason: "",
};

export function formDoLead(l: Lead): FormLead {
  return {
    name: l.name,
    phone: l.phone ?? "",
    email: l.email ?? "",
    source: l.source,
    stage: l.stage,
    nextFollowUpAt: paraDatetimeLocal(l.nextFollowUpAt),
    notes: l.notes ?? "",
    lostReason: l.lostReason ?? "",
  };
}

/** Muda o estágio com atualização otimista (lista e contagens). */
export function useMoverEstagio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) =>
      api<{ ok: true }>(`/crm/leads/${id}/estagio`, { method: "PATCH", json: { stage } }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: CHAVES.crm, exact: true });
      const antes = qc.getQueryData<RespostaCrm>(CHAVES.crm);
      if (antes) {
        const velho = antes.leads.find((l) => l.id === id)?.stage;
        const counts = { ...antes.counts };
        if (velho && velho !== stage) {
          counts[velho] -= 1;
          counts[stage] += 1;
        }
        qc.setQueryData<RespostaCrm>(CHAVES.crm, {
          leads: antes.leads.map((l) => (l.id === id ? { ...l, stage } : l)),
          counts,
        });
      }
      return { antes };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(CHAVES.crm, ctx.antes);
      toast.error(`Não consegui mover o lead: ${e.message}`);
    },
    onSuccess: (_r, { stage }) => toast.success(`Movido para "${estagio(stage).label}".`),
    onSettled: (_r, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: CHAVES.crm, exact: true });
      void qc.invalidateQueries({ queryKey: CHAVES.lead(id) });
    },
  });
}

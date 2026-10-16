import { NavLink, useLocation } from "react-router-dom";
import { ArrowRightLeft, Check } from "lucide-react";
import type { LeadStage } from "$lib/server/queries";
import { ESTAGIOS, ORIGENS } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { a11yCampo, Campo, FormSection } from "@/components/Form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormLead } from "./dados";

const ABAS = [
  { href: "/crm", label: "Visão geral" },
  { href: "/crm/leads", label: "Leads" },
  { href: "/crm/feedbacks", label: "Feedbacks" },
  { href: "/crm/contas", label: "Contas" },
];

/** Navegação interna do CRM. /crm/novo e /crm/:id contam como "Leads". */
export function AbasCrm() {
  const { pathname } = useLocation();
  const emLead = /^\/crm\/(leads|novo|(?!feedbacks|contas)[^/]+)/.test(pathname);
  return (
    <nav aria-label="Navegação do CRM" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {ABAS.map((a) => {
          const ativo = a.href === "/crm/leads" ? emLead : a.href === "/crm" ? pathname === "/crm" : pathname.startsWith(a.href);
          return (
            <li key={a.href}>
              <NavLink
                to={a.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-body transition-colors",
                  ativo ? "border-brand font-medium text-ink" : "border-transparent text-ink-mute hover:text-ink",
                )}
              >
                {a.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mover de estágio por menu (sem arrastar). */
export function MenuMover({
  atual,
  nome,
  onMover,
  className,
}: {
  atual: LeadStage;
  nome: string;
  onMover: (s: LeadStage) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative z-10 size-9 shrink-0", className)} aria-label={`Mover ${nome} de estágio`}>
          <ArrowRightLeft className="size-4 text-ink-mute" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Mover para</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ESTAGIOS.map((e) => (
          <DropdownMenuItem key={e.id} disabled={e.id === atual} onSelect={() => onMover(e.id)}>
            <span className="flex-1">{e.label}</span>
            {e.id === atual && <Check className="size-4 text-brand" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Campos do lead (novo e edição). `estagios` limita as opções (o novo só vai até Pagante). */
export function CamposLead({
  f,
  set,
  estagios = ESTAGIOS.map((e) => e.id),
  erroNome,
}: {
  f: FormLead;
  set: (p: Partial<FormLead>) => void;
  estagios?: LeadStage[];
  erroNome?: string | null;
}) {
  const perdeu = f.stage === "perdido" || f.stage === "cancelado";
  return (
    <>
      <FormSection titulo="Contato">
        <Campo id="lead-nome" label="Nome" erro={erroNome} span>
          <Input {...a11yCampo("lead-nome", erroNome)} required value={f.name} placeholder="Ex.: Pedro Henrique" onChange={(e) => set({ name: e.target.value })} />
        </Campo>
        <Campo id="lead-fone" label="Telefone">
          <Input id="lead-fone" type="tel" inputMode="tel" value={f.phone} placeholder="(11) 99999-9999" onChange={(e) => set({ phone: e.target.value })} />
        </Campo>
        <Campo id="lead-email" label="E-mail">
          <Input id="lead-email" type="email" value={f.email} placeholder="pedro@exemplo.com" onChange={(e) => set({ email: e.target.value })} />
        </Campo>
      </FormSection>
      <FormSection titulo="Funil">
        <Campo id="lead-origem" label="Origem">
          <Select value={f.source} onValueChange={(v) => set({ source: v as FormLead["source"] })}>
            <SelectTrigger id="lead-origem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGENS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo id="lead-estagio" label="Estágio">
          <Select value={f.stage} onValueChange={(v) => set({ stage: v as LeadStage })}>
            <SelectTrigger id="lead-estagio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTAGIOS.filter((e) => estagios.includes(e.id)).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo id="lead-follow" label="Próximo follow-up" dica="Quando lembrar de entrar em contato de novo (opcional). Horário de Brasília." span>
          <Input
            {...a11yCampo("lead-follow", null, true)}
            type="datetime-local"
            className="num"
            value={f.nextFollowUpAt}
            onChange={(e) => set({ nextFollowUpAt: e.target.value })}
          />
        </Campo>
        {perdeu && (
          <Campo id="lead-motivo" label={f.stage === "perdido" ? "Motivo da perda" : "Motivo do cancelamento"} span>
            <Input
              id="lead-motivo"
              value={f.lostReason}
              placeholder="Ex.: preço alto, foi para a concorrência, deixou de usar"
              onChange={(e) => set({ lostReason: e.target.value })}
            />
          </Campo>
        )}
        <Campo id="lead-notas" label="Notas" span>
          <Textarea
            id="lead-notas"
            rows={5}
            value={f.notes}
            placeholder="Ex.: quer começar segunda. Musculação 3x por semana. Indicação da Beatriz."
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Campo>
      </FormSection>
    </>
  );
}

/** Corpo para a API a partir do formulário. */
export function corpoLead(f: FormLead) {
  return {
    name: f.name.trim(),
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
    source: f.source,
    stage: f.stage,
    notes: f.notes.trim() || null,
    nextFollowUpAt: f.nextFollowUpAt || null,
    lostReason: f.lostReason.trim() || null,
  };
}

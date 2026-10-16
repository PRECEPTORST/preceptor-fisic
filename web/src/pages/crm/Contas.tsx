import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { filtrarContas, franquia, situacaoConta, whatsappLinkSenha } from "@/lib/crm";
import { data, numero } from "@/lib/format";
import { useTitulo } from "@/lib/useTitulo";
import { useFiltrosUrl } from "@/hooks/useFiltrosUrl";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { DataList, type Coluna } from "@/components/DataList";
import { Avatar } from "@/components/Avatar";
import { copiar } from "@/components/alunos/copiar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AbasCrm } from "./comum";
import { CHAVES, type Conta } from "./dados";

const PADROES = { q: "" };

function Etiqueta({ children }: { children: string }) {
  return (
    <StatusChip tone="neutral" dot={false}>
      {children}
    </StatusChip>
  );
}

/** Contas dos profissionais: plano, franquia, situação e link de nova senha para mandar por WhatsApp. */
export default function CrmContas() {
  useTitulo("Contas · CRM · PreceptorFISIC");
  const q = useQuery({ queryKey: CHAVES.contas, queryFn: () => api<{ contas: Conta[] }>("/crm/contas") });
  const { valores, set } = useFiltrosUrl(PADROES);
  // Guardado em estado local: o link não some se a lista recarregar.
  const [gerado, setGerado] = useState<{ email: string; url: string } | null>(null);
  const [telefone, setTelefone] = useState("");

  const gerar = useMutation({
    mutationFn: (email: string) => api<{ email: string; resetUrl: string }>("/crm/contas/link", { method: "POST", json: { email } }),
    onSuccess: (r) => {
      setGerado({ email: r.email, url: r.resetUrl });
      setTelefone("");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui gerar o link."),
  });

  const colunas: Coluna<Conta>[] = [
    {
      id: "conta",
      header: "Conta",
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar nome={c.name} size={32} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium text-ink">{c.name}</span>
              {c.isAdmin && <Etiqueta>admin</Etiqueta>}
              {/* Sem plano gravado cai no padrão do Essencial: marcar evita ler a franquia como contratada. */}
              <Etiqueta>{c.planoLabel ?? "sem plano"}</Etiqueta>
              {c.planoLegado && <Etiqueta>tabela antiga</Etiqueta>}
            </span>
            <span className="block truncate text-caption text-ink-mute">{c.email}</span>
          </span>
        </span>
      ),
    },
    { id: "franquia", header: "Franquia", cell: (c) => <span className="num text-caption text-ink-soft">{franquia(c.limites)}</span> },
    {
      id: "situacao",
      header: "Situação",
      className: "w-36",
      cell: (c) => {
        const s = situacaoConta(c);
        return <StatusChip tone={s.tom}>{s.label}</StatusChip>;
      },
    },
    { id: "desde", header: "Desde", className: "w-24 text-right", cell: (c) => <span className="num text-ink-soft">{data(c.createdAt)}</span> },
    {
      id: "acao",
      header: <span className="sr-only">Ações</span>,
      className: "w-36 text-right",
      cell: (c) => {
        const esta = gerar.isPending && gerar.variables === c.email;
        return (
          <Button size="sm" variant="outline" disabled={esta} onClick={() => gerar.mutate(c.email)} aria-label={`Gerar link de nova senha para ${c.name}`}>
            {esta ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
            {esta ? "Gerando" : "Gerar link"}
          </Button>
        );
      },
    },
  ];

  const digitos = telefone.replace(/\D/g, "").length;

  return (
    <>
      <PageHeader
        title="Contas"
        description={
          q.data ? (
            <>
              <span className="num">{numero(q.data.contas.length)}</span> profissionais. Gere o link de nova senha e envie por WhatsApp quando alguém
              pedir ajuda para entrar.
            </>
          ) : (
            "Gere o link de nova senha e envie por WhatsApp quando alguém pedir ajuda para entrar."
          )
        }
      />
      <AbasCrm />
      <QueryState query={q} skeleton={<SkeletonLista linhas={6} />}>
        {({ contas }) => {
          const lista = filtrarContas(contas, valores.q);
          return (
            <div className="space-y-4">
              <div className="relative md:w-80">
                <Label htmlFor="busca-contas" className="sr-only">
                  Buscar por nome, e-mail ou CREF
                </Label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
                <Input
                  id="busca-contas"
                  type="search"
                  className="pl-9"
                  placeholder="Buscar por nome, e-mail ou CREF"
                  value={valores.q}
                  onChange={(e) => set("q", e.target.value)}
                />
              </div>
              {lista.length === 0 ? (
                <EmptyState compact title={valores.q ? `Nenhuma conta para "${valores.q}"` : "Nenhuma conta ainda"} />
              ) : (
                <DataList rows={lista} columns={colunas} rowKey={(c) => c.id} caption="Contas dos profissionais" />
              )}
            </div>
          );
        }}
      </QueryState>

      <Sheet open={Boolean(gerado)} onOpenChange={(v) => !v && setGerado(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Link de nova senha</SheetTitle>
            <SheetDescription>
              Para <strong className="text-ink">{gerado?.email}</strong>. Vale por 1 hora e só pode ser usado uma vez.
            </SheetDescription>
          </SheetHeader>
          {gerado && (
            <div className="mt-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="link-senha">Link</Label>
                <div className="flex gap-2">
                  <Input id="link-senha" readOnly value={gerado.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-caption" />
                  <Button onClick={() => copiar(gerado.url, "Link copiado.")}>
                    <Copy aria-hidden /> Copiar
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fone-zap">WhatsApp do profissional</Label>
                <Input
                  id="fone-zap"
                  type="tel"
                  inputMode="tel"
                  className="num"
                  placeholder="Ex.: 35 99148 1514"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
                <Button asChild={digitos >= 10} disabled={digitos < 10} className="mt-2 w-full">
                  {digitos >= 10 ? (
                    <a href={whatsappLinkSenha(gerado.url, telefone)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden /> Abrir no WhatsApp
                    </a>
                  ) : (
                    <span>
                      <MessageCircle aria-hidden /> Abrir no WhatsApp
                    </span>
                  )}
                </Button>
              </div>
              <p className="rounded-md border border-warning/40 bg-warning-soft p-3 text-caption text-ink-soft">
                O link dá acesso à conta. Envie só para a pessoa dona do e-mail acima, no contato que você já conhece.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

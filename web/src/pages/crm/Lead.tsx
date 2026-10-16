import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { estagio, telefoneWa, type Lead } from "@/lib/crm";
import { useTitulo } from "@/lib/useTitulo";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { FormActions, useAvisoSaida } from "@/components/Form";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { CamposLead, corpoLead, MenuMover } from "./comum";
import { CHAVES, formDoLead, useMoverEstagio, type FormLead } from "./dados";

const dataLonga = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Cartao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-line bg-bg-elevated p-5 shadow-card", className)}>
      <h2 className="eyebrow">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AcaoContato({ href, icone, rotulo, valor, externo }: { href: string; icone: ReactNode; rotulo: string; valor: string; externo?: boolean }) {
  return (
    <a
      href={href}
      target={externo ? "_blank" : undefined}
      rel={externo ? "noopener noreferrer" : undefined}
      className="card-vivo flex min-h-11 items-center gap-3 rounded-md border border-line px-3 py-2 text-body"
    >
      {icone}
      <span className="font-medium text-ink">{rotulo}</span>
      <span className="ml-auto truncate text-caption text-ink-mute">{valor}</span>
    </a>
  );
}

function Marco({ cor, titulo, sub }: { cor: string; titulo: string; sub: string }) {
  return (
    <li className="flex gap-3">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", cor)} aria-hidden />
      <span>
        <span className="block text-body font-medium text-ink">{titulo}</span>
        <span className="num block text-caption text-ink-mute">{sub}</span>
      </span>
    </li>
  );
}

function Editor({ lead }: { lead: Lead }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mover = useMoverEstagio();
  const [f, setF] = useState<FormLead>(() => formDoLead(lead));
  const [sujo, setSujo] = useState(false);
  useAvisoSaida(sujo);
  useEffect(() => {
    if (!sujo) setF(formDoLead(lead));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  const salvar = useMutation({
    mutationFn: () => api(`/crm/leads/${lead.id}`, { method: "PUT", json: corpoLead(f) }),
    onSuccess: () => {
      setSujo(false);
      void qc.invalidateQueries({ queryKey: CHAVES.crm });
      toast.success("Alterações salvas.");
    },
    onError: (e: Error) => toast.error(`Não consegui salvar: ${e.message}`),
  });

  async function excluir() {
    try {
      await api(`/crm/leads/${lead.id}`, { method: "DELETE" });
      setSujo(false);
      qc.removeQueries({ queryKey: CHAVES.lead(lead.id) });
      void qc.invalidateQueries({ queryKey: CHAVES.crm });
      toast.success("Lead excluído.");
      navigate("/crm/leads");
    } catch (e) {
      toast.error(`Não consegui excluir: ${(e as Error).message}`);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) {
      toast.error("Informe o nome do lead.");
      return;
    }
    salvar.mutate();
  }

  const e = estagio(lead.stage);
  return (
    <>
      <PageHeader
        eyebrow="CRM · Lead"
        title={lead.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip tone={e.tom}>{e.label}</StatusChip>
            <span className="num text-caption">Criado em {dataLonga(lead.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/crm/leads">
                <ArrowLeft aria-hidden /> Leads
              </Link>
            </Button>
            <MenuMover
              atual={lead.stage}
              nome={lead.name}
              onMover={(stage) => {
                mover.mutate({ id: lead.id, stage });
                setF((x) => ({ ...x, stage }));
              }}
              className="border border-line"
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={enviar} className="min-w-0 space-y-6">
          <CamposLead
            f={f}
            set={(p) => {
              setF((x) => ({ ...x, ...p }));
              setSujo(true);
            }}
          />
          <FormActions enviando={salvar.isPending} rotulo="Salvar alterações" desabilitado={!sujo} />
        </form>

        <aside className="space-y-4">
          <Cartao titulo="Contato rápido">
            {lead.phone || lead.email ? (
              <div className="space-y-2">
                {lead.phone && (
                  <>
                    <AcaoContato
                      href={`https://wa.me/${telefoneWa(lead.phone)}`}
                      externo
                      icone={<MessageCircle className="size-4 text-ink-mute" aria-hidden />}
                      rotulo="WhatsApp"
                      valor={lead.phone}
                    />
                    <AcaoContato href={`tel:${lead.phone}`} icone={<Phone className="size-4 text-ink-mute" aria-hidden />} rotulo="Ligar" valor={lead.phone} />
                  </>
                )}
                {lead.email && (
                  <AcaoContato href={`mailto:${lead.email}`} icone={<Mail className="size-4 text-ink-mute" aria-hidden />} rotulo="E-mail" valor={lead.email} />
                )}
              </div>
            ) : (
              <p className="text-body text-ink-mute">Sem contato cadastrado.</p>
            )}
          </Cartao>

          <Cartao titulo="Linha do tempo">
            <ol className="space-y-3">
              <Marco cor="bg-brand" titulo="Lead criado" sub={dataLonga(lead.createdAt)} />
              {lead.nextFollowUpAt && <Marco cor="bg-warning" titulo="Próximo follow-up" sub={dataLonga(lead.nextFollowUpAt)} />}
              {lead.subjectProfessionalId && <Marco cor="bg-info" titulo="Usuário da plataforma" sub="Cadastro vinculado à plataforma" />}
              {lead.stage === "pagante" && <Marco cor="bg-positive" titulo="Assinatura ativa" sub={dataLonga(lead.updatedAt)} />}
            </ol>
          </Cartao>

          <Cartao titulo="Zona perigosa" className="border-negative/40">
            <p className="text-body text-ink-mute">Remove este lead para sempre. Não dá para desfazer.</p>
            <ConfirmDialog
              trigger={
                <Button variant="outline" className="mt-3 text-negative">
                  <Trash2 aria-hidden /> Excluir lead
                </Button>
              }
              titulo={`Excluir "${lead.name}"?`}
              descricao="O lead e as notas somem do funil. Não dá para desfazer."
              confirmar="Excluir lead"
              onConfirmar={excluir}
            />
          </Cartao>
        </aside>
      </div>
    </>
  );
}

export default function CrmLead() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: CHAVES.lead(id), queryFn: () => api<{ lead: Lead }>(`/crm/leads/${id}`) });
  useTitulo(`${q.data?.lead.name ?? "Lead"} · CRM · PreceptorFISIC`);
  return (
    <QueryState query={q} skeleton={<SkeletonLista linhas={4} />}>
      {({ lead }) => <Editor key={lead.id} lead={lead} />}
    </QueryState>
  );
}

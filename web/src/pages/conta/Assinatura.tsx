import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { chavePlano, linkWhatsapp, mascaraCpf, PLANOS, planoDaUrl, rotuloPlano, type PlanoBase } from "@/lib/conta";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/sonner";

export type DadosAssinatura = {
  nome: string;
  email: string;
  plano: string | null;
  expiraEm: string | null;
  billingEnabled: boolean;
  situacao: "ativo" | "trial" | "novo" | "expirado";
  diasDeTrial: number;
  precisaCpf: boolean;
};
type RespostaAssinar = { url: string; existente?: boolean } | { pendente: true };

export const CHAVE_ASSINATURA = ["assinatura"] as const;

const EBOOK_URL = "https://www.asaas.com/c/mtnzj35g4ckbbukf";
const WA_INST = linkWhatsapp("Olá! Tenho interesse no plano Institucional do PreceptorFISIC.");
const dataLonga = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export default function Assinatura() {
  const q = useQuery({ queryKey: CHAVE_ASSINATURA, queryFn: () => api<DadosAssinatura>("/assinatura") });
  return (
    <div className="mx-auto max-w-5xl">
      <QueryState query={q} skeleton={<SkeletonAssinatura />}>
        {(d) =>
          !d.billingEnabled ? (
            <PageHeader
              eyebrow="Assinatura"
              title="Pagamentos indisponíveis no momento."
              description="Estamos ajustando o sistema de cobrança. Tente de novo em alguns minutos."
            />
          ) : d.situacao === "ativo" ? (
            <Ativa d={d} />
          ) : (
            <Checkout d={d} />
          )
        }
      </QueryState>
    </div>
  );
}

function Ativa({ d }: { d: DadosAssinatura }) {
  const plano = rotuloPlano(d.plano);
  const waEbook = linkWhatsapp(
    `Olá! Acabei de comprar o Ebook ACSM pelo PreceptorFISIC. Sou ${d.nome} e meu e-mail de acesso é ${d.email}. Pode liberar meu acesso no Drive?`,
  );
  return (
    <>
      <PageHeader
        eyebrow="Assinatura"
        title="Sua assinatura está ativa."
        description={[plano && `Plano ${plano}.`, d.expiraEm && `Válida até ${dataLonga(d.expiraEm)}.`].filter(Boolean).join(" ")}
      />
      <section aria-labelledby="ebook" className="max-w-2xl space-y-3 rounded-lg border border-brand/40 bg-brand-soft p-6">
        <p className="eyebrow text-brand">Oferta para assinantes</p>
        <h2 id="ebook" className="text-h6 font-semibold text-ink">
          Ebook · Recomendações ACSM para população geral e populações especiais
        </h2>
        <p className="text-body text-ink-soft">
          O material de referência que fundamenta o PreceptorFISIC, organizado para consulta rápida na prescrição do dia a dia.
        </p>
        <p className="flex items-baseline gap-3">
          <span className="num text-body text-ink-mute line-through">R$ 100,00</span>
          <span className="num text-h5 font-semibold text-brand">R$ 29,90</span>
        </p>
        <Button asChild>
          <a href={EBOOK_URL} target="_blank" rel="noopener noreferrer">
            Quero o ebook por R$ 29,90 <ExternalLink aria-hidden />
          </a>
        </Button>
        <p className="text-caption text-ink-soft">
          <strong className="text-ink">Como funciona a entrega:</strong> depois do pagamento, o time libera o ebook no Google Drive, no
          e-mail da sua conta. Pagou e quer agilizar?{" "}
          <a href={waEbook} target="_blank" rel="noopener noreferrer" className="text-brand underline-offset-4 hover:underline">
            Chame no WhatsApp com o comprovante
          </a>
          .
        </p>
      </section>
    </>
  );
}

function Checkout({ d }: { d: DadosAssinatura }) {
  const [params] = useSearchParams();
  const pre = planoDaUrl(params.get("plan"));
  const [anual, setAnual] = useState(pre?.anual ?? false);
  const [escolhido, setEscolhido] = useState<PlanoBase | null>(pre?.base ?? null);
  const plano = PLANOS.find((p) => p.base === escolhido) ?? null;

  if (plano) return <Confirmar d={d} plano={plano} anual={anual} voltar={() => setEscolhido(null)} />;

  const cabecalho =
    d.situacao === "expirado"
      ? {
          t: "Seu acesso terminou.",
          s: "Escolha um plano para voltar. Seus alunos e planos continuam salvos e voltam assim que a assinatura confirmar.",
        }
      : d.situacao === "trial"
        ? {
            t: "Continue depois do teste.",
            s: `${d.diasDeTrial === 1 ? "Hoje é o último dia do seu teste." : `Ainda restam ${d.diasDeTrial} dias de teste.`} Assinando agora, você não perde o acesso quando ele terminar.`,
          }
        : { t: "Falta um passo para começar.", s: "Escolha seu plano. A liberação é na hora em que o pagamento confirma." };

  return (
    <>
      <PageHeader eyebrow="Assinatura" title={cabecalho.t} description={cabecalho.s} />
      <ToggleGroup
        type="single"
        value={anual ? "anual" : "mensal"}
        onValueChange={(v) => v && setAnual(v === "anual")}
        aria-label="Ciclo de cobrança"
        className="mb-6 w-fit rounded-full border border-line bg-bg-elevated p-1"
      >
        <ToggleGroupItem value="mensal" className="rounded-full px-4 data-[state=on]:bg-brand data-[state=on]:text-brand-on">
          Mensal
        </ToggleGroupItem>
        <ToggleGroupItem value="anual" className="rounded-full px-4 data-[state=on]:bg-brand data-[state=on]:text-brand-on">
          Anual <span className="eyebrow ml-1.5 text-current opacity-80">2 meses grátis</span>
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="cascata grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANOS.map((p) => (
          <article
            key={p.base}
            className={cn(
              "card-vivo relative flex flex-col rounded-lg border bg-bg-elevated p-5 shadow-card",
              p.popular ? "border-brand/60" : "border-line",
            )}
          >
            {p.popular && (
              <span className="absolute -top-2.5 left-5 rounded-full bg-brand px-2.5 py-0.5 font-mono text-micro uppercase text-brand-on">Inclui auditoria</span>
            )}
            <h2 className="text-h6 font-medium text-ink">{p.nome}</h2>
            <p className="mt-2 flex flex-wrap items-baseline gap-1">
              <span className="num text-h5 font-semibold text-ink">{anual ? p.anual : p.mensal}</span>
              <span className="eyebrow">{anual ? "/ano" : "/mês"}</span>
            </p>
            <p className="mt-2 text-body text-ink-soft">{p.desc}</p>
            <ListaItens itens={p.itens} />
            <Button className="mt-5 w-full" variant={p.popular ? "default" : "outline"} onClick={() => setEscolhido(p.base)}>
              Assinar {p.nome}
            </Button>
          </article>
        ))}
        <article className="card-vivo flex flex-col rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
          <h2 className="text-h6 font-medium text-ink">Institucional</h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-1">
            <span className="eyebrow w-full">a partir de</span>
            <span className="num text-h5 font-semibold text-ink">R$ 499,90</span>
            <span className="eyebrow">/mês</span>
          </p>
          <p className="mt-2 text-body text-ink-soft">Para clínicas, academias e equipes.</p>
          <ListaItens itens={["Até 5 profissionais", "Alunos ilimitados", "Onboarding dedicado", "Contrato e faturamento"]} />
          <Button asChild variant="outline" className="mt-5 w-full">
            <a href={WA_INST} target="_blank" rel="noopener noreferrer">
              Falar com o time
            </a>
          </Button>
        </article>
      </div>
      <p className="mt-6 text-center font-mono text-caption text-ink-mute">Pix ou cartão · Ativação automática · Pagamento seguro pelo Asaas</p>
    </>
  );
}

function ListaItens({ itens }: { itens: string[] }) {
  return (
    <ul className="mt-4 flex-1 space-y-2">
      {itens.map((it) => (
        <li key={it} className="flex gap-2 text-body text-ink-soft">
          <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          {it}
        </li>
      ))}
    </ul>
  );
}

function Confirmar({ d, plano, anual, voltar }: { d: DadosAssinatura; plano: (typeof PLANOS)[number]; anual: boolean; voltar: () => void }) {
  const [cpf, setCpf] = useState("");
  const [jaAssinou, setJaAssinou] = useState(false);
  const assinar = useMutation({
    mutationFn: () =>
      api<RespostaAssinar>("/assinatura", { method: "POST", json: { plan: chavePlano(plano.base, anual), cpf: d.precisaCpf ? cpf : undefined } }),
    onSuccess: (r) => {
      // Fatura do Asaas (nova ou a que já estava aberta): sai do app para pagar.
      if ("url" in r) {
        if (r.existente) toast.info("Você já tinha uma fatura aberta. Vou te levar para ela.");
        window.location.href = r.url;
        return;
      }
      toast.success("Assinatura criada! A fatura chega no seu e-mail em instantes.");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setJaAssinou(true);
      toast.error(`Não consegui assinar: ${e.message}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    assinar.mutate();
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        eyebrow="Confirmar assinatura"
        title={`Você escolheu o ${plano.nome}.`}
        description="Confirme abaixo. A liberação é na hora em que o pagamento confirma."
      />
      <form onSubmit={enviar} className="space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="font-semibold text-ink">
              {plano.nome} · {anual ? "anual" : "mensal"}
            </p>
            {anual && <p className="text-caption text-brand">2 meses grátis no plano anual</p>}
          </div>
          <p className="num whitespace-nowrap text-h6 font-semibold text-ink">
            {anual ? plano.anual : plano.mensal}
            <span className="eyebrow ml-1">{anual ? "/ano" : "/mês"}</span>
          </p>
        </div>

        {d.precisaCpf && (
          <div className="grid gap-1.5">
            <Label htmlFor="cpf">CPF ou CNPJ</Label>
            <Input
              id="cpf"
              value={cpf}
              // CNPJ tem 14 dígitos: só mascara enquanto couber num CPF.
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").length <= 11 ? mascaraCpf(e.target.value) : e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              required
              className="num"
            />
            <p className="text-caption text-ink-mute">Usado só para emitir a cobrança. Pedimos uma vez&nbsp;só.</p>
          </div>
        )}

        {jaAssinou && (
          <p role="alert" className="rounded-md border border-warning/40 bg-warning-soft p-3 text-caption text-ink">
            Já existe uma assinatura sua em andamento.{" "}
            <a
              href={linkWhatsapp(`Olá! Sou ${d.nome} (${d.email}) e minha assinatura do PreceptorFISIC não apareceu como paga.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline-offset-4 hover:underline"
            >
              Fale com o time no WhatsApp
            </a>{" "}
            antes de tentar de novo.
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={assinar.isPending || jaAssinou}>
          {assinar.isPending ? "Gerando cobrança…" : "Confirmar assinatura"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={voltar}>
          <ArrowLeft aria-hidden /> Escolher outro plano
        </Button>
      </form>
      {/* Renovação automática é termo material: dito antes do pagamento. */}
      <p className="mt-5 text-center text-caption text-ink-mute">
        Pagamento no cartão, pela fatura segura do Asaas. A renovação é automática no mesmo cartão, e você pode cancelar quando quiser. Nenhum
        dado de cartão passa pelos nossos servidores.
      </p>
    </div>
  );
}

function SkeletonAssinatura() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-16 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </div>
  );
}

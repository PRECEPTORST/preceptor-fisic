import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { usoDoPool, validarTeto } from "@/lib/conta";
import { data as fmtData, numero } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";

type Membro = { id: string; name: string; email: string; cref: string | null; is_owner: boolean; alunos: number; planos: number; noCiclo: number };
export type DadosEquipe = {
  org: { id: string; name: string; seats: number; generationsLimit: number; perMemberGenerationCap: number | null };
  membros: Membro[];
  convites: { id: string; email: string; expiresAt: string }[];
  alunos: { id: string; nome: string; responsavel: string; criado_em: string; planos: number }[];
  usadasNoCiclo: number;
  cicloDesde: string;
};

export const CHAVE_EQUIPE = ["equipe"] as const;

export default function Equipe() {
  const q = useQuery({ queryKey: CHAVE_EQUIPE, queryFn: () => api<DadosEquipe>("/equipe"), retry: false });
  return (
    <QueryState query={q} skeleton={<SkeletonEquipe />}>
      {(d) => <Painel d={d} />}
    </QueryState>
  );
}

function Painel({ d }: { d: DadosEquipe }) {
  const { org } = d;
  const vagasUsadas = d.membros.length + d.convites.length;
  const pool = usoDoPool(d.usadasNoCiclo, org.generationsLimit);
  const pend = d.convites.length;
  return (
    <>
      <PageHeader
        eyebrow="Institucional"
        title={org.name}
        description={
          <span className="num">
            {d.membros.length} {d.membros.length === 1 ? "profissional" : "profissionais"} de {org.seats} vagas
            {pend > 0 && ` · ${pend} ${pend === 1 ? "convite pendente" : "convites pendentes"}`}
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="pool" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
          <p id="pool" className="eyebrow">
            Gerações por IA no ciclo
          </p>
          <p className="mt-3 text-h4 font-semibold text-ink">
            <span className="num">{numero(d.usadasNoCiclo)}</span>{" "}
            <span className="num text-body font-normal text-ink-mute">de {numero(org.generationsLimit)}</span>
          </p>
          <Progress value={pool.pct} className="mt-3 h-1.5" aria-label={`${pool.pct}% da franquia usada`} />
          <p className="num mt-2 text-caption text-ink-mute">
            {numero(pool.restam)} restantes · ciclo desde {fmtData(d.cicloDesde)}
          </p>
        </section>
        <Teto org={org} />
      </div>

      <Convidar d={d} lotado={vagasUsadas >= org.seats} />

      <section aria-labelledby="profissionais" className="mt-8">
        <h2 id="profissionais" className="mb-3 text-h6 font-medium">
          Profissionais
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-bg-elevated">
          {d.membros.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap">
              <Avatar nome={m.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <span className="truncate">{m.name}</span>
                  {m.is_owner && <StatusChip tone="brand" dot={false}>administra</StatusChip>}
                </p>
                <p className="truncate text-caption text-ink-mute">
                  {m.email}
                  {m.cref ? ` · ${m.cref}` : ""}
                </p>
              </div>
              <div className="flex gap-5">
                <Numero n={m.alunos} label="alunos" />
                <Numero n={m.planos} label="planos" />
                <Numero n={m.noCiclo} label="IA no ciclo" />
              </div>
              <div className="w-24 text-right">{!m.is_owner && <Remover m={m} />}</div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-ink-mute">Ficha clínica de aluno continua acessível apenas ao profissional que atende.</p>
      </section>

      <section aria-labelledby="alunos-clinica" className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="alunos-clinica" className="text-h6 font-medium">
            Alunos da clínica
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/alunos/novo">
              <Plus aria-hidden /> Cadastrar aluno
            </Link>
          </Button>
        </div>
        {d.alunos.length === 0 ? (
          <EmptyState compact title="Nenhum aluno cadastrado pela equipe ainda." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-bg-elevated">
            {d.alunos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar nome={a.nome} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{a.nome}</p>
                  <p className="num text-caption text-ink-mute">desde {fmtData(a.criado_em)}</p>
                </div>
                <div className="hidden min-w-0 text-right sm:block">
                  <p className="eyebrow">Responsável</p>
                  <p className="truncate text-body text-ink-soft">{a.responsavel}</p>
                </div>
                <Numero n={a.planos} label="publicados" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-caption text-ink-mute">Cadastrando por aqui, você escolhe qual profissional fica responsável pelo aluno.</p>
      </section>
    </>
  );
}

function Numero({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-right">
      <p className="num font-semibold text-ink">{numero(n)}</p>
      <p className="eyebrow">{label}</p>
    </div>
  );
}

function Teto({ org }: { org: DadosEquipe["org"] }) {
  const qc = useQueryClient();
  const [cap, setCap] = useState(org.perMemberGenerationCap?.toString() ?? "");
  const salvar = useMutation({
    mutationFn: (valor: number | null) => api("/equipe/teto", { method: "PUT", json: { cap: valor } }),
    onSuccess: () => {
      toast.success("Teto atualizado.");
      qc.invalidateQueries({ queryKey: CHAVE_EQUIPE });
    },
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });
  function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarTeto(cap, org.generationsLimit);
    if (!v.ok) return toast.error(v.erro);
    salvar.mutate(v.cap);
  }
  return (
    <form onSubmit={enviar} className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
      <Label htmlFor="teto" className="eyebrow">
        Teto por profissional
      </Label>
      <div className="mt-3 flex gap-2">
        <Input
          id="teto"
          type="number"
          min={1}
          max={org.generationsLimit}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          placeholder="sem teto"
          className="num"
        />
        <Button type="submit" variant="secondary" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      <p className="mt-2 text-caption text-ink-mute">Em branco, cada profissional puxa livremente do total da clínica.</p>
    </form>
  );
}

function Convidar({ d, lotado }: { d: DadosEquipe; lotado: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  // O link fica em estado local: não some quando a lista recarrega.
  const [gerado, setGerado] = useState<{ email: string; url: string } | null>(null);
  const convidar = useMutation({
    mutationFn: () => api<{ convite: { email: string; url: string } }>("/equipe/convites", { method: "POST", json: { email } }),
    onSuccess: (r) => {
      setGerado(r.convite);
      setEmail("");
      toast.success("Convite criado. Copie o link e envie para a pessoa.");
      qc.invalidateQueries({ queryKey: CHAVE_EQUIPE });
    },
    onError: (e) => toast.error(`Não consegui criar o convite: ${e.message}`),
  });
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie manualmente.");
    }
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    convidar.mutate();
  }
  return (
    <section aria-labelledby="convidar" className="mt-8">
      <h2 id="convidar" className="mb-3 text-h6 font-medium">
        Convidar profissional
      </h2>
      {lotado ? (
        <p className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-body text-ink">
          As <span className="num">{d.org.seats}</span> vagas do contrato estão ocupadas. Fale com o time para ampliar.
        </p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row">
          <Label htmlFor="convite-email" className="sr-only">
            E-mail do profissional
          </Label>
          <Input
            id="convite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@doprofissional.com"
            autoComplete="off"
          />
          <Button type="submit" disabled={convidar.isPending}>
            {convidar.isPending ? "Gerando…" : "Gerar convite"}
          </Button>
        </form>
      )}

      {gerado && (
        <div className="mt-4 space-y-3 rounded-lg border border-brand/40 bg-brand-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-ink">{gerado.email}</strong>
            <span className="eyebrow">vale 7 dias · uso único</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-md border border-line bg-bg px-3 py-2 font-mono text-caption text-ink-soft">
              {gerado.url}
            </code>
            <Button onClick={() => copiar(gerado.url)}>
              <Copy aria-hidden /> Copiar
            </Button>
          </div>
          <p className="text-caption text-ink-soft">
            Envie esse link para a pessoa. Ela precisa ter conta no PreceptorFISIC (ou criar uma), e o link vincula a conta dela à clínica.
          </p>
        </div>
      )}

      {d.convites.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-bg-elevated" aria-label="Convites pendentes">
          {d.convites.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-body">
              <span className="truncate">{c.email}</span>
              <span className="num shrink-0 text-caption text-ink-mute">expira {fmtData(c.expiresAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Remover({ m }: { m: Membro }) {
  const qc = useQueryClient();
  const remover = useMutation({
    mutationFn: () => api(`/equipe/membros/${encodeURIComponent(m.id)}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Profissional removido da clínica.");
      qc.invalidateQueries({ queryKey: CHAVE_EQUIPE });
    },
    onError: (e) => toast.error(`Não consegui remover: ${e.message}`),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={remover.isPending}>
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {m.name} da clínica?</AlertDialogTitle>
          <AlertDialogDescription>
            A conta dela continua existindo, com os alunos e planos dela, mas deixa de usar a assinatura e a franquia da clínica.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => remover.mutate()}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SkeletonEquipe() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-14 w-1/2" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Dumbbell, LayoutDashboard, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { destinoSeguro } from "@/lib/rotas";
import { ESPECIALIDADES, mascaraCpf, type Especialidade } from "@/lib/conta";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { CHAVE_SESSAO } from "@/hooks/useSessao";
import { MolduraPublica } from "@/components/conta/MolduraPublica";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Estado = { email: string; jaTemPerfil: boolean };
type Criado = { ok: true; name: string; trialGranted?: boolean; trialDays?: number };

export const CHAVE_ONBOARDING = ["onboarding"] as const;
const TRIAL_DAYS = 7; // duplicado do servidor: o texto precisa do número antes da resposta

/**
 * Cadastro do profissional. Precisa de sessão Supabase, mas NÃO de professional
 * (é para cá que o guard manda quem leva 409). Fica fora do shell.
 */
export default function Onboarding() {
  const { session, carregando } = useAuth();
  const [params] = useSearchParams();
  const destino = destinoSeguro(params.get("next"));
  const q = useQuery({ queryKey: CHAVE_ONBOARDING, queryFn: () => api<Estado>("/onboarding"), enabled: Boolean(session) });
  const [criado, setCriado] = useState<Criado | null>(null);

  if (carregando) return <Esqueleto />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent("/onboarding" + (params.toString() ? `?${params}` : ""))}`} replace />;
  if (criado) return <Pronto criado={criado} destino={destino} />;

  const meta = (session.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  return (
    <QueryState query={q} skeleton={<Esqueleto />}>
      {(d) => (d.jaTemPerfil ? <Navigate to={destino} replace /> : <Fluxo email={d.email} sugerido={meta.full_name ?? meta.name ?? ""} onCriado={setCriado} />)}
    </QueryState>
  );
}

function Esqueleto() {
  return (
    <MolduraPublica largo>
      <Skeleton className="h-80 w-full" />
    </MolduraPublica>
  );
}

const PILARES = [
  { t: "Cadastre seus alunos", d: "Histórico clínico, comorbidades e contraindicações num lugar só." },
  { t: "Gere planos com o PreceptorFISIC", d: "Estruturados, com base em ACSM/AHA, e checados clinicamente." },
  { t: "App do aluno", d: "Link no celular com o treino do dia e o histórico, sem login." },
];

function Fluxo({ email, sugerido, onCriado }: { email: string; sugerido: string; onCriado: (c: Criado) => void }) {
  const qc = useQueryClient();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [name, setName] = useState(sugerido);
  const [cpf, setCpf] = useState("");
  const [cref, setCref] = useState("");
  const [specialty, setSpecialty] = useState<Especialidade>("prescricao_clinica");
  const [erro, setErro] = useState<{ msg: string; campo?: string } | null>(null);

  const criar = useMutation({
    mutationFn: () => api<Criado>("/onboarding", { method: "POST", json: { name, cpf, cref: cref || null, specialty } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
      onCriado(r);
    },
    onError: (e) => setErro({ msg: e.message, campo: /CPF/.test(e.message) ? "cpf" : undefined }),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    criar.mutate();
  }

  if (passo === 1) {
    const primeiro = sugerido.split(" ")[0];
    return (
      <MolduraPublica largo>
        <p className="eyebrow">Bem-vindo a bordo</p>
        <h1 className="mt-2 text-h4 font-semibold text-ink">
          Olá{primeiro ? `, ${primeiro}` : ""}. Vamos prescrever com <span className="text-brand">rigor clínico.</span>
        </h1>
        <p className="mt-3 text-body text-ink-soft">
          Uma plataforma para quem prescreve exercício para populações reais: com comorbidades, contraindicações e ciência por trás.
        </p>
        <ol className="mt-6 space-y-3">
          {PILARES.map((p, i) => (
            <li key={p.t} className="flex gap-3 rounded-lg border border-line p-3">
              <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-caption text-brand">{i + 1}</span>
              <span>
                <span className="block font-medium text-ink">{p.t}</span>
                <span className="block text-caption text-ink-mute">{p.d}</span>
              </span>
            </li>
          ))}
        </ol>
        <Button size="lg" className="mt-7 w-full" onClick={() => setPasso(2)}>
          Configurar perfil <ArrowRight aria-hidden />
        </Button>
        <p className="mt-4 text-center font-mono text-micro uppercase text-ink-mute">Conformidade LGPD · Dados na região BR</p>
      </MolduraPublica>
    );
  }

  return (
    <MolduraPublica largo>
      <p className="eyebrow">Passo 2 de 2 · Identidade profissional</p>
      <h1 className="mt-2 text-h4 font-semibold text-ink">Seu perfil em 30 segundos.</h1>
      <p className="mt-2 text-body text-ink-soft">Esses dados aparecem para os seus alunos. Dá para editar depois em Configurações.</p>

      <form onSubmit={enviar} className="mt-6 space-y-5">
        {erro && (
          <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft p-3 text-caption text-ink">
            {erro.msg}
          </p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="onb-email">E-mail da conta</Label>
          <Input id="onb-email" disabled value={email} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onb-name">Nome completo</Label>
          <Input
            id="onb-name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            autoFocus
            placeholder="Ex.: Matheus da Cunha Castro"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onb-cpf">CPF</Label>
          <Input
            id="onb-cpf"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            className="num"
            value={cpf}
            onChange={(e) => setCpf(mascaraCpf(e.target.value))}
            aria-invalid={erro?.campo === "cpf" || undefined}
            aria-describedby="onb-cpf-ajuda"
          />
          <p id="onb-cpf-ajuda" className="text-caption text-ink-mute">
            Libera seus {TRIAL_DAYS} dias de teste e evita pedir o documento de novo na hora de assinar. Fica guardado cifrado.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onb-cref">
            Registro profissional <span className="font-normal text-ink-mute">(opcional)</span>
          </Label>
          <Input id="onb-cref" maxLength={40} placeholder="Ex.: CREF 123456-G/SP" value={cref} onChange={(e) => setCref(e.target.value)} />
          <p className="text-caption text-ink-mute">CREF, CREFITO ou CRM. Dá para preencher depois.</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Especialidade principal</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {ESPECIALIDADES.map((s) => {
              const on = specialty === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSpecialty(s.id)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors",
                    on ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      on ? "border-brand bg-brand text-brand-on" : "border-line-strong",
                    )}
                    aria-hidden
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <span>
                    <span className="block text-body font-medium text-ink">{s.label}</span>
                    {s.sub && <span className="block text-caption text-ink-mute">{s.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setPasso(1)}>
            <ArrowLeft aria-hidden /> Voltar
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={criar.isPending}>
            {criar.isPending ? "Configurando…" : "Concluir"}
          </Button>
        </div>
      </form>
    </MolduraPublica>
  );
}

function Pronto({ criado, destino }: { criado: Criado; destino: string }) {
  const primeiro = criado.name.split(" ")[0] || "profissional";
  // Sem trial (CPF já testou), a tela não promete 7 dias que não existem.
  const semTrial = criado.trialGranted === false;
  const proximos = [
    { href: "/alunos/novo", Icone: Plus, t: "Cadastre seu primeiro aluno", d: "Comece com um. Depois você adiciona o resto." },
    { href: "/exercicios", Icone: Dumbbell, t: "Explore o catálogo", d: "Mais de mil exercícios com vídeo, por grupo muscular." },
    { href: "/dashboard", Icone: LayoutDashboard, t: "Vá para a Visão geral", d: "O resumo da sua operação clínica." },
  ];
  return (
    <MolduraPublica largo>
      <span className="flex size-10 items-center justify-center rounded-full bg-positive-soft text-positive" aria-hidden>
        <Check className="size-5" />
      </span>
      <p className="eyebrow mt-4">Tudo pronto</p>
      <h1 className="mt-2 text-h4 font-semibold text-ink">Bem-vindo, {primeiro}.</h1>
      {semTrial ? (
        <p className="mt-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-body text-ink">
          Seu perfil foi criado, mas esse CPF já usou o período de teste. Para começar a atender, escolha um plano.
        </p>
      ) : (
        <p className="mt-2 text-body text-ink-soft">
          Seu perfil está ativo{criado.trialDays ? ` e você tem ${criado.trialDays} dias de teste` : ""}. Escolha por onde começar:
        </p>
      )}
      {semTrial ? (
        <Button asChild size="lg" className="mt-6 w-full">
          <Link to="/assinatura">
            Ver planos <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {proximos.map((p) => (
              <li key={p.href}>
                <Link to={p.href} className="flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-brand/60">
                  <p.Icone className="size-4 shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{p.t}</span>
                    <span className="block text-caption text-ink-mute">{p.d}</span>
                  </span>
                  <ArrowRight className="size-4 text-ink-mute" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild variant="ghost" className="mt-4 w-full">
            <Link to={destino}>Pular e continuar</Link>
          </Button>
        </>
      )}
    </MolduraPublica>
  );
}

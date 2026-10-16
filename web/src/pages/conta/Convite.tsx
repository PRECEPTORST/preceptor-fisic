import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MOTIVO_CONVITE } from "@/lib/conta";
import { CHAVE_SESSAO } from "@/hooks/useSessao";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";

type Resposta = { situacao: string; clinica: string; convidado: string; voce: { nome: string; email: string } };

export const chaveConvite = (token: string) => ["convite", token] as const;

export default function Convite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: chaveConvite(token), queryFn: () => api<Resposta>(`/convite/${encodeURIComponent(token)}`), retry: false });
  const aceitar = useMutation({
    mutationFn: () => api<{ clinica: string }>(`/convite/${encodeURIComponent(token)}/aceitar`, { method: "POST" }),
    onSuccess: (r) => {
      toast.success(`Pronto, você entrou na ${r.clinica}.`);
      // O acesso agora vem da clínica: recarrega a sessão antes de ir pro app.
      qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
      navigate("/dashboard", { replace: true });
    },
    onError: (e) => toast.error(`Não consegui aceitar o convite: ${e.message}`),
  });

  return (
    <div className="mx-auto max-w-lg py-8 sm:py-14">
      <QueryState query={q} skeleton={<Skeleton className="h-80 w-full" />}>
        {(d) =>
          d.situacao !== "valido" ? (
            <section className="text-center" aria-labelledby="titulo">
              <p className="eyebrow">Convite</p>
              <h1 id="titulo" className="mt-2 text-h4 font-semibold text-ink">
                Convite indisponível
              </h1>
              <p className="mt-2 text-body-lg text-ink-soft">{MOTIVO_CONVITE[d.situacao] ?? "Esse convite não pode ser usado."}</p>
              <Button asChild size="lg" className="mt-6">
                <Link to="/dashboard">Ir para o app</Link>
              </Button>
            </section>
          ) : (
            <section aria-labelledby="titulo">
              <p className="eyebrow">Convite</p>
              <h1 id="titulo" className="mt-2 text-h4 font-semibold text-ink">
                Entrar na {d.clinica}
              </h1>
              <p className="mt-2 text-body-lg text-ink-soft">
                Ao aceitar, sua conta passa a fazer parte da clínica. O acesso à plataforma passa a vir da assinatura dela, e as gerações
                por IA saem da franquia da equipe.
              </p>
              <dl className="mt-6 divide-y divide-line rounded-lg border border-line bg-bg-elevated">
                <div className="px-4 py-3">
                  <dt className="eyebrow">Sua conta</dt>
                  <dd className="mt-1 font-medium text-ink">{d.voce.nome}</dd>
                  <dd className="font-mono text-caption text-ink-mute">{d.voce.email}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="eyebrow">Convite enviado para</dt>
                  <dd className="mt-1 font-mono text-body text-ink">{d.convidado}</dd>
                </div>
              </dl>
              <p className="mt-4 text-caption text-ink-mute">
                Seus alunos e planos continuam seus. A clínica passa a ver quantos alunos e quantos planos você tem, sem acessar a ficha
                clínica de ninguém.
              </p>
              <Button size="lg" className="mt-6 w-full" disabled={aceitar.isPending} onClick={() => aceitar.mutate()}>
                {aceitar.isPending ? "Entrando…" : `Aceitar e entrar na ${d.clinica}`}
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link to="/dashboard">Agora não</Link>
              </Button>
            </section>
          )
        }
      </QueryState>
    </div>
  );
}

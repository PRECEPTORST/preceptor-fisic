import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { linkWhatsapp, numerosDoAcervo } from "@/lib/conta";
import { numero } from "@/lib/format";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Resposta =
  | { temAcesso: true }
  | { temAcesso: false; usouTrial: boolean; acervo: { alunos: number; planos: number; publicados: number }; nome: string };

export const CHAVE_UPGRADE = ["upgrade"] as const;

/**
 * Muro de quem está sem acesso, dentro do shell: a pessoa continua vendo o que
 * construiu. Uma frase do que aconteceu, o que continua salvo e UM caminho.
 */
export default function Upgrade() {
  const q = useQuery({ queryKey: CHAVE_UPGRADE, queryFn: () => api<Resposta>("/upgrade") });
  return (
    <QueryState query={q} skeleton={<Skeleton className="mx-auto mt-12 h-72 max-w-xl" />}>
      {(d) => {
        if (d.temAcesso) return <Navigate to="/dashboard" replace />;
        const numeros = numerosDoAcervo(d.acervo);
        return (
          <section className="mx-auto max-w-xl py-10 text-center sm:py-16" aria-labelledby="muro">
            <p className="eyebrow">{d.usouTrial ? "Teste encerrado" : "Assinatura"}</p>
            <h1 id="muro" className="mt-3 text-h4 font-semibold text-ink">
              {d.usouTrial ? `${d.nome}, seus 7 dias acabaram.` : `${d.nome}, falta assinar para começar.`}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-body-lg text-ink-soft">
              {d.usouTrial && numeros.length > 0
                ? "Nada foi apagado. Seus alunos, avaliações e planos continuam salvos e voltam a aparecer assim que o pagamento confirmar."
                : d.usouTrial
                  ? "Assine para voltar a cadastrar alunos e prescrever treinos."
                  : "Escolha um plano para liberar o cadastro de alunos e a prescrição."}
            </p>

            {numeros.length > 0 && (
              <>
                <ul className="mt-8 flex flex-wrap justify-center gap-3" aria-label="O que está guardado na sua conta">
                  {numeros.map((i) => (
                    <li key={i.label} className="min-w-28 rounded-lg border border-line bg-bg-elevated px-5 py-4">
                      <span className="num block text-h4 font-semibold text-ink">{numero(i.n)}</span>
                      <span className="eyebrow mt-1 block">{i.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-caption text-ink-mute">Guardados na sua conta, esperando você voltar.</p>
              </>
            )}

            <div className="mt-8 flex flex-col items-center gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/assinatura">
                  Ver planos e assinar <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Link to="/guia" className="text-body text-ink-mute hover:text-ink">
                Ler o guia de uso antes
              </Link>
            </div>

            <p className="mt-10 border-t border-line pt-5 text-caption text-ink-mute">
              Dúvida sobre qual plano faz sentido para você?{" "}
              <a
                href={linkWhatsapp("Olá! Tenho uma dúvida sobre os planos do PreceptorFISIC.")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline-offset-4 hover:underline"
              >
                Fale com o time no WhatsApp
              </a>
            </p>
          </section>
        );
      }}
    </QueryState>
  );
}

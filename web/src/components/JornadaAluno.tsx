import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { ETAPAS, indiceEtapa, proximoPasso, type EstadoJornada } from "@/lib/jornada";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Stepper da jornada + CTA do próximo passo (brief §4.1). */
export function JornadaAluno({ estado }: { estado: EstadoJornada }) {
  const passo = proximoPasso(estado);
  const atual = indiceEtapa(passo.etapa);
  const concluido = passo.etapa === "publicado";
  return (
    <section aria-label="Jornada do aluno" className="rounded-lg border border-line bg-bg-elevated p-4 shadow-card sm:p-5">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {ETAPAS.map((e, i) => {
          const feito = i < atual || (concluido && i === atual);
          const agora = i === atual && !concluido;
          return (
            <li key={e.id} className="flex items-center gap-1">
              <span
                aria-current={agora ? "step" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-caption",
                  feito && "text-ink-soft",
                  agora && "bg-brand-soft font-medium text-brand",
                  !feito && !agora && "text-ink-mute",
                )}
              >
                {feito ? (
                  <Check className="size-3.5 text-positive" aria-hidden />
                ) : (
                  <span className={cn("num text-micro", agora ? "text-brand" : "text-ink-disabled")}>{i + 1}</span>
                )}
                {e.label}
                <span className="sr-only">{feito ? " (concluído)" : agora ? " (etapa atual)" : ""}</span>
              </span>
              {i < ETAPAS.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Próximo passo</p>
          <p className="mt-0.5 text-body font-medium text-ink">{passo.label}</p>
          {passo.detalhe && <p className="text-caption text-warning">{passo.detalhe}</p>}
        </div>
        <Button asChild variant={concluido ? "outline" : "default"}>
          <Link to={passo.href}>
            {passo.label} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

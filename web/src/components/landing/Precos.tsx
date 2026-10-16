import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PLANOS, TESTE, WHATS_INSTITUCIONAL, hrefCadastro, precoExibido, type Ciclo } from "@/pages/landing/precos";

const fmt = (n: number | null) => (n == null ? "Ilimitados" : String(n));

export function Precos() {
  const [ciclo, setCiclo] = useState<Ciclo>("mensal");

  return (
    <div>
      <div className="lp-in flex justify-center">
        <div role="group" aria-label="Ciclo de cobrança" className="inline-flex rounded-full border border-line bg-bg-elevated p-1">
          {(["mensal", "anual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={ciclo === c}
              onClick={() => setCiclo(c)}
              className={`h-10 rounded-full px-5 text-body transition-colors ${
                ciclo === c ? "bg-brand font-medium text-brand-on" : "text-ink-soft hover:text-ink"
              }`}
            >
              {c === "mensal" ? "Mensal" : "Anual · 2 meses grátis"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANOS.map((p, i) => {
          const preco = precoExibido(p, ciclo);
          const inst = p.chave === "institucional";
          return (
            <article
              key={p.chave}
              style={{ ["--i" as string]: i }}
              className="lp-in flex flex-col rounded-lg border border-line bg-bg-elevated p-5 shadow-card"
            >
              <h3 className="text-h6 font-semibold text-ink">{p.nome}</h3>
              <p className="mt-1 min-h-[2.9em] text-caption text-ink-mute">{p.resumo}</p>

              <div className="mt-5">
                {preco.aPartirDe && <p className="text-caption text-ink-mute">a partir de</p>}
                <p className="flex items-baseline gap-1">
                  <span className="num text-h4 font-semibold text-ink">{preco.valor}</span>
                  <span className="text-caption text-ink-mute">{preco.periodo}</span>
                </p>
                <p className="num mt-1 min-h-[1.45em] text-caption text-ink-mute">{preco.equivale ?? preco.nota ?? ""}</p>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4">
                <div>
                  <dt className="eyebrow">Alunos</dt>
                  <dd className="num mt-1 text-body text-ink">{fmt(p.alunos)}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Treinos/mês</dt>
                  <dd className="num mt-1 text-body text-ink">{p.treinos}</dd>
                </div>
              </dl>

              <ul className="mt-4 flex-1 space-y-2">
                {p.itens.map((it) => (
                  <li key={it} className="flex gap-2 text-caption text-ink-soft">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-ink-mute" aria-hidden="true" />
                    {it}
                  </li>
                ))}
              </ul>

              <a
                href={inst ? WHATS_INSTITUCIONAL : hrefCadastro(p.chave as "basico", ciclo)}
                {...(inst ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`mt-6 inline-flex h-11 items-center justify-center rounded-md px-4 text-body font-medium transition-colors ${
                  inst
                    ? "border border-line-strong text-ink hover:bg-bg-subtle"
                    : "bg-brand text-brand-on hover:bg-brand-strong"
                }`}
              >
                {inst ? "Falar com um humano" : "Começar 7 dias grátis"}
              </a>
            </article>
          );
        })}
      </div>

      <p className="lp-in mt-6 text-center text-body text-ink-soft">
        Todo cadastro começa com {TESTE.dias} dias grátis, sem cartão: {TESTE.treinos} treinos por IA e até {TESTE.alunos} alunos.
      </p>

      <Collapsible className="lp-in mx-auto mt-8 max-w-4xl">
        <CollapsibleTrigger className="group mx-auto flex h-11 items-center gap-2 rounded-md px-4 text-body text-ink-soft transition-colors hover:text-ink">
          Comparar os planos
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-caption">
              <caption className="sr-only">Comparação dos planos</caption>
              <thead className="bg-bg-subtle text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-ink-mute">Recurso</th>
                  {PLANOS.map((p) => (
                    <th key={p.chave} scope="col" className="px-4 py-3 font-medium text-ink">{p.nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  ["Alunos ativos", ...PLANOS.map((p) => fmt(p.alunos))],
                  ["Treinos gerados por mês", ...PLANOS.map((p) => (p.chave === "institucional" ? "100 por equipe" : String(p.treinos)))],
                  ["Profissionais", "1", "1", "1", "Até 5"],
                  ["Diretrizes citadas e regras clínicas", "Sim", "Sim", "Sim", "Sim"],
                  ["App do aluno", "Sim", "Sim", "Sim", "Sim"],
                  ["Auditoria completa", "—", "—", "Sim", "—"],
                  ["Prioridade na geração", "—", "—", "Sim", "—"],
                  ["Onboarding dedicado", "—", "—", "—", "Sim"],
                ].map(([rotulo, ...vals]) => (
                  <tr key={rotulo}>
                    <th scope="row" className="px-4 py-3 text-left font-normal text-ink-soft">{rotulo}</th>
                    {vals.map((v, i) => (
                      <td key={i} className="num px-4 py-3 text-ink">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

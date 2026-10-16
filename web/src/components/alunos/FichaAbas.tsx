import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import type { SbcLevel } from "$lib/clinical/sbc-risk";
import { api } from "@/lib/api";
import {
  EXPERIENCIAS,
  categoriaImc,
  chipPlano,
  condicaoDeRisco,
  idade,
  imc,
  limitacoes,
  metaRisco,
  rotuloObjetivo,
  rotuloSexo,
  tendenciaPeso,
  tomPse,
} from "@/lib/alunos";
import type { Metrica, SemanaCarga } from "@/lib/carga";
import { data, dataHora, numero } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Ficha } from "@/pages/alunos/dados";
import { Button } from "@/components/ui/button";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { CalculadoraRiscoSbc } from "./CalculadoraRiscoSbc";
import { CardCarga } from "./FichaTopo";
import { Sparkline } from "./Graficos";
import { TOM_TEXTO } from "./tons";

const Card = ({ children, className, titulo, acao }: { children: React.ReactNode; className?: string; titulo?: string; acao?: React.ReactNode }) => (
  <section className={cn("rounded-lg border border-line bg-bg-elevated p-5 shadow-card", className)}>
    {(titulo || acao) && (
      <div className="mb-4 flex items-center justify-between gap-2">
        {titulo && <h2 className="text-h6 font-medium">{titulo}</h2>}
        {acao}
      </div>
    )}
    {children}
  </section>
);

const fmt = (n: number | null | undefined, casas = 1) => (n == null ? "—" : n.toFixed(casas).replace(".", ","));

/* ────────── Resumo ────────── */

export function AbaResumo({ f }: { f: Ficha }) {
  const d = f.detail;
  const s = d.student;
  const valorImc = imc(s.weightKg, s.heightCm);
  const cat = categoriaImc(valorImc);
  const risco = metaRisco(d.healthProfile?.cardiovascularRisk);
  const tend = tendenciaPeso(d.lastWeights);
  const sessoes = f.recentSessions;
  const pse7 = sessoes.filter((x) => Date.now() - new Date(x.date).getTime() < 7 * 86_400_000);
  const maxPse = pse7.reduce<number | null>((m, x) => (x.perceivedEffort != null && (m == null || x.perceivedEffort > m) ? x.perceivedEffort : m), null);
  const obs = sessoes.find((x) => x.observations);
  const diagnosticos = Array.isArray(d.healthProfile?.diagnoses) ? (d.healthProfile.diagnoses as { label: string }[]) : [];
  const sinais: { tom: StatusTone; texto: string }[] = [
    ...diagnosticos.filter((x) => condicaoDeRisco(x.label)).map((x) => ({ tom: "negative" as const, texto: `Condição de risco: ${x.label}` })),
    ...(maxPse != null && maxPse >= 9 ? [{ tom: "negative" as const, texto: `PSE ${maxPse} nos últimos 7 dias` }] : []),
    ...(obs ? [{ tom: "warning" as const, texto: `Observação do aluno: “${obs.observations}”` }] : []),
    ...(sessoes.length && Date.now() - new Date(sessoes[0]!.date).getTime() > 7 * 86_400_000 ? [{ tom: "warning" as const, texto: "Sem treino há mais de 7 dias" }] : []),
  ];
  const planoAtivo = d.plans.find((p) => p.isActive)?.id ?? null;

  const stats: { label: string; valor: string; unidade?: string; tom?: StatusTone; extra?: React.ReactNode }[] = [
    {
      label: "Peso",
      valor: fmt(s.weightKg),
      unidade: "kg",
      extra: tend && (
        <span className={cn("flex items-center gap-2", tend.sentido === "desce" ? "text-positive" : tend.sentido === "sobe" ? "text-warning" : "text-ink-mute")}>
          <Sparkline valores={d.lastWeights} largura={64} altura={16} />
          <span className="num text-caption">
            {tend.delta > 0 ? "+" : ""}
            {fmt(tend.delta)} kg
          </span>
        </span>
      ),
    },
    { label: "IMC", valor: fmt(valorImc), unidade: cat.label, tom: cat.tone },
    { label: "Sessões 7 dias", valor: numero(pse7.length) },
    { label: "PSE máx. 7 dias", valor: maxPse == null ? "—" : String(maxPse), tom: maxPse == null ? "neutral" : tomPse(maxPse) },
    { label: "Risco CV", valor: risco.label, tom: risco.tone },
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((x, i) => (
          <div key={x.label} className={cn("bg-bg-elevated p-4", i === 0 && "col-span-2 sm:col-span-1")}>
            <dt className="eyebrow">{x.label}</dt>
            <dd className="mt-2">
              <span className="flex items-baseline gap-1.5">
                <span className={cn("num text-h6 font-medium", TOM_TEXTO[x.tom ?? "neutral"])}>{x.valor}</span>
                {x.unidade && <span className="text-caption text-ink-mute">{x.unidade}</span>}
              </span>
              {x.extra && <span className="mt-2 block">{x.extra}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {sinais.length > 0 && (
        <Card titulo="Sinais de atenção">
          <ul className="divide-y divide-line">
            {sinais.map((x) => (
              <li key={x.texto} className="flex items-start gap-2.5 py-2.5 text-body first:pt-0 last:pb-0">
                <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", TOM_TEXTO[x.tom])} aria-hidden />
                {x.texto}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CardCarga semanas={f.loadEvolution.weeks as SemanaCarga[]} metrica={f.loadEvolution.externalMetric as Metrica} temDados={f.loadEvolution.hasData} planoAtivoId={planoAtivo} />

      <Card titulo="Últimas sessões">
        {sessoes.length === 0 ? (
          <p className="text-body text-ink-mute">O aluno ainda não registrou treino no app.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessoes.map((x) => (
              <li key={x.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-bg-subtle", TOM_TEXTO[tomPse(x.perceivedEffort)])}>
                  <span className="num text-body font-semibold">{x.perceivedEffort ?? "—"}</span>
                  <span className="text-micro">PSE</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-ink">{x.label ?? "Sessão"}</span>
                    <span className="num shrink-0 text-caption text-ink-mute">{dataHora(x.date)}</span>
                  </div>
                  <p className="num text-caption text-ink-mute">
                    {x.doneCount}/{x.totalCount} exercícios{x.durationMinutes ? ` · ${x.durationMinutes} min` : ""}
                  </p>
                  {x.observations && <p className="mt-1.5 border-l-2 border-warning pl-3 text-body text-ink-soft">“{x.observations}”</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ────────── Treino ────────── */

export function AbaTreino({ f }: { f: Ficha }) {
  const id = f.detail.student.id;
  const planos = f.detail.plans;
  const ativo = planos.find((p) => p.isActive);
  const acoes = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link to={`/alunos/${id}/manual`}>Montar na mão</Link>
      </Button>
      <Button asChild>
        <Link to={`/alunos/${id}/gerar`}>
          <Plus aria-hidden /> Gerar plano
        </Link>
      </Button>
    </div>
  );
  if (planos.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Nenhum plano ainda" description="Gere o primeiro plano a partir do perfil clínico ou monte na mão, exercício por exercício." action={acoes} />
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {ativo && (
        <Card titulo="Plano em vigor" acao={<StatusChip tone="brand">Ativo</StatusChip>}>
          <p className="text-body font-medium text-ink">{ativo.title}</p>
          <p className="num mt-0.5 text-caption text-ink-mute">
            {ativo.sessionsTotal} {ativo.sessionsTotal === 1 ? "sessão" : "sessões"} por semana · criado em {data(ativo.createdAt)}
          </p>
          <Button asChild className="mt-4">
            <Link to={`/treinos/${ativo.id}`}>Abrir editor</Link>
          </Button>
        </Card>
      )}
      <Card titulo="Histórico de planos" acao={acoes}>
        <ul className="-mx-5 divide-y divide-line border-t border-line">
          {planos.map((p) => {
            const chip = chipPlano(p);
            return (
              <li key={p.id}>
                <Link to={`/treinos/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-subtle">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{p.title}</span>
                    <span className="num block text-caption text-ink-mute">
                      {data(p.createdAt)} · {p.sessionsTotal} {p.sessionsTotal === 1 ? "sessão" : "sessões"}
                    </span>
                  </span>
                  <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  <ChevronRight className="size-4 text-ink-mute" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ────────── Avaliações ────────── */

const METRICAS = [
  { k: "weight", label: "Peso", unidade: "kg", menorMelhor: true },
  { k: "bmi", label: "IMC", unidade: "", menorMelhor: true },
  { k: "bodyFat", label: "Gordura", unidade: "%", menorMelhor: true },
  { k: "restingHr", label: "FC repouso", unidade: "bpm", menorMelhor: true },
  { k: "bpSystolic", label: "PA sistólica", unidade: "mmHg", menorMelhor: true },
] as const;

export function AbaAvaliacoes({ f, onNova }: { f: Ficha; onNova: () => void }) {
  const d = f.detail;
  const lista = d.assessments;
  const nova = (
    <Button onClick={onNova}>
      <Plus aria-hidden /> Nova avaliação
    </Button>
  );
  if (lista.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Nenhuma avaliação" description="Registre a primeira para acompanhar peso, composição e pressão." action={nova} />
      </Card>
    );
  }
  const metricas = METRICAS.map((m) => ({ ...m, s: d.progress[m.k] })).filter((m) => m.s.values.length > 0);
  return (
    <div className="space-y-6">
      {metricas.length > 0 && (
        <section aria-label="Evolução clínica" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-5">
          {metricas.map((m) => {
            const delta = m.s.deltaPct;
            const melhorou = delta != null && (m.menorMelhor ? delta < 0 : delta > 0);
            return (
              <div key={m.k} className="bg-bg-elevated p-4">
                <p className="eyebrow">{m.label}</p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="num text-h6 font-medium text-ink">{fmt(m.s.current)}</span>
                  {m.unidade && <span className="text-caption text-ink-mute">{m.unidade}</span>}
                </p>
                <div className={cn("mt-2 flex items-center gap-2", melhorou ? "text-positive" : "text-warning")}>
                  <Sparkline valores={m.s.values} largura={64} altura={16} />
                  {delta != null && Math.abs(delta) > 0.5 && (
                    <span className="num text-caption">
                      {delta > 0 ? "+" : ""}
                      {fmt(delta)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
      <Card titulo="Linha do tempo" acao={nova}>
        <ol className="-mx-5 divide-y divide-line border-t border-line">
          {lista.map((a, i) => {
            const anterior = lista[i + 1];
            const dImc = a.bmi != null && anterior?.bmi != null ? Math.round((a.bmi - anterior.bmi) * 10) / 10 : null;
            const itens = [
              a.bmi != null && `IMC ${fmt(a.bmi)}${dImc ? ` (${dImc > 0 ? "+" : ""}${fmt(dImc)} vs. anterior)` : ""}`,
              a.bodyFatPct != null && `${fmt(a.bodyFatPct)}% gordura`,
              a.restingHr != null && `FC ${a.restingHr} bpm`,
              a.bloodPressureSystolic != null && `PA ${a.bloodPressureSystolic}/${a.bloodPressureDiastolic ?? "—"}`,
            ].filter(Boolean);
            return (
              <li key={a.id} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{a.bodyFatPct != null ? "Bioimpedância" : "Antropometria"}</span>
                  <span className="num text-caption text-ink-mute">{data(a.assessedAt)}</span>
                </div>
                {itens.length > 0 && <p className="num mt-0.5 text-caption text-ink-soft">{itens.join(" · ")}</p>}
                {a.notes && <p className="mt-1 text-body text-ink-soft">{a.notes}</p>}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

/* ────────── Clínico ────────── */

export function AbaClinico({ f, chave }: { f: Ficha; chave: readonly unknown[] }) {
  const qc = useQueryClient();
  const d = f.detail;
  const s = d.student;
  const hp = d.healthProfile;
  const p = d.preferences;
  const diagnosticos = Array.isArray(hp?.diagnoses) ? (hp.diagnoses as { label: string; severity?: string }[]) : [];
  const meds = Array.isArray(hp?.medications) ? (hp.medications as { name: string; dose?: string; frequency?: string }[]) : [];
  const lim = limitacoes(hp);
  const objetivos = Array.isArray(p?.goals) ? (p.goals as string[]) : [];
  const risco = metaRisco(hp?.cardiovascularRisk);
  const pas = d.assessments.find((a) => a.bloodPressureSystolic != null)?.bloodPressureSystolic ?? null;

  const aplicar = useMutation({
    mutationFn: (level: SbcLevel) => api<{ level: string }>(`/alunos/${s.id}/risco-cv`, { method: "PUT", json: { level } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: chave });
      toast.success(`Risco CV salvo: ${metaRisco(r.level).label.toLowerCase()}.`);
    },
    onError: (e: Error) => toast.error(`Não consegui salvar o risco: ${e.message}`),
  });

  const Lista = ({ itens, vazio }: { itens: React.ReactNode[]; vazio: string }) =>
    itens.length === 0 ? (
      <p className="text-body text-ink-mute">{vazio}</p>
    ) : (
      <ul className="divide-y divide-line">
        {itens.map((x, i) => (
          <li key={i} className="py-2.5 text-body first:pt-0 last:pb-0">
            {x}
          </li>
        ))}
      </ul>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card titulo="Risco cardiovascular" acao={<StatusChip tone={risco.tone}>{risco.label}</StatusChip>}>
          <CalculadoraRiscoSbc idade={idade(s.birthDate)} sexo={s.sex} pasInicial={pas} onAplicar={(n) => aplicar.mutate(n)} aplicando={aplicar.isPending} />
        </Card>
        <Card titulo="Histórico médico">
          <Lista
            vazio="Nenhuma condição registrada."
            itens={diagnosticos.map((x) => (
              <span className={cn("flex items-center gap-2", condicaoDeRisco(x.label) && "text-negative")}>
                {condicaoDeRisco(x.label) && <AlertTriangle className="size-4" aria-label="Condição de risco" />}
                {x.label}
                {x.severity && <span className="text-ink-mute">· {x.severity}</span>}
              </span>
            ))}
          />
        </Card>
        <Card titulo="Medicações em uso">
          <Lista
            vazio="Nenhuma medicação registrada."
            itens={meds.map((m) => (
              <span className="flex justify-between gap-3">
                <span>
                  {m.name}
                  {m.dose ? ` · ${m.dose}` : ""}
                </span>
                <span className="text-caption text-ink-mute">{m.frequency ?? "contínuo"}</span>
              </span>
            ))}
          />
        </Card>
        <Card titulo="Limitações físicas">
          <Lista vazio="Sem limitações." itens={lim} />
        </Card>
      </div>
      <Card titulo="Preferências" acao={<Button variant="ghost" size="sm" asChild><Link to={`/alunos/${s.id}/editar`}>Editar</Link></Button>}>
        <dl className="space-y-4">
          <div>
            <dt className="eyebrow">Objetivos</dt>
            <dd className="mt-1 text-body text-ink">{objetivos.length ? objetivos.map(rotuloObjetivo).join(", ") : "Sem objetivos definidos"}</dd>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="eyebrow">Frequência</dt>
              <dd className="num mt-1 text-body text-ink">{p?.weeklySessions ?? "—"} por semana</dd>
            </div>
            <div>
              <dt className="eyebrow">Sessão</dt>
              <dd className="num mt-1 text-body text-ink">{p?.minutesPerSession ?? "—"} min</dd>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="eyebrow">Nível</dt>
              <dd className="mt-1 text-body text-ink">{EXPERIENCIAS.find((x) => x.id === p?.experienceLevel)?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Sexo</dt>
              <dd className="mt-1 text-body text-ink">{rotuloSexo(s.sex)}</dd>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="eyebrow">Telefone</dt>
              <dd className="num mt-1 truncate text-body text-ink">{s.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="eyebrow">E-mail</dt>
              <dd className="mt-1 truncate text-body text-ink">{s.email ?? "—"}</dd>
            </div>
          </div>
        </dl>
      </Card>
    </div>
  );
}

/* ────────── Mensagens ────────── */

/** A conversa embutida é do domínio rotina (mensagens); aqui, o atalho para ela. */
export function AbaMensagens({ f }: { f: Ficha }) {
  return (
    <Card>
      <EmptyState
        compact
        decorative={<MessageSquare className="size-12" />}
        title={`Conversa com ${f.detail.student.name.split(" ")[0]}`}
        description="As mensagens ficam na caixa de entrada."
        action={
          <Button asChild>
            <Link to={`/mensagens?aluno=${f.detail.student.id}`}>Abrir conversa</Link>
          </Button>
        }
      />
    </Card>
  );
}

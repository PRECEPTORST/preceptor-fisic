import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Clock, Copy, Link2, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { computeAcwr } from "$lib/training-metrics";
import { condicaoDeRisco, idade, metaRisco, rotuloObjetivo } from "@/lib/alunos";
import type { Metrica, SemanaCarga } from "@/lib/carga";
import { numero } from "@/lib/format";
import type { DetalheAluno } from "@/pages/alunos/dados";
import { Avatar } from "@/components/Avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GraficoCarga } from "./Graficos";
import { copiar } from "./copiar";

/** Cabeçalho da ficha (brief §4.1): identidade, risco e plano numa linha; ações secundárias no ⋯. */
export function FichaHero({ d, onLink, onExcluir, excluindo }: { d: DetalheAluno; onLink: () => void; onExcluir: () => void; excluindo: boolean }) {
  const s = d.student;
  const [confirmar, setConfirmar] = useState(false);
  const anos = idade(s.birthDate);
  const objetivos = Array.isArray(d.preferences?.goals) ? (d.preferences.goals as string[]) : [];
  const diagnosticos = Array.isArray(d.healthProfile?.diagnoses) ? (d.healthProfile.diagnoses as { label: string }[]) : [];
  const atencao = diagnosticos.some((x) => condicaoDeRisco(x.label));
  const ativo = d.plans.find((p) => p.isActive);
  const risco = metaRisco(d.healthProfile?.cardiovascularRisk);

  return (
    <header className="space-y-4">
      <Link to="/alunos" className="inline-flex items-center gap-1.5 text-caption text-ink-mute hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Alunos
      </Link>
      <div className="flex items-start gap-4">
        <Avatar nome={s.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h4 font-semibold text-ink">{s.name}</h1>
            {atencao && (
              <StatusChip tone="negative" dot={false}>
                <AlertTriangle className="size-3" aria-hidden /> Atenção clínica
              </StatusChip>
            )}
          </div>
          <p className="mt-1 text-body text-ink-mute">
            {anos != null && (
              <>
                <span className="num">{anos}</span> anos ·{" "}
              </>
            )}
            {objetivos[0] ? rotuloObjetivo(objetivos[0]) : "sem objetivo"}
          </p>
          <p className="mt-0.5 text-caption text-ink-mute">
            Risco CV: <span className="text-ink-soft">{risco.label.toLowerCase()}</span> · Plano:{" "}
            <span className="text-ink-soft">{ativo ? `${ativo.title} · ativo` : "nenhum em vigor"}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link to={`/mensagens?aluno=${s.id}`}>
              <MessageSquare aria-hidden /> Mensagem
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais ações do aluno">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link to={`/alunos/${s.id}/editar`}>
                  <Pencil className="mr-2 size-4" aria-hidden /> Editar dados
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onLink}>
                <Link2 className="mr-2 size-4" aria-hidden /> Link do aluno
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="sm:hidden">
                <Link to={`/mensagens?aluno=${s.id}`}>
                  <MessageSquare className="mr-2 size-4" aria-hidden /> Mensagem
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirmar(true)} className="text-negative focus:text-negative">
                <Trash2 className="mr-2 size-4" aria-hidden /> Excluir aluno
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {s.name}?</AlertDialogTitle>
            <AlertDialogDescription>O aluno sai das listas e do painel. Os dados ficam guardados para LGPD e auditoria.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} disabled={excluindo} onClick={onExcluir}>
              Excluir aluno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

/** Aluno criado por link que ainda não completou o perfil. */
export function AvisoPendente({ fillUrl }: { fillUrl: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 sm:flex-row sm:items-center">
      <Clock className="size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex-1">
        <h2 className="text-body font-medium text-ink">Esperando o aluno preencher</h2>
        <p className="text-caption text-ink-soft">Envie o link para ele completar o perfil clínico e as preferências.</p>
      </div>
      <Button variant="outline" onClick={() => copiar(fillUrl, "Link de preenchimento copiado.")}>
        <Copy aria-hidden /> Copiar link
      </Button>
    </section>
  );
}

const TOM_ACWR: Record<string, StatusTone> = { sem_dados: "neutral", baixa: "info", otima: "positive", atencao: "warning", alto_risco: "negative" };

/** Evolução de carga externa × interna, com o ACWR (risco de lesão) e atalho para ajustar o plano. */
export function CardCarga({ semanas, metrica, temDados, planoAtivoId }: { semanas: SemanaCarga[]; metrica: Metrica; temDados: boolean; planoAtivoId: string | null }) {
  if (!temDados) {
    return (
      <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <p className="eyebrow">Evolução de carga</p>
        <p className="mt-2 text-body text-ink-mute">O gráfico aparece quando o aluno registrar treinos com PSE e carga no app.</p>
      </section>
    );
  }
  const acwr = computeAcwr(semanas);
  const emRisco = acwr.level === "atencao" || acwr.level === "alto_risco";
  return (
    <section aria-labelledby="carga" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Evolução de carga · 12 semanas</p>
          <h2 id="carga" className="mt-1 text-h6 font-medium">
            Trabalho feito × esforço pago
          </h2>
        </div>
        {acwr.ratio !== null && <StatusChip tone={TOM_ACWR[acwr.level] ?? "neutral"}>Risco: {acwr.label}</StatusChip>}
      </div>
      {acwr.ratio !== null && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-4">
          <span className="num text-caption text-ink-soft">
            ACWR {acwr.ratio.toFixed(2).replace(".", ",")} · aguda {numero(acwr.acute)} / crônica {numero(acwr.chronic)} UA
          </span>
          <span className="text-caption text-ink-mute">{acwr.hint}</span>
          {emRisco && planoAtivoId && (
            <Button variant="outline" size="sm" asChild className="ml-auto">
              <Link to={`/treinos/${planoAtivoId}`}>Ajustar carga</Link>
            </Button>
          )}
        </div>
      )}
      <GraficoCarga semanas={semanas} metrica={metrica} />
    </section>
  );
}

import { useQuery } from "@tanstack/react-query";
import { apiAluno } from "@/lib/aluno-api";
import { dataRelativa } from "@/lib/aluno-treino";
import { useTitulo } from "@/lib/useTitulo";
import { AlunoShell, useAlunoLink } from "@/components/publico/AlunoShell";
import { AlunoEstado } from "@/components/publico/AlunoEstado";
import { SkeletonLista } from "@/components/QueryState";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { chaveHistorico, type HistoricoAluno } from "./tipos";

export default function Historico() {
  const { id, token } = useAlunoLink();
  const q = useQuery({ queryKey: chaveHistorico(id), queryFn: () => apiAluno<HistoricoAluno>(id, token, "/historico") });
  useTitulo(`Histórico · ${q.data?.student.name ?? "Meu treino"}`);

  return (
    <AlunoShell titulo="Histórico" subtitulo={q.data ? `${q.data.total} ${q.data.total === 1 ? "sessão registrada" : "sessões registradas"}` : undefined}>
      <AlunoEstado
        query={q}
        skeleton={<SkeletonLista linhas={6} />}
        isEmpty={(d) => d.sessions.length === 0}
        empty={<EmptyState compact title="Nenhum treino registrado ainda" description="Quando você concluir um treino, ele aparece aqui." />}
      >
        {(d) => (
          <div className="animate-soft-fade space-y-3">
            {d.total > d.sessions.length && (
              <p className="text-caption text-ink-mute">
                Mostrando os <span className="num">{d.sessions.length}</span> mais recentes.
              </p>
            )}
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card">
              {d.sessions.map((s) => {
                const lista = s.exercisesDone ?? [];
                const feitos = lista.filter((x) => x.completed).length;
                const completo = lista.length > 0 && feitos === lista.length;
                return (
                  <li key={s.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow">{dataRelativa(s.sessionDate)}</p>
                        <p className="mt-1 truncate font-medium">{s.sessionLabel ?? "Sessão"}</p>
                      </div>
                      <StatusChip tone={completo ? "positive" : feitos > 0 ? "warning" : "neutral"}>
                        {completo ? "completo" : feitos > 0 ? "parcial" : "sem registro"}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-caption text-ink-mute">
                      <span className="num">
                        {feitos}/{lista.length}
                      </span>{" "}
                      exercícios
                      {s.perceivedEffort != null && (
                        <>
                          {" "}
                          · PSE <span className="num text-ink-soft">{s.perceivedEffort}</span>
                        </>
                      )}
                    </p>
                    {s.observations && <p className="mt-2 border-l-2 border-line pl-3 text-body text-ink-soft">{s.observations}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </AlunoEstado>
    </AlunoShell>
  );
}

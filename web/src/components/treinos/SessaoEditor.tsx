import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftRight, ChevronDown, ChevronRight, ChevronUp, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { CatalogMap, PlanExercise, PlanSessionData } from "$lib/server/queries";
import { BLOCOS, letraSessao, mensagemValidacao, termoInicial, type Bloco } from "@/lib/treinos";
import type { Validacao } from "@/lib/treinos-tipos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmarControlado } from "./ConfirmarControlado";
import { EditorExercicio } from "./EditorExercicio";
import { Painel } from "./Painel";
import { SeletorCatalogo } from "./SeletorCatalogo";
import { useAcaoPlano } from "./useAcaoPlano";

type Alvo = { bloco: Bloco; j: number; ex: PlanExercise };
type Aberto =
  | { modo: "editar" | "trocar" | "video" | "excluir"; alvo: Alvo }
  | { modo: "adicionar"; bloco: Bloco; rotulo: string }
  | null;
type RespostaMutacao = { validation?: Validacao | null; newName?: string };

/**
 * Uma sessão no editor (brief §4.2): blocos com linhas de exercício, ↑/↓ por
 * teclado, e Vídeo/Trocar/Editar/Excluir num menu de linha. Editar, trocar e
 * adicionar abrem em painel (Sheet) sobre o editor.
 */
export function SessaoEditor({
  planoId,
  sessao,
  i,
  catalogMap,
  somenteLeitura,
}: {
  planoId: string;
  sessao: PlanSessionData;
  i: number;
  catalogMap: CatalogMap;
  somenteLeitura: boolean;
}) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const acao = useAcaoPlano<RespostaMutacao>(planoId);
  const total = BLOCOS.reduce((n, [k]) => n + (sessao[k]?.length ?? 0), 0);
  const fechar = () => setAberto(null);

  function rodar(path: string, json: unknown, base: string, method: "POST" | "PATCH" = "POST") {
    acao.mutate(
      { path, json, method },
      {
        onSuccess: (r) => {
          const m = mensagemValidacao(r?.newName ? `${base} ${r.newName}.` : base, r?.validation);
          if (m.tipo === "warning") toast.warning(m.texto);
          else toast.success(m.texto);
          fechar();
        },
        onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
      },
    );
  }
  const pos = (a: Alvo) => ({ sessionIdx: i, block: a.bloco, exerciseIdx: a.j });
  const alvo = aberto && "alvo" in aberto ? aberto.alvo : null;
  const video = alvo?.ex.catalog_id ? catalogMap[alvo.ex.catalog_id] : undefined;

  return (
    <article id={`sessao-${i}`} className="scroll-mt-6 rounded-lg border border-line bg-bg-elevated shadow-card">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="num flex size-9 shrink-0 items-center justify-center rounded-md bg-bg-subtle font-medium text-ink" aria-hidden>
          {letraSessao(i)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-h6 font-medium text-ink">{sessao.label ?? `Sessão ${i + 1}`}</h3>
          <p className="truncate text-caption text-ink-mute">
            <span className="num">{total}</span> exercícios
            {sessao.duration_minutes ? (
              <>
                {" · "}
                <span className="num">{sessao.duration_minutes}</span> min
              </>
            ) : null}
            {sessao.focus ? ` · ${sessao.focus}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/treinos/${planoId}/sessoes/${i}`}>
            Detalhe <ChevronRight aria-hidden />
          </Link>
        </Button>
      </header>

      {BLOCOS.map(([bloco, rotulo]) => {
        const lista = sessao[bloco] ?? [];
        if (lista.length === 0 && somenteLeitura) return null;
        return (
          <div key={bloco} className="border-b border-line last:border-b-0">
            <div className="flex items-center justify-between px-5 pt-3">
              <p className="eyebrow">{rotulo}</p>
              {!somenteLeitura && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-ink-soft"
                  onClick={() => setAberto({ modo: "adicionar", bloco, rotulo })}
                  aria-label={`Adicionar exercício em ${rotulo.toLowerCase()}`}
                >
                  <Plus aria-hidden /> Adicionar
                </Button>
              )}
            </div>
            {lista.length === 0 ? (
              <p className="px-5 pb-3 text-caption text-ink-mute">Nenhum exercício neste bloco.</p>
            ) : (
              <ol className="divide-y divide-line">
                {lista.map((ex, j) => (
                  <li key={ex.name + j} className="flex items-center gap-3 px-5 py-3">
                    {!somenteLeitura && lista.length > 1 ? (
                      // Move só dentro do próprio bloco (o servidor troca dentro daquele array).
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={j === 0 || acao.isPending}
                          onClick={() => rodar("/exercicios/mover", { ...pos({ bloco, j, ex }), direction: "up" }, "Ordem atualizada.")}
                          aria-label={`Mover ${ex.name} para cima`}
                          className="rounded p-0.5 text-ink-mute hover:text-ink disabled:opacity-30"
                        >
                          <ChevronUp className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={j === lista.length - 1 || acao.isPending}
                          onClick={() => rodar("/exercicios/mover", { ...pos({ bloco, j, ex }), direction: "down" }, "Ordem atualizada.")}
                          aria-label={`Mover ${ex.name} para baixo`}
                          className="rounded p-0.5 text-ink-mute hover:text-ink disabled:opacity-30"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="num w-5 text-center text-caption text-ink-mute">{j + 1}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{ex.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-ink-soft">
                        <span className="num">
                          {ex.sets ?? "—"} × {ex.reps ?? "—"}
                        </span>
                        <span>
                          descanso <span className="num">{ex.rest_seconds ?? "—"}s</span>
                        </span>
                        {ex.intensity && <span className="num">{ex.intensity}</span>}
                        {ex.load_guidance && <span className="num">{ex.load_guidance}</span>}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Ações de ${ex.name}`}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ex.catalog_id && catalogMap[ex.catalog_id]?.videoUrl && (
                          <DropdownMenuItem onSelect={() => setAberto({ modo: "video", alvo: { bloco, j, ex } })}>
                            <Play aria-hidden /> Ver vídeo
                          </DropdownMenuItem>
                        )}
                        {!somenteLeitura && (
                          <>
                            <DropdownMenuItem onSelect={() => setAberto({ modo: "trocar", alvo: { bloco, j, ex } })}>
                              <ArrowLeftRight aria-hidden /> Trocar exercício
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setAberto({ modo: "editar", alvo: { bloco, j, ex } })}>
                              <Pencil aria-hidden /> Editar prescrição
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-negative focus:text-negative"
                              onSelect={() => setAberto({ modo: "excluir", alvo: { bloco, j, ex } })}
                            >
                              <Trash2 aria-hidden /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                        {somenteLeitura && !(ex.catalog_id && catalogMap[ex.catalog_id]?.videoUrl) && (
                          <DropdownMenuItem disabled>Treino arquivado: só leitura</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}

      <Painel
        aberto={aberto?.modo === "editar"}
        onFechar={fechar}
        titulo="Editar prescrição"
        descricao={alvo?.ex.name}
      >
        {alvo && (
          <EditorExercicio
            key={`${alvo.bloco}-${alvo.j}`}
            ex={alvo.ex}
            pendente={acao.isPending}
            onCancelar={fechar}
            onSalvar={(d) => rodar("/exercicios", { ...pos(alvo), ...d }, "Exercício atualizado.", "PATCH")}
          />
        )}
      </Painel>
      <Painel
        aberto={aberto?.modo === "trocar"}
        onFechar={fechar}
        titulo="Trocar exercício"
        descricao={alvo ? `No lugar de ${alvo.ex.name}. A validação clínica roda de novo.` : undefined}
      >
        {alvo && (
          <SeletorCatalogo
            key={`${alvo.bloco}-${alvo.j}`}
            planoId={planoId}
            modo="trocar"
            termoInicial={termoInicial(alvo.ex)}
            pendente={acao.isPending}
            onCancelar={fechar}
            onConfirmar={(c, manter) =>
              rodar("/exercicios/trocar", { ...pos(alvo), catalogId: c.id, keepPrescription: manter }, "Trocado por")
            }
          />
        )}
      </Painel>
      <Painel
        aberto={aberto?.modo === "adicionar"}
        onFechar={fechar}
        titulo="Adicionar exercício"
        descricao={aberto?.modo === "adicionar" ? `Em ${aberto.rotulo.toLowerCase()} · ${sessao.label ?? `Sessão ${i + 1}`}` : undefined}
      >
        {aberto?.modo === "adicionar" && (
          <SeletorCatalogo
            planoId={planoId}
            modo="adicionar"
            termoInicial=""
            pendente={acao.isPending}
            onCancelar={fechar}
            onConfirmar={(c) => rodar("/exercicios", { sessionIdx: i, block: aberto.bloco, catalogId: c.id }, "Adicionado:")}
          />
        )}
      </Painel>
      <Painel aberto={aberto?.modo === "video"} onFechar={fechar} titulo={alvo?.ex.name ?? "Vídeo"}>
        {video?.videoUrl && (
          <div className="space-y-4">
            <img src={video.videoUrl} alt={`Demonstração: ${alvo?.ex.name}`} loading="lazy" className="w-full rounded-md" />
            {video.instructions.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-body text-ink-soft">
                {video.instructions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Painel>
      <ConfirmarControlado
        aberto={aberto?.modo === "excluir"}
        onFechar={fechar}
        titulo={`Excluir "${alvo?.ex.name ?? ""}"?`}
        descricao="O exercício sai desta sessão e a validação clínica roda de novo."
        confirmar="Excluir"
        onConfirmar={() => alvo && rodar("/exercicios/remover", pos(alvo), "Exercício removido.")}
      />
    </article>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "$lib/server/db/schema";
import { api } from "@/lib/api";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { RESPOSTAS_RAPIDAS, filtrarConversas, horaCurta } from "@/lib/rotina";
import { cn } from "@/lib/utils";
import { CHAVE_SESSAO } from "@/hooks/useSessao";
import { PageHeader } from "@/components/PageHeader";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Chip } from "@/components/rotina/Chip";
import { CHAVE_CONVERSAS, chaveConversa } from "./chaves";

type Conversa = {
  id: string;
  studentId: string;
  studentName: string;
  last: string | null;
  lastAt: string | null;
  unread: number;
};
type Mensagem = Omit<Message, "createdAt" | "readAt"> & { createdAt: string; readAt: string | null };

export default function Mensagens() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const ativaId = params.get("t");
  const q = useQuery({
    queryKey: CHAVE_CONVERSAS,
    queryFn: () => api<{ threads: Conversa[] }>("/mensagens"),
    // Rede de segurança caso o realtime não conecte.
    refetchInterval: 30_000,
  });

  // Realtime: mensagem nova em qualquer conversa atualiza a lista e a conversa aberta.
  useEffect(() => {
    if (!supabaseConfigurado) return;
    try {
      const canal = supabase
        .channel("mensagens-profissional")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
          qc.invalidateQueries({ queryKey: CHAVE_CONVERSAS });
        })
        .subscribe();
      return () => {
        supabase.removeChannel(canal).catch(() => {});
      };
    } catch {
      return; // sem realtime a tela funciona igual, com o refetch de 30s
    }
  }, [qc]);

  // Desktop abre a conversa mais recente (como no SvelteKit). No celular a lista vem primeiro.
  useEffect(() => {
    const primeira = q.data?.threads[0];
    if (!ativaId && primeira && window.matchMedia("(min-width: 1024px)").matches)
      setParams({ t: primeira.id }, { replace: true });
  }, [ativaId, q.data, setParams]);

  return (
    <>
      <div className={cn(ativaId && "hidden lg:block")}>
        <PageHeader title="Mensagens" />
      </div>
      <QueryState
        query={q}
        skeleton={<MensagensSkeleton />}
        isEmpty={(d) => d.threads.length === 0}
        empty={
          <EmptyState
            title="Nenhuma conversa ainda"
            description="As conversas aparecem aqui quando um aluno manda a primeira mensagem pelo app dele."
          />
        }
      >
        {(d) => (
          <Caixa
            conversas={d.threads}
            ativa={d.threads.find((t) => t.id === ativaId) ?? null}
            abrir={(id) => setParams(id ? { t: id } : {}, { replace: true })}
          />
        )}
      </QueryState>
    </>
  );
}

function Caixa({
  conversas,
  ativa,
  abrir,
}: {
  conversas: Conversa[];
  ativa: Conversa | null;
  abrir: (id: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const visiveis = filtrarConversas(conversas, busca, soNaoLidas);
  const naoLidas = conversas.reduce((a, t) => a + t.unread, 0);

  return (
    <div className="grid h-[calc(100dvh-9rem)] min-h-[420px] overflow-hidden rounded-lg border border-line bg-bg-elevated shadow-card lg:h-[calc(100dvh-12rem)] lg:grid-cols-[320px_1fr]">
      <aside
        aria-label="Conversas"
        className={cn("flex min-h-0 flex-col border-line lg:border-r", ativa && "hidden lg:flex")}
      >
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-bg px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 shrink-0 text-ink-mute" aria-hidden />
            <label htmlFor="msg-busca" className="sr-only">
              Buscar conversa
            </label>
            <Input
              id="msg-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno…"
              className="h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="flex gap-1.5">
            <Chip ativo={!soNaoLidas} onClick={() => setSoNaoLidas(false)}>
              Todas <span className="num">{conversas.length}</span>
            </Chip>
            <Chip ativo={soNaoLidas} onClick={() => setSoNaoLidas(true)}>
              Não lidas <span className="num">{naoLidas}</span>
            </Chip>
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {visiveis.length === 0 && <li className="p-6 text-center text-body text-ink-mute">Nenhuma conversa encontrada.</li>}
          {visiveis.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => abrir(t.id)}
                aria-current={ativa?.id === t.id}
                className={cn(
                  "relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle",
                  ativa?.id === t.id && "bg-brand-soft before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-brand",
                )}
              >
                <Avatar nome={t.studentName} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body font-medium text-ink">{t.studentName}</span>
                    <span className="num shrink-0 text-micro text-ink-mute">{horaCurta(t.lastAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn("flex-1 truncate text-caption", t.unread ? "font-medium text-ink" : "text-ink-mute")}>
                      {t.last ?? "Sem mensagens"}
                    </span>
                    {t.unread > 0 && (
                      <span
                        className="num shrink-0 rounded-full bg-brand px-1.5 text-micro font-semibold text-brand-on"
                        aria-label={`${t.unread} não lidas`}
                      >
                        {t.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section aria-label="Conversa" className={cn("min-h-0 flex-col", ativa ? "flex" : "hidden lg:flex")}>
        {ativa ? (
          <ConversaAberta key={ativa.id} conversa={ativa} voltar={() => abrir(null)} />
        ) : (
          <p className="m-auto text-body text-ink-mute">Escolha uma conversa.</p>
        )}
      </section>
    </div>
  );
}

function ConversaAberta({ conversa, voltar }: { conversa: Conversa; voltar: () => void }) {
  const qc = useQueryClient();
  const [rascunho, setRascunho] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: chaveConversa(conversa.id),
    queryFn: () => api<{ messages: Mensagem[] }>(`/mensagens/${conversa.id}`),
  });

  // Abrir a conversa marca como lidas; o badge do menu vem de ["sessao"].
  const marcar = useMutation({
    mutationFn: () => api(`/mensagens/${conversa.id}/lido`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
      qc.setQueryData<{ threads: Conversa[] }>(CHAVE_CONVERSAS, (d) =>
        d ? { threads: d.threads.map((t) => (t.id === conversa.id ? { ...t, unread: 0 } : t)) } : d,
      );
    },
  });
  const { mutate: marcarLido } = marcar;
  useEffect(() => {
    if (conversa.unread > 0) marcarLido();
  }, [conversa.id, conversa.unread, marcarLido]);

  const enviar = useMutation({
    mutationFn: (body: string) => api(`/mensagens/${conversa.id}`, { method: "POST", json: { body } }),
    onSuccess: () => {
      // Só limpa se deu certo: falha mantém o texto na caixa.
      setRascunho("");
      qc.invalidateQueries({ queryKey: CHAVE_CONVERSAS });
    },
    onError: (e) => toast.error(`Não consegui enviar: ${e.message}`),
  });

  // Ancora na última mensagem ao abrir e quando chega mensagem nova.
  const total = q.data?.messages.length ?? 0;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [total]);

  const submeter = (e?: FormEvent) => {
    e?.preventDefault();
    const body = rascunho.trim();
    if (body && !enviar.isPending) enviar.mutate(body);
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Voltar para as conversas" onClick={voltar}>
          <ArrowLeft aria-hidden />
        </Button>
        <Avatar nome={conversa.studentName} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body font-semibold text-ink">{conversa.studentName}</h2>
          <p className="num text-caption text-ink-mute">
            {conversa.lastAt ? `Última mensagem ${horaCurta(conversa.lastAt)}` : "Sem mensagens"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/alunos/${conversa.studentId}`}>Ver ficha</Link>
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-5 sm:px-6" aria-live="polite">
        <QueryState
          query={q}
          skeleton={<SkeletonLista linhas={4} />}
          isEmpty={(d) => d.messages.length === 0}
          empty={<p className="text-center text-body text-ink-mute">Sem mensagens ainda.</p>}
        >
          {(d) => (
            <ol className="space-y-2">
              {d.messages.map((m) => {
                const doAluno = m.fromRole === "student";
                return (
                  <li key={m.id} className={cn("flex flex-col", doAluno ? "items-start" : "items-end")}>
                    <span className="sr-only">{doAluno ? conversa.studentName : "Você"}:</span>
                    <p
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-body sm:max-w-[70%]",
                        doAluno ? "border border-line bg-bg-elevated text-ink" : "bg-brand text-brand-on",
                      )}
                    >
                      {m.body}
                    </p>
                    <span className="num mt-1 px-1 text-micro text-ink-mute">
                      {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </QueryState>
        <div ref={fim} />
      </div>
      <form onSubmit={submeter} className="space-y-2 border-t border-line p-3 sm:p-4">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {RESPOSTAS_RAPIDAS.map((r) => (
            <Chip key={r} onClick={() => setRascunho(r)}>
              {r}
            </Chip>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label htmlFor="msg-texto" className="sr-only">
            Resposta para {conversa.studentName}
          </label>
          <Textarea
            id="msg-texto"
            rows={1}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submeter();
              }
            }}
            placeholder="Escreva uma resposta…"
            className="max-h-40 min-h-10 resize-none"
          />
          <Button type="submit" disabled={enviar.isPending || !rascunho.trim()} aria-label="Enviar">
            <SendHorizontal aria-hidden />
            <span className="hidden sm:inline">{enviar.isPending ? "Enviando…" : "Enviar"}</span>
          </Button>
        </div>
      </form>
    </>
  );
}

function MensagensSkeleton() {
  return (
    <div className="grid h-[60dvh] gap-0 overflow-hidden rounded-lg border border-line lg:grid-cols-[320px_1fr]" aria-busy="true" aria-label="Carregando">
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <Skeleton className="hidden rounded-none lg:block" />
    </div>
  );
}

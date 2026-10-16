import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { filtrarConversas, horaCurta } from "@/lib/rotina";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConversaAberta, type ConversaResumo } from "@/components/rotina/Conversa";
import { CHAVE_CONVERSAS } from "./chaves";

type Conversa = ConversaResumo & { last: string | null };

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
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={soNaoLidas ? "nao-lidas" : "todas"}
              onValueChange={(v) => v && setSoNaoLidas(v === "nao-lidas")}
              aria-label="Filtrar conversas"
            >
              <ToggleGroupItem value="todas">
                Todas <span className="num ml-1 text-ink-mute">{conversas.length}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="nao-lidas">
                Não lidas <span className="num ml-1 text-ink-mute">{naoLidas}</span>
              </ToggleGroupItem>
            </ToggleGroup>
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

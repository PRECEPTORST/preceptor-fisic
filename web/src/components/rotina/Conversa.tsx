import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "$lib/server/db/schema";
import { api } from "@/lib/api";
import { RESPOSTAS_RAPIDAS, horaCurta } from "@/lib/rotina";
import { cn } from "@/lib/utils";
import { CHAVE_SESSAO } from "@/hooks/useSessao";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAVE_CONVERSAS, chaveConversa } from "@/pages/rotina/chaves";
import { Chip } from "./Chip";

export type ConversaResumo = {
  id: string;
  studentId: string;
  studentName: string;
  lastAt: string | null;
  unread: number;
};
type Mensagem = Omit<Message, "createdAt" | "readAt"> & { createdAt: string; readAt: string | null };

/**
 * Conversa com um aluno: mensagens, respostas rápidas e envio.
 * Usada em /mensagens e pensada para embutir na ficha do aluno (aba Mensagens,
 * brief §4.1): passe `embutida` para esconder o cabeçalho e o "Ver ficha".
 * Abrir marca como lida e invalida ["sessao"] (badge do menu).
 */
export function ConversaAberta({
  conversa,
  voltar,
  embutida,
}: {
  conversa: ConversaResumo;
  voltar?: () => void;
  embutida?: boolean;
}) {
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
      qc.setQueryData<{ threads: ConversaResumo[] }>(CHAVE_CONVERSAS, (d) =>
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
      {!embutida && (
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {voltar && (
          <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Voltar para as conversas" onClick={voltar}>
            <ArrowLeft aria-hidden />
          </Button>
        )}
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
      )}
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
                        doAluno ? "border border-line bg-bg-elevated text-ink" : "bg-brand-soft text-ink",
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

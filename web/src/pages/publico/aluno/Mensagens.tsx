import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, Loader2 } from "lucide-react";
import { apiAluno } from "@/lib/aluno-api";
import { useTitulo } from "@/lib/useTitulo";
import { cn } from "@/lib/utils";
import { AlunoShell, useAlunoLink } from "@/components/publico/AlunoShell";
import { AlunoEstado } from "@/components/publico/AlunoEstado";
import { Avatar } from "@/components/Avatar";
import { SkeletonLista } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { chaveAluno, chaveMensagens, type ConversaAluno, type MensagemAluno } from "./tipos";

const hora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

export default function Mensagens() {
  const { id, token } = useAlunoLink();
  const qc = useQueryClient();
  // Polling a cada 12 s, só com a aba visível (o React Query pausa em segundo plano).
  // Realtime pelo Supabase não serve: o aluno não tem sessão e abrir a RLS vazaria conversas.
  const q = useQuery({
    queryKey: chaveMensagens(id),
    queryFn: () => apiAluno<ConversaAluno>(id, token, "/mensagens"),
    refetchInterval: 12_000,
  });
  useTitulo(`Mensagens · ${q.data?.professionalName ?? "Meu treino"}`);

  // Abrir a conversa marca as do treinador como lidas: zera o badge.
  useEffect(() => {
    if (q.data) qc.invalidateQueries({ queryKey: chaveAluno(id) });
  }, [q.data?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AlunoShell titulo={q.data?.professionalName ?? "Mensagens"} subtitulo="Seu treinador">
      <AlunoEstado query={q} skeleton={<SkeletonLista linhas={4} />}>
        {(d) => <Conversa d={d} />}
      </AlunoEstado>
    </AlunoShell>
  );
}

function Conversa({ d }: { d: ConversaAluno }) {
  const { id, token } = useAlunoLink();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [d.messages.length]);

  const enviar = useMutation({
    mutationFn: (body: string) => apiAluno<MensagemAluno>(id, token, "/mensagens", { method: "POST", json: { body } }),
    onSuccess: (m) => {
      setTexto("");
      qc.setQueryData<ConversaAluno>(chaveMensagens(id), (c) => (c ? { ...c, messages: [...c.messages, m] } : c));
      qc.invalidateQueries({ queryKey: chaveMensagens(id) });
    },
    onError: (e: Error) => toast.error(`Não consegui enviar: ${e.message}`),
  });

  const submeter = (e?: FormEvent) => {
    e?.preventDefault();
    const body = texto.trim();
    if (body && !enviar.isPending) enviar.mutate(body);
  };

  return (
    <div className="animate-soft-fade">
      {d.messages.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <Avatar nome={d.professionalName} size={56} />
          <p className="mt-4 text-h6 font-medium">Fale com {d.professionalName.split(" ")[0]}</p>
          <p className="mt-1 max-w-sm text-body text-ink-soft">Dúvida sobre carga, execução ou como você se sentiu no treino? Escreva aqui.</p>
        </div>
      ) : (
        <ol aria-label="Mensagens" className="space-y-2 pb-4">
          {d.messages.map((m, i) => {
            const minha = m.fromRole === "student";
            const novoDia = i === 0 || dia(d.messages[i - 1]!.createdAt) !== dia(m.createdAt);
            return (
              <li key={m.id}>
                {novoDia && <p className="eyebrow py-3 text-center">{dia(m.createdAt)}</p>}
                <div className={cn("flex", minha ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3.5 py-2.5 text-body-lg",
                      minha ? "rounded-br-sm bg-brand text-brand-on" : "rounded-bl-sm border border-line bg-bg-elevated",
                    )}
                  >
                    <span className="sr-only">{minha ? "Você: " : `${d.professionalName}: `}</span>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={cn("num mt-1 text-right text-micro", minha ? "text-brand-on/70" : "text-ink-mute")}>{hora(m.createdAt)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={fim} />

      {/* Compositor fixo acima da barra de abas. */}
      <form
        onSubmit={submeter}
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-10 border-t border-line bg-bg/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-2 sm:px-6">
          <label htmlFor="msg" className="sr-only">
            Mensagem para {d.professionalName}
          </label>
          <textarea
            id="msg"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submeter();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Escreva uma mensagem…"
            className="max-h-32 min-h-12 flex-1 resize-none rounded-lg border border-input bg-bg-elevated px-3 py-3 text-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon" className="size-12 shrink-0 rounded-full" disabled={!texto.trim() || enviar.isPending} aria-label="Enviar mensagem">
            {enviar.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}
          </Button>
        </div>
      </form>
      <div className="h-20" aria-hidden />
    </div>
  );
}

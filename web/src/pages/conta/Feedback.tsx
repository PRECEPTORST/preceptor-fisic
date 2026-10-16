import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dataHora } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/sonner";

type Item = { id: string; category: string; message: string; page: string | null; createdAt: string };

export const CHAVE_FEEDBACK = ["feedback"] as const;

const CATEGORIAS: { id: string; label: string; tom: StatusTone }[] = [
  { id: "bug", label: "Bug / erro", tom: "negative" },
  { id: "sugestao", label: "Sugestão", tom: "brand" },
  { id: "duvida", label: "Dúvida", tom: "info" },
  { id: "elogio", label: "Elogio", tom: "positive" },
  { id: "outro", label: "Outro", tom: "neutral" },
];

export default function Feedback() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CHAVE_FEEDBACK, queryFn: () => api<{ mine: Item[] }>("/feedback") });
  const [category, setCategory] = useState("sugestao");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("");

  const enviar = useMutation({
    mutationFn: () => api("/feedback", { method: "POST", json: { category, message, page: page || null } }),
    onSuccess: () => {
      toast.success("Feedback enviado. Valeu!");
      setMessage("");
      setPage("");
      qc.invalidateQueries({ queryKey: CHAVE_FEEDBACK });
    },
    onError: (e) => toast.error(`Não consegui enviar: ${e.message}`),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    enviar.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Beta"
        title="Feedback"
        description="Achou um bug, tem uma ideia ou algo te incomodou? Conte aqui. A gente lê tudo."
      />
      <form onSubmit={submit} className="space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Categoria</legend>
          <ToggleGroup
            type="single"
            value={category}
            onValueChange={(v) => v && setCategory(v)}
            className="flex flex-wrap justify-start gap-2"
          >
            {CATEGORIAS.map((c) => (
              <ToggleGroupItem
                key={c.id}
                value={c.id}
                className="rounded-full border border-line px-3 data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-ink"
              >
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor="fb-msg">Seu feedback</Label>
          <Textarea
            id="fb-msg"
            rows={5}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva o que aconteceu, o que esperava, ou a ideia que teve…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fb-page">
            Onde aconteceu? <span className="font-normal text-ink-mute">(opcional)</span>
          </Label>
          <Input id="fb-page" maxLength={200} value={page} onChange={(e) => setPage(e.target.value)} placeholder="Ex.: tela de gerar plano, agenda…" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={enviar.isPending || message.trim().length < 3}>
            {enviar.isPending ? "Enviando…" : "Enviar feedback"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="enviados" className="mt-8">
        <h2 id="enviados" className="mb-3 text-h6 font-medium">
          Seus feedbacks enviados
        </h2>
        <QueryState
          query={q}
          skeleton={<Skeleton className="h-32 w-full" />}
          isEmpty={(d) => d.mine.length === 0}
          empty={<p className="text-body text-ink-mute">Você ainda não enviou nenhum.</p>}
        >
          {(d) => (
            <ul className="space-y-2">
              {d.mine.map((f) => {
                const cat = CATEGORIAS.find((c) => c.id === f.category);
                return (
                  <li key={f.id} className="rounded-lg border border-line bg-bg-elevated px-4 py-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <StatusChip tone={cat?.tom ?? "neutral"}>{cat?.label ?? f.category}</StatusChip>
                      <span className="num text-caption text-ink-mute">{dataHora(f.createdAt)}</span>
                      {f.page && <span className="truncate text-caption text-ink-mute">· {f.page}</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-body text-ink-soft">{f.message}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
      </section>
    </div>
  );
}

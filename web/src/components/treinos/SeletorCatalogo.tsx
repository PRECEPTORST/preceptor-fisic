import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Video } from "lucide-react";
import { api } from "@/lib/api";
import { DIFICULDADE } from "@/lib/treinos";
import type { ItemCatalogo } from "@/lib/treinos-tipos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

/** Busca no catálogo (debounce de 250ms) para trocar ou adicionar um exercício. */
export function SeletorCatalogo({
  planoId,
  modo,
  termoInicial,
  pendente,
  onConfirmar,
  onCancelar,
}: {
  planoId: string;
  modo: "trocar" | "adicionar";
  termoInicial: string;
  pendente: boolean;
  onConfirmar: (item: ItemCatalogo, manterPrescricao: boolean) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [termo, setTermo] = useState(termoInicial);
  const [busca, setBusca] = useState(termoInicial);
  const [escolhido, setEscolhido] = useState<ItemCatalogo | null>(null);
  const [manter, setManter] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setBusca(termo), 250);
    return () => clearTimeout(t);
  }, [termo]);

  const q = useQuery({
    queryKey: ["treino", planoId, "catalogo", busca],
    queryFn: () => api<{ items: ItemCatalogo[] }>(`/treinos/${planoId}/catalogo?q=${encodeURIComponent(busca)}`),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const itens = q.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Label htmlFor={`${id}-q`} className="sr-only">
          Buscar exercício no catálogo
        </Label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
        <Input
          id={`${id}-q`}
          autoFocus
          className="pl-9"
          placeholder="Buscar exercício no catálogo…"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setEscolhido(null);
          }}
        />
      </div>
      {modo === "trocar" && (
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-manter`} checked={manter} onCheckedChange={(v) => setManter(v === true)} />
          <Label htmlFor={`${id}-manter`} className="text-caption font-normal text-ink-soft">
            Manter séries, repetições, descanso e intensidade
          </Label>
        </div>
      )}
      {q.isPending ? (
        <div className="space-y-1.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : q.isError ? (
        <p role="alert" className="text-caption text-negative">
          Não consegui buscar no catálogo: {q.error.message}
        </p>
      ) : itens.length === 0 ? (
        <p className="py-3 text-center text-caption text-ink-mute">Nenhum exercício encontrado.</p>
      ) : (
        <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto rounded-md border border-line bg-bg-elevated" role="listbox" aria-label="Resultados">
          {itens.map((c) => {
            const sel = escolhido?.id === c.id;
            return (
              <li key={c.id} role="option" aria-selected={sel}>
                <button
                  type="button"
                  onClick={() => setEscolhido(c)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-l-2 border-l-transparent px-3 py-2 text-left transition-colors hover:bg-bg-subtle",
                    sel && "border-l-brand bg-brand-soft",
                  )}
                >
                  <span className="text-body font-medium text-ink">{c.name}</span>
                  <span className="flex items-center gap-1 text-caption text-ink-mute">
                    {[c.bodyPart, c.equipment, c.difficulty ? (DIFICULDADE[c.difficulty] ?? c.difficulty) : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {c.hasVideo && (
                      <>
                        {" · "}
                        <Video className="size-3" aria-label="Com vídeo" />
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-caption text-ink-soft">
          {escolhido ? (
            <>
              {modo === "trocar" ? "Trocar por" : "Adicionar"}: <strong className="text-ink">{escolhido.name}</strong>
            </>
          ) : (
            "Escolha um exercício da lista."
          )}
        </span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!escolhido || pendente}
            onClick={() => escolhido && onConfirmar(escolhido, manter)}
          >
            {pendente ? "Salvando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

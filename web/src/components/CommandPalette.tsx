import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, User } from "lucide-react";
import type { StudentListItem } from "$lib/server/queries";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { comandos } from "@/lib/comandos";
import { useSessao } from "@/hooks/useSessao";
import { navPrincipal, navRodape } from "@/components/layout/nav";
import { CHAVE_DASHBOARD } from "@/pages/Dashboard";

/** Paleta global ⌘K / Ctrl+K: buscar aluno, ir para telas, ações rápidas. */
export function CommandPalette({ aberto, onAberto }: { aberto: boolean; onAberto: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: s } = useSessao();
  // Reaproveita a lista de alunos do dashboard (mesma chave → mesmo cache).
  const alunos = useQuery({
    queryKey: CHAVE_DASHBOARD,
    queryFn: () => api<{ students: StudentListItem[] }>("/dashboard"),
    enabled: aberto,
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onAberto(!aberto);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, onAberto]);

  const ir = (href: string) => {
    onAberto(false);
    navigate(href);
  };
  const nav = useMemo(() => [...navPrincipal(s), ...navRodape], [s]);
  const acoes = comandos.filter((c) => c.grupo === "Ações" && (!c.admin || s?.professional.isAdmin));

  return (
    <CommandDialog open={aberto} onOpenChange={onAberto}>
      <CommandInput placeholder="Buscar aluno, tela ou ação…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Ações">
          {acoes.map((c) => (
            <CommandItem key={c.id} value={`${c.label} ${(c.palavras ?? []).join(" ")}`} onSelect={() => ir(c.href)}>
              {c.icon ? <c.icon aria-hidden /> : <Plus aria-hidden />}
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {(alunos.data?.students.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Alunos">
              {alunos.data!.students.map((a) => (
                <CommandItem key={a.id} value={`aluno ${a.name} ${a.goal ?? ""}`} onSelect={() => ir(`/alunos/${a.id}`)}>
                  <User aria-hidden />
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.goal && <span className="truncate text-caption text-ink-mute">{a.goal}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Ir para">
          {nav.map((i) => (
            <CommandItem key={i.href} value={`ir ${i.label}`} onSelect={() => ir(i.href)}>
              <i.icon aria-hidden />
              {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

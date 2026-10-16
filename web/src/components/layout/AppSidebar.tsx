import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSessao } from "@/hooks/useSessao";
import { useAuth } from "@/contexts/AuthContext";
import { alternarTema, lerTema } from "@/lib/theme";
import { BrandMark } from "@/components/BrandMark";
import { itemAtivo, navPrincipal, navRodape, type ItemNav } from "./nav";

export function AppSidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { data: s } = useSessao();
  const { sair } = useAuth();
  const { pathname } = useLocation();
  const [tema, setTema] = useState(lerTema());

  const item = (i: ItemNav) => {
    const ativo = itemAtivo(i.href, pathname);
    return (
      <li key={i.href}>
        <NavLink
          to={i.href}
          onClick={onNavigate}
          aria-current={ativo ? "page" : undefined}
          className={cn(
            "group flex h-9 items-center gap-3 rounded-md px-3 text-body transition-colors",
            ativo ? "bg-sidebar-accent text-ink" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-ink",
          )}
        >
          <i.icon className={cn("size-4 shrink-0", ativo ? "text-brand" : "text-ink-mute")} aria-hidden />
          <span className="flex-1 truncate">{i.label}</span>
          {i.alerta ? (
            <span className="num rounded-full bg-brand px-1.5 text-micro text-brand-on" aria-label={`${i.alerta} novos`}>
              {i.alerta}
            </span>
          ) : i.contagem ? (
            <span className="num text-caption text-ink-mute">{i.contagem}</span>
          ) : null}
        </NavLink>
      </li>
    );
  };

  return (
    <aside className={cn("flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar", className)}>
      <NavLink to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-4 pt-5">
        <BrandMark size={28} />
        <span className="text-body font-semibold tracking-tight text-ink">PreceptorFISIC</span>
      </NavLink>

      {s?.trial && (
        <NavLink
          to="/assinatura"
          onClick={onNavigate}
          className="mx-3 mb-3 rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-caption text-brand"
        >
          <span className="num font-medium">{s.trial.label}</span> · assinar
        </NavLink>
      )}

      <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">{navPrincipal(s).map(item)}</ul>
        <p className="eyebrow mb-1 mt-6 px-3">Conta</p>
        <ul className="space-y-0.5">{navRodape.map(item)}</ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-3">
          <p className="truncate text-body font-medium text-ink">{s?.professional.name ?? "—"}</p>
          <p className="truncate font-mono text-caption text-ink-mute">{s?.professional.cref ?? s?.professional.email}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTema(alternarTema())}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md text-caption text-ink-mute hover:bg-sidebar-accent hover:text-ink"
            aria-label={tema === "claro" ? "Usar tema escuro" : "Usar tema claro"}
          >
            {tema === "claro" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Tema
          </button>
          <button
            type="button"
            onClick={() => sair()}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md text-caption text-ink-mute hover:bg-sidebar-accent hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}

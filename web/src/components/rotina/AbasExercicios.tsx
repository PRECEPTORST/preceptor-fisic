import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Abas Catálogo / Meus exercícios. São links: cada aba tem URL própria. */
export function AbasExercicios({ total, meus }: { total?: number; meus?: number }) {
  const aba = (to: string, rotulo: string, n?: number) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-body font-medium transition-colors",
          isActive ? "border-brand text-ink" : "border-transparent text-ink-mute hover:text-ink",
        )
      }
    >
      {rotulo}
      {n != null && <span className="num rounded-full bg-brand-soft px-2 py-0.5 text-micro text-brand">{n}</span>}
    </NavLink>
  );
  return (
    <nav aria-label="Exercícios" className="mb-6 flex gap-1 border-b border-line">
      {aba("/exercicios", "Catálogo", total)}
      {aba("/exercicios/meus", "Meus exercícios", meus)}
    </nav>
  );
}

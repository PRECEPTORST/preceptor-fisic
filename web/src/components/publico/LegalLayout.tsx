import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { useTitulo } from "@/lib/useTitulo";

const NAV = [
  { to: "/legal/termos", label: "Termos" },
  { to: "/legal/privacidade", label: "Privacidade" },
  { to: "/login", label: "Entrar" },
];

/** Moldura das páginas legais. A tipografia do texto vem de seletores no <main>. */
export function LegalLayout({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  useTitulo(titulo, descricao);
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-bg-elevated pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-8">
          <Link to="/" className="flex min-h-11 items-center gap-3 rounded-md">
            <BrandMark size={26} />
            <span className="font-semibold">PreceptorFISIC</span>
          </Link>
          <nav aria-label="Páginas legais" className="-mx-3 flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className="flex min-h-11 items-center rounded-md px-3 text-body text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-ink"
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main
        className={[
          "mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-10 sm:px-8 sm:pt-14",
          "[&_h1]:mb-2 [&_h1]:text-h4 [&_h1]:font-medium sm:[&_h1]:text-h3",
          "[&_.legal-meta]:eyebrow [&_.legal-meta]:mb-8",
          "[&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-h5 [&_h2]:font-medium",
          "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-body-lg [&_h3]:font-medium",
          "[&_li]:mb-1.5 [&_li]:text-body-lg [&_li]:text-ink-soft [&_p]:mb-3.5 [&_p]:text-body-lg [&_p]:text-ink-soft",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_strong]:font-semibold [&_strong]:text-ink",
          "[&_a]:break-words [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
          "[&_code]:rounded [&_code]:bg-bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-caption [&_code]:text-ink",
          "[&_hr]:my-8 [&_hr]:border-line",
        ].join(" ")}
      >
        {children}
      </main>

      <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-2 px-4 py-5 text-caption text-ink-mute sm:px-8">
          <span>© 2026 PreceptorFISIC</span>
          <span>Conformidade LGPD · sa-east-1</span>
        </div>
      </footer>
    </div>
  );
}

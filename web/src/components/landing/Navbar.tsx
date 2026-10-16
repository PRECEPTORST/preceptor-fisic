import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { hrefCadastro } from "@/pages/landing/precos";

const ANCORAS = [
  { href: "#como-funciona", rotulo: "Como funciona" },
  { href: "#plataforma", rotulo: "Plataforma" },
  { href: "#precos", rotulo: "Preços" },
  { href: "#faq", rotulo: "FAQ" },
];

export function Navbar({ logado }: { logado: boolean }) {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const on = () => setRolou(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b transition-colors ${
        rolou ? "border-line bg-bg/95" : "border-transparent bg-bg/0"
      }`}
    >
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 rounded-md">
          <BrandMark size={22} />
          <span className="text-body font-semibold tracking-tight text-ink">PreceptorFISIC</span>
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {ANCORAS.map((a) => (
            <li key={a.href}>
              <a href={a.href} className="rounded-md px-3 py-2 text-body text-ink-soft transition-colors hover:text-ink">
                {a.rotulo}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={logado ? "/dashboard" : "/login"}
            className="inline-flex h-10 items-center rounded-md px-3 text-body text-ink-soft transition-colors hover:text-ink"
          >
            {logado ? "Abrir o app" : "Entrar"}
          </a>
          <a
            href={hrefCadastro()}
            className="hidden h-10 items-center rounded-md bg-brand px-4 text-body font-medium text-brand-on transition-colors hover:bg-brand-strong sm:inline-flex"
          >
            Começar 7 dias grátis
          </a>
        </div>
      </nav>
    </header>
  );
}

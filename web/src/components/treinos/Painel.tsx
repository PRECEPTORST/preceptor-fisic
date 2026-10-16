import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** true a partir de md (768px). */
export function useDesktop() {
  const q = "(min-width: 768px)";
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setD(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return d;
}

/** Ação em painel (brief §2.4): Sheet lateral no desktop, de baixo no celular. */
export function Painel({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useDesktop();
  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={
          desktop
            ? "w-full overflow-y-auto sm:max-w-lg"
            : "max-h-[90dvh] overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]"
        }
      >
        <SheetHeader className="mb-4 text-left">
          <SheetTitle>{titulo}</SheetTitle>
          {descricao && <SheetDescription>{descricao}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

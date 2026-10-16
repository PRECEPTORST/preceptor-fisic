import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useAvisoSaida } from "@/components/Form";

function useDesktop() {
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

/**
 * Painel de ação (brief §2.4): Sheet lateral no desktop, de baixo no celular.
 * Com alterações não salvas, fechar pede confirmação (e a aba também avisa).
 */
export function Painel({
  aberto,
  onFechar,
  titulo,
  eyebrow,
  sujo = false,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  eyebrow?: ReactNode;
  sujo?: boolean;
  children: ReactNode;
}) {
  const desktop = useDesktop();
  const [confirmar, setConfirmar] = useState(false);
  useAvisoSaida(aberto && sujo);
  return (
    <>
      <Sheet open={aberto} onOpenChange={(v) => !v && (sujo ? setConfirmar(true) : onFechar())}>
        <SheetContent
          side={desktop ? "right" : "bottom"}
          className={
            desktop
              ? "flex w-full flex-col gap-0 bg-bg p-0 sm:max-w-xl"
              : "flex max-h-[92dvh] flex-col gap-0 rounded-t-xl bg-bg p-0"
          }
        >
          <header className="border-b border-line px-4 py-4 pr-12 sm:px-6">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <SheetTitle className="mt-0.5 text-h6 font-semibold text-ink">{titulo}</SheetTitle>
            <SheetDescription className="sr-only">Formulário em painel</SheetDescription>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 sm:px-6 lg:px-8">{children}</div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>O que você mudou neste painel ainda não foi salvo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                setConfirmar(false);
                onFechar();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

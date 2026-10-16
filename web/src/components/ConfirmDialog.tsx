import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

/** Confirmação de ação destrutiva ou irreversível. Substitui window.confirm. */
export function ConfirmDialog({
  trigger,
  titulo,
  descricao,
  confirmar = "Confirmar",
  destrutivo = true,
  onConfirmar,
}: {
  trigger: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  confirmar?: string;
  destrutivo?: boolean;
  onConfirmar: () => Promise<unknown> | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !enviando && setAberto(v)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descricao && <AlertDialogDescription>{descricao}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: destrutivo ? "destructive" : "default" })}
            disabled={enviando}
            onClick={async (e) => {
              e.preventDefault();
              setEnviando(true);
              try {
                await onConfirmar();
                setAberto(false);
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando && <Loader2 className="animate-spin" aria-hidden />}
            {confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

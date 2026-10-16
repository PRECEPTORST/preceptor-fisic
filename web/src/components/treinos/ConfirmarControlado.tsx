import type { ReactNode } from "react";
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

/**
 * AlertDialog aberto por estado, para itens de DropdownMenu (que desmontam ao
 * fechar e não servem de gatilho). Com gatilho próprio, use ConfirmDialog.
 */
export function ConfirmarControlado({
  aberto,
  onFechar,
  titulo,
  descricao,
  confirmar,
  destrutivo = true,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  confirmar: string;
  destrutivo?: boolean;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descricao && <AlertDialogDescription>{descricao}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: destrutivo ? "destructive" : "default" })}
            onClick={onConfirmar}
          >
            {confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

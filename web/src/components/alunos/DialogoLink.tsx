import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, ExternalLink, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { linkEmail, linkWhatsapp, primeiroNome, textoDoLink } from "@/lib/alunos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { copiar } from "./copiar";

type Aluno = { id: string; name: string; phone: string | null; email: string | null };

/** Link do app do aluno: copiar, abrir, WhatsApp, e-mail, reenviar pelo servidor e revogar. */
export function DialogoLink({
  aberto,
  onAberto,
  aluno,
  url,
  chave,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  aluno: Aluno;
  url: string;
  chave: readonly unknown[];
}) {
  const qc = useQueryClient();
  const texto = textoDoLink(aluno.name, url);
  const mailto = linkEmail(aluno.email, texto);

  const reenviar = useMutation({
    mutationFn: () => api<{ sentTo: string }>(`/alunos/${aluno.id}/link/reenviar`, { method: "POST" }),
    onSuccess: (r) => toast.success(`Link reenviado para ${r.sentTo}.`),
    onError: (e: Error) => toast.error(`Não consegui reenviar: ${e.message}`),
  });

  const revogar = useMutation({
    mutationFn: () => api(`/alunos/${aluno.id}/link/revogar`, { method: "POST" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chave });
      toast.success("Link anterior revogado. Copie e envie o novo.");
    },
    onError: (e: Error) => toast.error(`Não consegui revogar: ${e.message}`),
  });

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Magic-link</p>
          <DialogTitle>Link do app de {primeiroNome(aluno.name)}</DialogTitle>
          <DialogDescription>
            O aluno abre direto no celular, sem login e sem loja de apps. O link é único e só funciona com o token certo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="link-aluno">Link para compartilhar</Label>
          <Input id="link-aluno" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-caption" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => copiar(url, "Link copiado.")}>
            <Copy aria-hidden /> Copiar
          </Button>
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> Abrir em nova aba
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={linkWhatsapp(aluno.phone, texto)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          </Button>
          {mailto && (
            <Button variant="outline" asChild>
              <a href={mailto}>
                <Mail aria-hidden /> Abrir no e-mail
              </a>
            </Button>
          )}
          {aluno.email && (
            <Button variant="outline" disabled={reenviar.isPending} onClick={() => reenviar.mutate()} className="sm:col-span-2">
              <Send aria-hidden /> {reenviar.isPending ? "Enviando…" : `Reenviar por e-mail (${aluno.email})`}
            </Button>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-negative hover:bg-negative-soft hover:text-negative" disabled={revogar.isPending}>
              <Ban aria-hidden /> {revogar.isPending ? "Revogando…" : "Revogar este link e gerar outro"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar o link atual?</AlertDialogTitle>
              <AlertDialogDescription>
                O link que {primeiroNome(aluno.name)} tem hoje para de funcionar na hora. Use quando ele vazou. Depois, envie o novo link.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => revogar.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Revogar link
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

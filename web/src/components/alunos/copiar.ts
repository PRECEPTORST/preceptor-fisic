import { toast } from "sonner";

/** Copia para a área de transferência com aviso. Falha (permissão, http) vira toast de erro. */
export async function copiar(texto: string, ok: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(ok);
  } catch {
    toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
  }
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Archive, MoreHorizontal, Printer, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { plural } from "@/lib/treinos";
import type { Validacao } from "@/lib/treinos-tipos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmarControlado } from "./ConfirmarControlado";
import { useAcaoPlano } from "./useAcaoPlano";

/**
 * Ações secundárias do plano (a primária, Publicar, mora na checklist):
 * imprimir à vista; revalidar, arquivar/reativar e excluir no menu ⋯.
 */
export function AcoesPlano({ planoId, status }: { planoId: string; status: string }) {
  const navigate = useNavigate();
  const [confirmar, setConfirmar] = useState<"arquivar" | "excluir" | null>(null);
  const arquivar = useAcaoPlano(planoId);
  const reativar = useAcaoPlano(planoId);
  const revalidar = useAcaoPlano<{ validation: Validacao }>(planoId);
  const excluir = useAcaoPlano(planoId);
  const erro = (acao: string) => (e: Error) => toast.error(`Não consegui ${acao}: ${e.message}`);

  return (
    <>
      <Button variant="outline" asChild>
        <Link to={`/treinos/${planoId}/imprimir`}>
          <Printer aria-hidden /> Imprimir
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Mais ações do treino">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            disabled={revalidar.isPending}
            onSelect={() =>
              revalidar.mutate(
                { path: "/revalidar" },
                {
                  onSuccess: ({ validation: v }) => {
                    if (v.violations === 0) toast.success("Validação clínica: nenhuma violação.");
                    else
                      toast.warning(
                        `${v.violations} ${plural(v.violations, "violação clínica encontrada", "violações clínicas encontradas")}`,
                        { description: `Regras: ${v.rules.join(", ")}` },
                      );
                  },
                  onError: erro("revalidar"),
                },
              )
            }
          >
            <RefreshCw aria-hidden /> Revalidar regras clínicas
          </DropdownMenuItem>
          {status === "published" && (
            <DropdownMenuItem onSelect={() => setConfirmar("arquivar")}>
              <Archive aria-hidden /> Arquivar
            </DropdownMenuItem>
          )}
          {status === "archived" && (
            <DropdownMenuItem
              disabled={reativar.isPending}
              onSelect={() =>
                reativar.mutate(
                  { path: "/reativar" },
                  { onSuccess: () => toast.success("Treino reativado. O aluno volta a ver."), onError: erro("reativar") },
                )
              }
            >
              <RotateCcw aria-hidden /> Reativar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-negative focus:text-negative" onSelect={() => setConfirmar("excluir")}>
            <Trash2 aria-hidden /> Excluir treino
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmarControlado
        aberto={confirmar === "arquivar"}
        onFechar={() => setConfirmar(null)}
        titulo="Arquivar este treino?"
        descricao="O aluno perde o acesso a ele. Você pode reativar depois."
        confirmar="Arquivar"
        destrutivo={false}
        onConfirmar={() =>
          arquivar.mutate({ path: "/arquivar" }, { onSuccess: () => toast.success("Treino arquivado."), onError: erro("arquivar") })
        }
      />
      <ConfirmarControlado
        aberto={confirmar === "excluir"}
        onFechar={() => setConfirmar(null)}
        titulo="Excluir este treino?"
        descricao={
          status === "published"
            ? "O aluno perde o acesso e o registro é apagado. Não dá para desfazer."
            : "O registro é apagado. Não dá para desfazer."
        }
        confirmar="Excluir"
        onConfirmar={() =>
          excluir.mutate(
            { path: "", method: "DELETE" },
            {
              onSuccess: () => {
                toast.success("Treino excluído.");
                navigate("/treinos", { replace: true });
              },
              onError: erro("excluir"),
            },
          )
        }
      />
    </>
  );
}

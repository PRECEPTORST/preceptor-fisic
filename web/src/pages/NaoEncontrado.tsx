import { Link } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function NaoEncontrado() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState
        decorative="404"
        title="Esta página não existe"
        description="O link pode estar errado ou a página mudou de lugar."
        action={
          <Button asChild>
            <Link to="/dashboard">Voltar para a visão geral</Link>
          </Button>
        }
      />
    </div>
  );
}

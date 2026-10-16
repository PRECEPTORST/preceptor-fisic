import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Link "voltar" no topo dos formulários. */
export function Voltar({ to, rotulo }: { to: string; rotulo: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-ink-mute">
      <Link to={to}>
        <ArrowLeft aria-hidden /> {rotulo}
      </Link>
    </Button>
  );
}

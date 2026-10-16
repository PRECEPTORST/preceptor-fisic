import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";

/** Placeholder das rotas que ainda não foram portadas do SvelteKit. Some quando a migração termina. */
export default function EmConstrucao() {
  const { pathname } = useLocation();
  return (
    <EmptyState
      decorative="/wip"
      title="Tela em migração"
      description={
        <>
          <span className="font-mono">{pathname}</span> ainda roda no app atual. Ela chega aqui nas próximas etapas.
        </>
      }
    />
  );
}

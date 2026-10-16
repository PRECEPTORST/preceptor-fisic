import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSessao } from "@/hooks/useSessao";
import { ApiError } from "@/lib/api";
import { rotaLivre } from "@/lib/rotas";
import { SkeletonLista } from "@/components/QueryState";
import { Button } from "@/components/ui/button";

/**
 * Guard do app do profissional. Mesmas regras do (app)/+layout.server.ts:
 * sem sessão → /login?next; sem cadastro → /onboarding; sem acesso → /upgrade
 * (exceto as rotas livres).
 */
export function RequireProfessional() {
  const { session, carregando } = useAuth();
  const sessao = useSessao();
  const loc = useLocation();

  if (carregando) return <Carregando />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (sessao.isPending) return <Carregando />;
  if (sessao.isError) {
    const st = sessao.error instanceof ApiError ? sessao.error.status : 0;
    if (st === 409) return <Navigate to="/onboarding" replace />;
    if (st === 401) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
    return (
      <div role="alert" className="mx-auto max-w-md p-8 text-center">
        <p className="font-medium text-ink">Não consegui abrir sua conta.</p>
        <p className="mt-1 text-body text-ink-mute">{sessao.error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => sessao.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!sessao.data.temAcesso && !rotaLivre(loc.pathname)) return <Navigate to="/upgrade" replace />;
  return <Outlet />;
}

function Carregando() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <SkeletonLista />
    </div>
  );
}

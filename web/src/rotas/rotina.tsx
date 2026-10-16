import { lazy } from "react";
import { Navigate, useParams, type RouteObject } from "react-router-dom";

/**
 * Rotas do domínio "rotina" (exercícios, agenda, mensagens). Montadas em App.tsx.
 * Novo/editar viraram painéis (brief §2.4); as URLs antigas redirecionam para
 * a tela com o painel aberto, então links, favoritos e a paleta ⌘K seguem valendo.
 */
const Exercicios = lazy(() => import("@/pages/rotina/Exercicios"));
const Agenda = lazy(() => import("@/pages/rotina/Agenda"));
const Mensagens = lazy(() => import("@/pages/rotina/Mensagens"));

function Para({ to }: { to: (p: Record<string, string | undefined>) => string }) {
  return <Navigate to={to(useParams())} replace />;
}

export const rotas: RouteObject[] = [
  { path: "/exercicios", element: <Exercicios /> },
  { path: "/exercicios/meus", element: <Navigate to="/exercicios?aba=meus" replace /> },
  { path: "/exercicios/novo", element: <Navigate to="/exercicios?aba=meus&novo=1" replace /> },
  { path: "/exercicios/:id/editar", element: <Para to={(p) => `/exercicios?aba=meus&editar=${p.id}`} /> },
  { path: "/agenda", element: <Agenda /> },
  { path: "/agenda/nova", element: <Navigate to="/agenda?nova=1" replace /> },
  { path: "/agenda/:id/editar", element: <Para to={(p) => `/agenda?sessao=${p.id}`} /> },
  { path: "/mensagens", element: <Mensagens /> },
];

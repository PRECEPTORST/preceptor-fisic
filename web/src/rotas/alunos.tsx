import { lazy } from "react";
import { Navigate, useParams, type RouteObject } from "react-router-dom";

/** Rotas do domínio "alunos". Montadas em App.tsx. /alunos/:id/gerar e /manual são do domínio treinos. */
const Lista = lazy(() => import("@/pages/alunos/Lista"));
const Novo = lazy(() => import("@/pages/alunos/Novo"));
const Ficha = lazy(() => import("@/pages/alunos/Ficha"));
const Editar = lazy(() => import("@/pages/alunos/Editar"));

/** A avaliação virou painel na ficha; o endereço antigo continua valendo. */
function AvaliacaoAntiga() {
  const { id = "" } = useParams();
  return <Navigate to={`/alunos/${id}?aba=avaliacoes&nova=1`} replace />;
}

export const rotas: RouteObject[] = [
  { path: "/alunos", element: <Lista /> },
  { path: "/alunos/novo", element: <Novo /> },
  { path: "/alunos/:id", element: <Ficha /> },
  { path: "/alunos/:id/editar", element: <Editar /> },
  { path: "/alunos/:id/avaliacao", element: <AvaliacaoAntiga /> },
];

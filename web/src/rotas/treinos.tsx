import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

/** Rotas do domínio "treinos". Montadas em App.tsx; o worker do domínio só edita este arquivo e src/pages/treinos/. */
const Lista = lazy(() => import("@/pages/treinos/Lista"));
const Plano = lazy(() => import("@/pages/treinos/Plano"));
const Sessao = lazy(() => import("@/pages/treinos/Sessao"));
const Imprimir = lazy(() => import("@/pages/treinos/Imprimir"));
const Gerar = lazy(() => import("@/pages/treinos/Gerar"));
const Manual = lazy(() => import("@/pages/treinos/Manual"));

export const rotas: RouteObject[] = [
  { path: "/treinos", element: <Lista /> },
  { path: "/treinos/:id", element: <Plano /> },
  { path: "/treinos/:id/sessoes/:idx", element: <Sessao /> },
  { path: "/treinos/:id/imprimir", element: <Imprimir /> },
  // Criação parte da ficha do aluno, mas as telas são deste domínio.
  { path: "/alunos/:id/gerar", element: <Gerar /> },
  { path: "/alunos/:id/manual", element: <Manual /> },
];

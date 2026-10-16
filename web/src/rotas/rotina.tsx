import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

/** Rotas do domínio "rotina" (exercícios, agenda, mensagens). Montadas em App.tsx. */
const Exercicios = lazy(() => import("@/pages/rotina/Exercicios"));
const ExerciciosMeus = lazy(() => import("@/pages/rotina/ExerciciosMeus"));
const ExercicioNovo = lazy(() => import("@/pages/rotina/ExercicioNovo"));
const ExercicioEditar = lazy(() => import("@/pages/rotina/ExercicioEditar"));
const Agenda = lazy(() => import("@/pages/rotina/Agenda"));
const AgendaNova = lazy(() => import("@/pages/rotina/AgendaNova"));
const AgendaEditar = lazy(() => import("@/pages/rotina/AgendaEditar"));
const Mensagens = lazy(() => import("@/pages/rotina/Mensagens"));

export const rotas: RouteObject[] = [
  { path: "/exercicios", element: <Exercicios /> },
  { path: "/exercicios/meus", element: <ExerciciosMeus /> },
  { path: "/exercicios/novo", element: <ExercicioNovo /> },
  { path: "/exercicios/:id/editar", element: <ExercicioEditar /> },
  { path: "/agenda", element: <Agenda /> },
  { path: "/agenda/nova", element: <AgendaNova /> },
  { path: "/agenda/:id/editar", element: <AgendaEditar /> },
  { path: "/mensagens", element: <Mensagens /> },
];

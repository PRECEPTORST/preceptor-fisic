import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

/** Rotas do domínio "crm". Montadas em App.tsx; o worker do domínio só edita este arquivo e src/pages/crm/. */
const Visao = lazy(() => import("@/pages/crm/Visao"));
const Leads = lazy(() => import("@/pages/crm/Leads"));
const Novo = lazy(() => import("@/pages/crm/Novo"));
const Lead = lazy(() => import("@/pages/crm/Lead"));
const Contas = lazy(() => import("@/pages/crm/Contas"));
const Feedbacks = lazy(() => import("@/pages/crm/Feedbacks"));

// A API exige admin em todas as rotas; quem não é admin vê o erro 403 do QueryState.
export const rotas: RouteObject[] = [
  { path: "/crm", element: <Visao /> },
  { path: "/crm/leads", element: <Leads /> },
  { path: "/crm/novo", element: <Novo /> },
  { path: "/crm/contas", element: <Contas /> },
  { path: "/crm/feedbacks", element: <Feedbacks /> },
  { path: "/crm/:id", element: <Lead /> },
];

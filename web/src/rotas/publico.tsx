import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const Termos = lazy(() => import("@/pages/publico/Termos"));
const Privacidade = lazy(() => import("@/pages/publico/Privacidade"));

/** Rotas do domínio "publico". Montadas em App.tsx FORA do shell do profissional. */
export const rotas: RouteObject[] = [
  { path: "/legal/termos", element: <Termos /> },
  { path: "/legal/privacidade", element: <Privacidade /> },
];

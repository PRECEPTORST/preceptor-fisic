import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

// Telas fora do caminho crítico: lazy (o Suspense do App.tsx cobre).
const Configuracoes = lazy(() => import("@/pages/conta/Configuracoes"));
const Assinatura = lazy(() => import("@/pages/conta/Assinatura"));
const Upgrade = lazy(() => import("@/pages/conta/Upgrade"));
const Feedback = lazy(() => import("@/pages/conta/Feedback"));
const Guia = lazy(() => import("@/pages/conta/Guia"));
const Equipe = lazy(() => import("@/pages/conta/Equipe"));
const Convite = lazy(() => import("@/pages/conta/Convite"));
const Onboarding = lazy(() => import("@/pages/conta/Onboarding"));
const Recuperar = lazy(() => import("@/pages/conta/Recuperar"));
const Redefinir = lazy(() => import("@/pages/conta/Redefinir"));

/**
 * Rotas do domínio "conta" DENTRO do shell do profissional (montadas em App.tsx).
 * /assinatura fica dentro do shell no React (no Svelte era uma tela solta).
 */
export const rotas: RouteObject[] = [
  { path: "/configuracoes", element: <Configuracoes /> },
  { path: "/assinatura", element: <Assinatura /> },
  { path: "/upgrade", element: <Upgrade /> },
  { path: "/feedback", element: <Feedback /> },
  { path: "/guia", element: <Guia /> },
  { path: "/equipe", element: <Equipe /> },
  { path: "/convite/:token", element: <Convite /> },
];

/**
 * Rotas FORA do shell (sem RequireProfessional). Montar em App.tsx ao lado de
 * /login: `{montar(rotasForaDoShell)}`. O onboarding confere a sessão sozinho.
 */
export const rotasForaDoShell: RouteObject[] = [
  { path: "/onboarding", element: <Onboarding /> },
  { path: "/recuperar", element: <Recuperar /> },
  { path: "/recuperar/redefinir", element: <Redefinir /> },
];

import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const Termos = lazy(() => import("@/pages/publico/Termos"));
const Privacidade = lazy(() => import("@/pages/publico/Privacidade"));
const AlunoInicio = lazy(() => import("@/pages/publico/aluno/Inicio"));
const AlunoTreino = lazy(() => import("@/pages/publico/aluno/Treino"));
const AlunoCompletar = lazy(() => import("@/pages/publico/aluno/Completar"));
const AlunoHistorico = lazy(() => import("@/pages/publico/aluno/Historico"));
const AlunoMensagens = lazy(() => import("@/pages/publico/aluno/Mensagens"));

/**
 * Rotas do domínio "publico". Montadas em App.tsx FORA do shell do profissional.
 * App do aluno: auth pelo token do link (?t=), sem sessão Supabase.
 * A landing `/` e `/apresentacao` saíram deste domínio (reconstrução dedicada).
 */
export const rotas: RouteObject[] = [
  { path: "/a/:id", element: <AlunoInicio /> },
  { path: "/a/:id/treino/:idx", element: <AlunoTreino /> },
  { path: "/a/:id/completar", element: <AlunoCompletar /> },
  { path: "/a/:id/historico", element: <AlunoHistorico /> },
  { path: "/a/:id/mensagens", element: <AlunoMensagens /> },
  { path: "/legal/termos", element: <Termos /> },
  { path: "/legal/privacidade", element: <Privacidade /> },
];

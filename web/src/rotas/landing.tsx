import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const LandingRota = lazy(() => import("@/pages/landing/LandingRota"));
const Apresentacao = lazy(() => import("@/pages/landing/Apresentacao"));

/** Landing pública e /apresentacao. Montadas no App.tsx fora do shell. */
export const rotasLanding: RouteObject[] = [
  { path: "/", element: <LandingRota /> },
  { path: "/apresentacao", element: <Apresentacao /> },
];

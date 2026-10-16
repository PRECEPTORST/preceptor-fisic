import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const LandingRota = lazy(() => import("@/pages/landing/LandingRota"));

/** Landing pública. Montar no App.tsx fora do shell (e tirar o redirect "/" → "/dashboard"). */
export const rotasLanding: RouteObject[] = [{ path: "/", element: <LandingRota /> }];

import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams, type RouteObject } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireProfessional } from "@/components/RequireProfessional";
import { SkeletonLista } from "@/components/QueryState";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NaoEncontrado from "@/pages/NaoEncontrado";
import { rotas as rotas_alunos } from "@/rotas/alunos";
import { rotas as rotas_treinos } from "@/rotas/treinos";
import { rotas as rotas_rotina } from "@/rotas/rotina";
import { rotas as rotas_conta } from "@/rotas/conta";
import { rotas as rotas_crm } from "@/rotas/crm";
import { rotas as rotas_publico } from "@/rotas/publico";
import { rotasLanding } from "@/rotas/landing";

// Rota sem shell (públicas e app do aluno) vs. dentro do shell do profissional.
const montar = (r: RouteObject[]) => r.map((x, i) => <Route key={x.path ?? i} path={x.path} element={x.element} />);

// Telas fora do caminho crítico entram por lazy (bundle inicial pequeno).
const EmConstrucao = lazy(() => import("@/pages/EmConstrucao"));

/** /planos/* (nome antigo) → /treinos/*: links e favoritos antigos continuam valendo. */
function RedirecionaPlanos() {
  const p = useParams();
  return <Navigate to={`/treinos/${p["*"] ?? ""}`} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <BrowserRouter>
            <Suspense fallback={<div className="p-8"><SkeletonLista /></div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                {montar(rotas_publico)}
                {montar(rotasLanding)}
                <Route element={<RequireProfessional />}>
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    {montar([...rotas_alunos, ...rotas_treinos, ...rotas_rotina, ...rotas_conta, ...rotas_crm])}
                    <Route path="/planos/*" element={<RedirecionaPlanos />} />
                    <Route path="*" element={<EmConstrucao />} />
                  </Route>
                </Route>
                <Route path="/404" element={<NaoEncontrado />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

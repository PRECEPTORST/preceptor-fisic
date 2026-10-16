import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import Landing from "./Landing";

const DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO === "1";

/**
 * Landing sem o resto do App (sem router, React Query, AuthProvider): é o que
 * o main.tsx hidrata em "/". Começa anônima, igual ao HTML pré-renderizado, e
 * troca para "Abrir o app" depois de ler a sessão.
 */
export default function LandingIsolada() {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    if (DEMO) {
      setLogado(true);
      return;
    }
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
  }, []);
  return <Landing logado={logado} />;
}

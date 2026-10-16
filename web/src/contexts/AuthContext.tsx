import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";

type Auth = {
  session: Session | null;
  carregando: boolean;
  configurado: boolean;
  sair: () => Promise<void>;
};

const DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO === "1";

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Modo demo (só dev): sessão fictícia, a API de fixtures não confere token.
    if (DEMO) {
      setSession({ access_token: "demo", user: { id: "demo-user" } } as Session);
      setCarregando(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  return (
    <Ctx.Provider value={{ session, carregando, configurado: supabaseConfigurado || DEMO, sair }}>{children}</Ctx.Provider>
  );
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}

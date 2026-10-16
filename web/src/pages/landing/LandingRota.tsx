import { useAuth } from "@/contexts/AuthContext";
import Landing from "./Landing";

/** "/" dentro do App: quem está logado vê "Abrir o app" no lugar de "Entrar". */
export default function LandingRota() {
  const { session } = useAuth();
  return <Landing logado={!!session} />;
}

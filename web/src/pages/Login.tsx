import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { destinoSeguro } from "@/lib/rotas";

type Modo = "entrar" | "cadastrar";
type Tokens = { access_token: string; refresh_token: string } | { ok: true; message: string };

export default function Login() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const destino = destinoSeguro(params.get("next"));
  const [modo, setModo] = useState<Modo>(params.get("modo") === "cadastrar" ? "cadastrar" : "entrar");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(params.get("redefinida") ? "Senha redefinida. Entre com a nova senha." : null);
  const [termos, setTermos] = useState(false);

  if (session) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      const corpo =
        modo === "entrar"
          ? { email: f.get("email"), password: f.get("password") }
          : { name: f.get("name"), email: f.get("email"), password: f.get("password"), acceptTerms: termos };
      const r = await api<Tokens>(`/auth/${modo}`, { method: "POST", json: corpo });
      if ("access_token" in r) {
        await supabase.auth.setSession(r);
        navigate(destino, { replace: true });
      } else {
        setModo("entrar");
        setAviso(r.message);
      }
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-bg-elevated p-12 lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark size={32} />
          <span className="text-body-lg font-semibold">PreceptorFISIC</span>
        </div>
        <div>
          <p className="eyebrow mb-4">Plataforma para profissionais</p>
          <h1 className="max-w-md text-h3 font-semibold text-ink">
            Prescrição de treino com IA e <span className="text-brand">rigor clínico.</span>
          </h1>
          <p className="mt-4 max-w-md text-body-lg text-ink-soft">
            Avaliação, risco cardiovascular, plano e acompanhamento do aluno no mesmo lugar.
          </p>
        </div>
        <p className="font-mono text-caption text-ink-mute">Dados na região BR · Conformidade LGPD</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={28} />
            <span className="text-body-lg font-semibold">PreceptorFISIC</span>
          </div>
          <h2 className="text-h5 font-semibold">{modo === "entrar" ? "Entrar" : "Criar conta"}</h2>
          <p className="mt-1 text-body text-ink-mute">
            {modo === "entrar" ? "Use o e-mail da sua conta profissional." : "7 dias grátis, sem cartão."}
          </p>

          <div role="tablist" aria-label="Entrar ou criar conta" className="mt-6 grid grid-cols-2 rounded-md bg-bg-subtle p-1">
            {(["entrar", "cadastrar"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={modo === m}
                onClick={() => {
                  setModo(m);
                  setErro(null);
                }}
                className={`h-9 rounded text-body transition-colors ${modo === m ? "bg-bg-elevated font-medium text-ink shadow-card" : "text-ink-mute hover:text-ink"}`}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
            {modo === "cadastrar" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" name="name" autoComplete="name" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail profissional</Label>
              <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {modo === "entrar" && (
                  <Link to="/recuperar" className="text-caption text-ink-mute underline-offset-4 hover:text-brand hover:underline">
                    Esqueci minha senha
                  </Link>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                minLength={modo === "cadastrar" ? 8 : undefined}
                aria-describedby={modo === "cadastrar" ? "senha-dica" : undefined}
                required
              />
              {modo === "cadastrar" && (
                <p id="senha-dica" className="text-caption text-ink-mute">
                  Pelo menos <span className="num">8</span> caracteres.
                </p>
              )}
            </div>
            {modo === "cadastrar" && (
              <div className="flex items-start gap-2">
                <Checkbox id="termos" checked={termos} onCheckedChange={(v) => setTermos(v === true)} className="mt-0.5" />
                <Label htmlFor="termos" className="text-caption font-normal leading-snug text-ink-soft">
                  Li e aceito os{" "}
                  <a href="/legal/termos" target="_blank" className="text-brand underline-offset-4 hover:underline">
                    Termos de Uso
                  </a>{" "}
                  e a{" "}
                  <a href="/legal/privacidade" target="_blank" className="text-brand underline-offset-4 hover:underline">
                    Política de Privacidade
                  </a>
                  .
                </Label>
              </div>
            )}

            {erro && (
              <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft px-3 py-2 text-body text-negative">
                {erro}
              </p>
            )}
            {aviso && (
              <p role="status" className="rounded-md border border-positive/40 bg-positive-soft px-3 py-2 text-body text-positive">
                {aviso}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" aria-hidden />}
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

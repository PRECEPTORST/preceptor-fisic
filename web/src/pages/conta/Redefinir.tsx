import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { erroDeSenha, tokenDeRecuperacao } from "@/lib/conta";
import { useAuth } from "@/contexts/AuthContext";
import { MolduraPublica } from "@/components/conta/MolduraPublica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TOKEN_ERROR = 'Link inválido ou expirado. Peça um novo em "Esqueci minha senha".';

/**
 * O token NÃO é consumido ao abrir a página: o preview do WhatsApp (e
 * antivírus, prefetch) queimaria o link de uso único. Ele só é usado no envio,
 * depois de a senha passar na validação.
 *  - token_hash → API (verifyOtp no servidor)
 *  - code (PKCE) → no browser, que guarda o code_verifier
 *  - sem token, mas com sessão de recovery (link implícito #access_token) → updateUser no browser
 */
export default function Redefinir() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, carregando } = useAuth();
  const token = tokenDeRecuperacao(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const semLink = !carregando && !token && !session;

  const redefinir = useMutation({
    mutationFn: async () => {
      if (token?.tipo === "hash") {
        await api("/recuperar/redefinir", { method: "POST", json: { token_hash: token.valor, password, confirm } });
        return;
      }
      if (token?.tipo === "code") {
        const { error } = await supabase.auth.exchangeCodeForSession(token.valor);
        if (error) throw new Error(TOKEN_ERROR);
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error("Não foi possível atualizar. O link pode ter expirado. Peça um novo.");
      await supabase.auth.signOut();
      queryClient.clear();
    },
    onSuccess: () => navigate("/login?redefinida=1", { replace: true }),
    onError: (e) => setErro(e.message),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    // Valida ANTES de tocar no token: erro de digitação não pode gastar o link.
    const v = erroDeSenha(password, confirm);
    setErro(v);
    if (!v) redefinir.mutate();
  }

  return (
    <MolduraPublica>
      <p className="eyebrow">Defina a nova senha</p>
      <h1 className="mt-2 text-h4 font-semibold text-ink">Quase lá.</h1>
      <p className="mt-2 text-body text-ink-soft">Escolha uma senha de pelo menos 8 caracteres. É com ela que você vai entrar daqui em diante.</p>

      <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
        {(semLink || erro) && (
          <p role="alert" className="rounded-md border border-negative/40 bg-negative-soft p-3 text-caption text-ink">
            {semLink ? TOKEN_ERROR : erro}{" "}
            {(semLink || erro === TOKEN_ERROR) && (
              <Link to="/recuperar" className="text-brand underline-offset-4 hover:underline">
                Pedir um novo link
              </Link>
            )}
          </p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="rd-pass">Nova senha</Label>
          <Input
            id="rd-pass"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={semLink}
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rd-confirm">Confirme a senha</Label>
          <Input
            id="rd-confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Digite de novo"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={semLink}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={semLink || redefinir.isPending}>
          {redefinir.isPending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
      <Button asChild variant="ghost" className="mt-3 w-full">
        <Link to="/login">Voltar para a entrada</Link>
      </Button>
    </MolduraPublica>
  );
}

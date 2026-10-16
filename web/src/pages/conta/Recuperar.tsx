import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { linkWhatsapp } from "@/lib/conta";
import { MolduraPublica } from "@/components/conta/MolduraPublica";
import { Button } from "@/components/ui/button";

// Recuperação feita pelo time: a pessoa fala no WhatsApp e um admin gera o
// link novo no CRM. Não há envio automático de e-mail configurado.
const WA = linkWhatsapp("Olá! Esqueci minha senha do PreceptorFISIC e gostaria de gerar um novo link de acesso.");

export default function Recuperar() {
  return (
    <MolduraPublica>
      <p className="eyebrow">Recuperação de senha</p>
      <h1 className="mt-2 text-h4 font-semibold text-ink">Esqueceu a senha?</h1>
      <p className="mt-2 text-body text-ink-soft">
        A gente gera um link de acesso novo para você. Fale com o time no WhatsApp e diga o e-mail que você usa para entrar.
      </p>
      <Button asChild size="lg" className="mt-6 w-full">
        <a href={WA} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden /> Falar com o time no WhatsApp
        </a>
      </Button>
      <p className="mt-4 text-caption text-ink-mute">
        Assim que você mandar a mensagem, o time gera o link e devolve por ali mesmo. É só abrir e escolher a nova senha.
      </p>
      <Button asChild variant="ghost" className="mt-4 w-full">
        <Link to="/login">
          <ArrowLeft aria-hidden /> Voltar para a entrada
        </Link>
      </Button>
    </MolduraPublica>
  );
}

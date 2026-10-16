import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** Link de volta compacto, acima do PageHeader. */
export function Voltar({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex items-center gap-1.5 text-caption text-ink-mute transition-colors hover:text-brand"
    >
      <ArrowLeft className="size-3.5" aria-hidden /> {children}
    </Link>
  );
}

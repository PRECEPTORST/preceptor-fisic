import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, History, House, MessageCircle } from "lucide-react";
import { comToken } from "@/lib/aluno-api";
import { cn } from "@/lib/utils";

/** id do aluno e token do link mágico (?t=), lidos da URL. */
export function useAlunoLink() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const token = sp.get("t");
  return { id, token, q: comToken(token), base: `/a/${id}` };
}

/** Manifest PWA do aluno: start_url é o link tokenizado (o global abriria o login do profissional). */
function useManifestDoAluno(id: string, token: string | null) {
  useEffect(() => {
    if (!token) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = `/api/aluno/${encodeURIComponent(id)}/manifest.webmanifest?t=${encodeURIComponent(token)}`;
    const globais = [...document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]')];
    globais.forEach((l) => l.remove());
    document.head.appendChild(link);
    return () => {
      link.remove();
      globais.forEach((l) => document.head.appendChild(l));
    };
  }, [id, token]);
}

/**
 * Moldura do app do aluno (brief §4.8). Celular primeiro, uma mão: barra
 * inferior com rótulo, alvos de 44px+, safe-area do iPhone. No tablet o
 * conteúdo cresce até 42rem em vez de ficar numa coluna presa de 460px.
 */
export function AlunoShell({
  children,
  titulo,
  subtitulo,
  voltar,
  acoes,
  semAbas,
  naoLidas = 0,
}: {
  children: ReactNode;
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  /** Mostra "Voltar ao início" no topo. */
  voltar?: boolean;
  acoes?: ReactNode;
  /** Sem a barra inferior (tela de execução do treino, com ação fixa própria). */
  semAbas?: boolean;
  naoLidas?: number;
}) {
  const { id, token, q, base } = useAlunoLink();
  useManifestDoAluno(id, token);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-bg-elevated focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      {(titulo || voltar) && (
        <header className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-2 px-2 sm:px-4">
            {voltar ? (
              <Link
                to={`${base}${q}`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md pl-1 pr-3 text-body text-ink-soft hover:text-ink"
              >
                <ChevronLeft className="size-5" aria-hidden />
                Início
              </Link>
            ) : (
              <span className="w-2" />
            )}
            <div className="min-w-0 flex-1">
              {subtitulo && <p className="eyebrow truncate">{subtitulo}</p>}
              {titulo && <h1 className="truncate text-body-lg font-medium">{titulo}</h1>}
            </div>
            {acoes}
          </div>
        </header>
      )}

      <main
        id="conteudo"
        className={cn(
          "mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6",
          semAbas ? "pb-[calc(env(safe-area-inset-bottom)+6rem)]" : "pb-[calc(env(safe-area-inset-bottom)+6.5rem)]",
        )}
      >
        {children}
      </main>

      {!semAbas && <AbasAluno base={base} q={q} naoLidas={naoLidas} />}
    </div>
  );
}

function AbasAluno({ base, q, naoLidas }: { base: string; q: string; naoLidas: number }) {
  const abas = [
    { to: `${base}${q}`, label: "Hoje", icon: House, end: true },
    { to: `${base}/historico${q}`, label: "Histórico", icon: History, end: false },
    { to: `${base}/mensagens${q}`, label: "Mensagens", icon: MessageCircle, end: false, badge: naoLidas },
  ];
  return (
    <nav
      aria-label="Navegação do app"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg-elevated/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-3">
        {abas.map((a) => (
          <li key={a.label}>
            <NavLink
              to={a.to}
              end={a.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-label font-medium transition-colors",
                  isActive ? "text-brand" : "text-ink-mute hover:text-ink",
                )
              }
            >
              <span className="relative">
                <a.icon className="size-6" aria-hidden />
                {!!a.badge && (
                  <span className="num absolute -right-2.5 -top-1.5 min-w-5 rounded-full bg-negative px-1 text-center text-micro leading-5 text-bg">
                    {a.badge}
                  </span>
                )}
              </span>
              <span>
                {a.label}
                {!!a.badge && <span className="sr-only">, {a.badge} não {a.badge === 1 ? "lida" : "lidas"}</span>}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

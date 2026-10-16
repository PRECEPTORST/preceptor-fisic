import { useEffect } from "react";

/** document.title e meta description da página (SPA, sem SSR). */
export function useTitulo(titulo: string, descricao?: string) {
  useEffect(() => {
    const antes = document.title;
    document.title = titulo;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const descAntes = meta?.content;
    if (descricao) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = descricao;
    }
    return () => {
      document.title = antes;
      if (meta && descAntes !== undefined) meta.content = descAntes;
    };
  }, [titulo, descricao]);
}

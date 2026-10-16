import { useEffect, useState } from "react";

/** Abaixo de md (768px): Sheet abre de baixo; acima, da lateral (brief §2.4). */
export function useEhCelular(): boolean {
  const consulta = "(max-width: 767px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia?.(consulta);
    if (!m) return;
    const h = () => setV(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return !!v;
}

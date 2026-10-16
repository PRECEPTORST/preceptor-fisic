import { useEffect, useRef, useState, type RefObject } from "react";

const reduzido = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Liga a entrada (.lp-in → .lp-visto) quando cada bloco aparece na tela.
 * Sem IntersectionObserver ou com movimento reduzido, tudo já aparece.
 */
export function useEntrada(raiz: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const itens = Array.from(el.querySelectorAll<HTMLElement>(".lp-in"));
    if (reduzido() || typeof IntersectionObserver === "undefined") {
      itens.forEach((i) => i.classList.add("lp-visto"));
      return;
    }
    el.classList.add("lp-js");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("lp-visto");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    itens.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [raiz]);
}

const fmt = new Intl.NumberFormat("pt-BR");

/** Número que conta de 0 até o valor quando entra na tela. O HTML do servidor já sai com o valor final. */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [atual, setAtual] = useState(valor);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduzido() || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const dur = 700;
      const passo = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        setAtual(Math.round(valor * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(passo);
      };
      setAtual(0);
      raf = requestAnimationFrame(passo);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [valor]);

  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      <span className="sr-only">{fmt.format(valor)}</span>
      <span aria-hidden="true">{fmt.format(atual)}</span>
    </span>
  );
}

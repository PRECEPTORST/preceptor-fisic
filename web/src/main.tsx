import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-mono/latin-500.css";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Erros fora do render também ganham registro (padrão Cockpit).
window.addEventListener("error", (e) => console.error("[fisic-crash] window.onerror:", e.message, e.filename, e.lineno));
window.addEventListener("unhandledrejection", (e) => console.error("[fisic-crash] unhandledrejection:", e.reason));

const raiz = document.getElementById("root")!;

if (window.location.pathname === "/") {
  // Landing: o build grava o HTML pré-renderizado em dist/index.html
  // (scripts/prerender-landing.mjs). Com HTML, hidrata; sem (dev), monta.
  void import("./pages/landing/LandingIsolada").then(({ default: LandingIsolada }) => {
    const arvore = (
      <ErrorBoundary>
        <LandingIsolada />
      </ErrorBoundary>
    );
    if (raiz.hasChildNodes()) hydrateRoot(raiz, arvore);
    else createRoot(raiz).render(arvore);
  });
} else {
  createRoot(raiz).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

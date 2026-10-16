import { renderToString } from "react-dom/server";
import Landing from "./Landing";

/** Entrada do build SSR usado só pelo prerender. Visitante anônimo. */
export function render(): string {
  return renderToString(<Landing logado={false} />);
}
export { cabecalho } from "./seo";

/** Cabeçalho da landing pré-renderizada (scripts/prerender-landing.mjs). */
export const TITULO = "PreceptorFISIC · Prescrição clínica validada";
export const DESCRICAO =
  "Prescrição de exercício para populações especiais, para profissionais CREF e CREFITO: diretrizes ACSM citadas, 23 regras clínicas e app do aluno no celular. 7 dias grátis.";

export const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PreceptorFISIC",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  description: DESCRICAO,
  offers: { "@type": "AggregateOffer", lowPrice: "39.90", highPrice: "99.90", priceCurrency: "BRL", offerCount: 3 },
  audience: { "@type": "Audience", audienceType: "Profissionais CREF e CREFITO" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function cabecalho(origem: string, plausible?: string): string {
  const url = `${origem.replace(/\/$/, "")}/`;
  const img = `${url}og-image.png`;
  return [
    `<title>${esc(TITULO)}</title>`,
    `<meta name="description" content="${esc(DESCRICAO)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(TITULO)}" />`,
    `<meta property="og:description" content="${esc(DESCRICAO)}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:site_name" content="PreceptorFISIC" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(TITULO)}" />`,
    `<meta name="twitter:description" content="${esc(DESCRICAO)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<script type="application/ld+json">${JSON.stringify(JSON_LD).replace(/</g, "\\u003c")}</script>`,
    plausible
      ? `<script defer data-domain="${esc(plausible)}" src="https://plausible.io/js/script.outbound-links.js"></script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

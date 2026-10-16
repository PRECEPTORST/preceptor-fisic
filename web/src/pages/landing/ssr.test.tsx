import { render, cabecalho } from "./ssr";

describe("prerender da landing", () => {
  const html = render();
  const head = cabecalho("https://exemplo.com.br");

  it("contém o H1 e os CTAs certos", () => {
    expect(html).toMatch(/<h1[^>]*>Prescreva treinos com rigor clínico\.<\/h1>/);
    expect(html).toContain("/login?modo=cadastrar");
    expect(html).not.toContain("mode=signup");
    expect(html).toContain("Entrar");
  });

  it("head tem title, canonical, OG e JSON-LD com AggregateOffer", () => {
    expect(head).toContain("<title>PreceptorFISIC · Prescrição clínica validada</title>");
    expect(head).toContain('<link rel="canonical" href="https://exemplo.com.br/" />');
    expect(head).toContain('og:image" content="https://exemplo.com.br/og-image.png"');
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(head)![1]!);
    expect(ld.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "39.90", highPrice: "99.90", priceCurrency: "BRL" });
    expect(ld.operatingSystem).toBe("Web");
    expect(head).not.toContain("plausible");
    expect(cabecalho("https://x.com", "x.com")).toContain('data-domain="x.com"');
  });
});

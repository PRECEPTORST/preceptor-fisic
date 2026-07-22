import type { RequestHandler } from './$types';

/**
 * robots.txt dinâmico. Era um arquivo em static/ com o domínio fixo da
 * produção antiga (abandonada) — o que apontava os crawlers pro sitemap
 * de um site congelado. Aqui a origem sai da própria request, igual ao
 * /sitemap.xml.
 */
const BODY = `User-agent: *
Allow: /
Allow: /login
Allow: /legal/

# Áreas privadas — não indexar
Disallow: /dashboard
Disallow: /crm
Disallow: /alunos
Disallow: /planos
Disallow: /exercicios
Disallow: /mensagens
Disallow: /agenda
Disallow: /configuracoes
Disallow: /onboarding
Disallow: /feedback
Disallow: /logout
Disallow: /a/
Disallow: /recuperar
Disallow: /api/
`;

export const GET: RequestHandler = ({ url }) => {
	return new Response(`${BODY}\nSitemap: ${url.origin}/sitemap.xml\n`, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};

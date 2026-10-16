import { Hono } from 'hono';
import { fixtures } from './fixtures';

/**
 * API de demonstração (só `vite dev` com VITE_DEMO=1). Responde fixtures por
 * rota para validar telas sem banco nem sessão. Nunca entra no build.
 * Cada tela nova registra a fixture dela em ./fixtures.ts.
 */
export const demo = new Hono().basePath('/api');

demo.all('*', (c) => {
	const chave = `${c.req.method} ${c.req.path.replace(/^\/api/, '')}`;
	for (const [padrao, resp] of Object.entries(fixtures)) {
		const re = new RegExp('^' + padrao.replace(/:[a-zA-Z]+/g, '[^/]+') + '$');
		if (re.test(chave)) return c.json(typeof resp === 'function' ? resp(c.req.path) : resp);
	}
	return c.json({ error: `demo: sem fixture para ${chave}` }, 404);
});

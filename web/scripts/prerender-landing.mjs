// Pré-renderiza a landing ("/") depois do `vite build`: o SPA perde o SSR do
// SvelteKit, e sem isto o Google e os previews de link veriam um <div> vazio.
//
// 1. build SSR da entrada src/pages/landing/ssr.tsx (vite, mesma config);
// 2. renderToString da landing anônima;
// 3. grava em dist/index.html: head (title, description, canonical, OG,
//    Twitter, JSON-LD, Plausible se houver PUBLIC_PLAUSIBLE_DOMAIN) + HTML.
//
// O index.html também é o fallback de todas as rotas do SPA (build-api.mjs).
// Por isso, logo depois do #root vai um script que esvazia o HTML da landing
// quando a rota não é "/", antes de pintar.
import { build, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const web = resolve(import.meta.dirname, '..');
const repo = resolve(web, '..');
const dist = resolve(web, 'dist');
const env = { ...loadEnv('production', repo, ''), ...process.env };

const origem =
	env.PUBLIC_SITE_URL ||
	(env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://preceptor-fisic-staging.vercel.app');

// Dentro de web/ para os imports externos (node_modules) resolverem.
const out = resolve(web, 'node_modules/.cache/fisic-ssr');
try {
	await build({
		root: web,
		// Config própria (não o vite.config.ts): os manualChunks do cliente
		// quebram o build SSR, e a landing não usa a API nem o dev server.
		configFile: false,
		envDir: repo,
		envPrefix: ['VITE_', 'PUBLIC_'],
		mode: 'production',
		logLevel: 'warn',
		plugins: [react()],
		resolve: { alias: { '@': resolve(web, 'src') } },
		build: { ssr: resolve(web, 'src/pages/landing/ssr.tsx'), outDir: out, emptyOutDir: true },
	});
	const mod = await import(pathToFileURL(join(out, 'ssr.js')).href);
	const html = mod.render();
	const head = mod.cabecalho(origem, env.PUBLIC_PLAUSIBLE_DOMAIN || undefined);

	const arquivo = resolve(dist, 'index.html');
	let pagina = readFileSync(arquivo, 'utf8');
	pagina = pagina
		.replace(/<title>[\s\S]*?<\/title>\s*/, '')
		.replace(/<meta name="description"[^>]*>\s*/, '')
		.replace('</head>', `    ${head}\n  </head>`)
		.replace(
			'<div id="root"></div>',
			`<div id="root">${html}</div>\n    <script>if(location.pathname!=="/"){document.getElementById("root").innerHTML="";document.title="PreceptorFISIC"}</script>`
		);
	if (!pagina.includes(html)) throw new Error('prerender: não achei <div id="root"></div> no dist/index.html');
	writeFileSync(arquivo, pagina);
	console.log(`prerender-landing: dist/index.html (${Math.round(pagina.length / 1024)} kB, origem ${origem})`);
} finally {
	rmSync(out, { recursive: true, force: true });
}

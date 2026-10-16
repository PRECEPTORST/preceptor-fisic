// Monta a saída da Vercel (Build Output API v3): o SPA vira estático e a API
// Hono vira uma Function Node. O esbuild resolve `$lib` (src/lib do SvelteKit,
// reaproveitado sem cópia) e troca os `$env/*` e `$app/*` por shims.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(web, '..');
const out = resolve(web, '.vercel/output');
const fn = resolve(out, 'functions/api.func');

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });
cpSync(resolve(web, 'dist'), resolve(out, 'static'), { recursive: true });

const shims = {
	'$env/dynamic/private': resolve(web, 'server/shims/env-private.ts'),
	'$env/dynamic/public': resolve(web, 'server/shims/env-public.ts'),
	'$app/environment': resolve(web, 'server/shims/app-environment.ts')
};

await build({
	entryPoints: [resolve(web, 'server/vercel.ts')],
	outfile: resolve(fn, 'index.mjs'),
	bundle: true,
	platform: 'node',
	target: 'node22',
	format: 'esm',
	sourcemap: true,
	// pino e o driver pg carregam módulos dinamicamente; ficam de fora e vão via node_modules
	banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
	plugins: [
		{
			name: 'sveltekit-aliases',
			setup(b) {
				b.onResolve({ filter: /^\$(env|app)\// }, (a) => {
					const p = shims[a.path];
					if (!p) throw new Error(`Sem shim para ${a.path}`);
					return { path: p };
				});
				b.onResolve({ filter: /^\$lib(\/|$)/ }, (a) =>
					b.resolve('./' + a.path.replace(/^\$lib/, 'src/lib'), { resolveDir: repo, kind: a.kind })
				);
			}
		}
	],
	// Atalhos de dev dependem de NODE_ENV: no bundle de produção ele é fixo.
	define: { 'process.env.NODE_ENV': '"production"' },
	logLevel: 'warning'
});

writeFileSync(
	resolve(fn, '.vc-config.json'),
	JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 300 }, null, 2)
);
writeFileSync(resolve(fn, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(
	resolve(out, 'config.json'),
	JSON.stringify(
		{
			version: 3,
			routes: [
				{ src: '/api/(.*)', dest: '/api' },
				{ handle: 'filesystem' },
				{ src: '/(.*)', dest: '/index.html' }
			]
		},
		null,
		2
	)
);
console.log('build-api: .vercel/output pronto');

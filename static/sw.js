// Preceptor Fisic — service worker mínimo.
// Estratégia: network-first com fallback pra cache. Suficiente pra
// instalação em home screen (cumpre requisito de PWA installability) +
// offline graceful degradation.

const CACHE = 'preceptor-v1';
const PRECACHE = ['/', '/dashboard', '/manifest.webmanifest', '/favicon.svg', '/icon-192.svg', '/icon-512.svg'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE).catch(() => {});
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;

	// Não interceptar non-GET ou cross-origin
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	// Skip API routes, auth callbacks, form actions — sempre rede
	if (url.pathname.startsWith('/api/') || url.search.includes('?/')) return;

	event.respondWith(
		(async () => {
			try {
				const fresh = await fetch(req);
				if (fresh.ok && req.headers.get('accept')?.includes('text/html')) {
					const cache = await caches.open(CACHE);
					cache.put(req, fresh.clone()).catch(() => {});
				}
				return fresh;
			} catch {
				const cached = await caches.match(req);
				return cached ?? new Response('Offline · sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
			}
		})()
	);
});

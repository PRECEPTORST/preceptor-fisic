<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import { ToastContainer } from '$lib/components/ui';
	import { env } from '$env/dynamic/public';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import type { Snippet } from 'svelte';

	// Vercel Speed Insights — Web Vitals (LCP, FID, CLS, INP, FCP, TTFB).
	// Só ativa em produção via Vercel; em dev/local é no-op.
	injectSpeedInsights();

	// Preload das duas fontes mais críticas (500 sans + 500 mono).
	// `?url` faz Vite resolver pra URL hasheada do build.
	import sansUrl from '@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff2?url';
	import monoUrl from '@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2?url';

	let { children }: { children: Snippet } = $props();

	// Plausible Analytics — privacy-first, sem cookies, agregado.
	// Só ativa se PUBLIC_PLAUSIBLE_DOMAIN tiver setada.
	const plausibleDomain = env.PUBLIC_PLAUSIBLE_DOMAIN;

	// View Transitions: cross-fade suave entre rotas. Só age no conteúdo
	// marcado com `view-transition-name: page-content` (sidebar fica estável).
	//
	// CRÍTICO: o onNavigate DEVE sempre resolver. Se o startViewTransition
	// abortar (estado inválido — ex: transition anterior presa), o callback
	// não roda, resolve() não é chamado, e a navegação trava pra sempre.
	// Por isso: failsafe de 600ms + catch nas promises da transition.
	onNavigate((nav) => {
		const startVT = (
			document as Document & { startViewTransition?: (cb: () => unknown) => unknown }
		).startViewTransition;
		if (typeof startVT !== 'function') return;

		return new Promise<void>((resolve) => {
			let resolved = false;
			const done = () => {
				if (!resolved) {
					resolved = true;
					resolve();
				}
			};
			// Failsafe: navegação nunca pode ficar presa por um efeito visual.
			const failsafe = setTimeout(done, 600);

			try {
				const transition = startVT.call(document, async () => {
					done();
					await nav.complete;
				}) as { ready?: Promise<unknown>; finished?: Promise<unknown> };
				transition.ready?.catch(() => done());
				transition.finished?.catch(() => done()).finally(() => clearTimeout(failsafe));
			} catch {
				done();
			}
		});
	});
</script>

<svelte:head>
	<link rel="preload" href={sansUrl} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={monoUrl} as="font" type="font/woff2" crossorigin="anonymous" />
	{#if plausibleDomain}
		<script
			defer
			data-domain={plausibleDomain}
			src="https://plausible.io/js/script.outbound-links.js"
		></script>
	{/if}
</svelte:head>

{@render children()}
<ToastContainer />

<script lang="ts">
	import '../app.css';
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

	// View Transitions REMOVIDAS de propósito: o startViewTransition disparado
	// a cada navegação congelava a thread principal capturando o snapshot da
	// página depois de algumas trocas de rota — o app travava e nenhum clique
	// respondia (nem o failsafe de timeout rodava, porque a thread estava
	// presa). Navegação client-side normal do SvelteKit é instantânea e
	// confiável; o cross-fade não vale o risco de travar o app.
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

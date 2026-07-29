<script lang="ts">
	import { Sidebar, MobileTopbar, MobileTabbar, MobileMoreSheet } from '$lib/components/layout';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	const userName = $derived(data.professional?.name ?? 'Visitante');
	const userCref = $derived(data.professional?.cref ?? 'modo design');
	const studentsCount = $derived(data.sidebarCounts?.students ?? 0);
	const unreadMessages = $derived(data.sidebarCounts?.unreadMessages ?? 0);
	const newLeadsCount = $derived(data.sidebarCounts?.newLeads ?? 0);
	const isAdmin = $derived(data.professional?.isAdmin ?? false);
	const isOrgOwner = $derived(data.isOrgOwner ?? false);
	const trial = $derived(data.trial ?? null);

	let moreOpen = $state(false);
</script>

<svelte:head>
	<!-- Manifest do app do PROFISSIONAL (start_url /dashboard). Fica aqui, e
	     não no app.html, porque o app do ALUNO (/a/[id]) serve um manifest
	     dinâmico próprio — o navegador usa o primeiro link que encontrar. -->
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<div class="app-shell">
	<!-- Sidebar — desktop only -->
	<Sidebar
		{userName}
		{userCref}
		{studentsCount}
		{unreadMessages}
		{newLeadsCount}
		{isAdmin}
		{isOrgOwner}
	/>

	<!-- Conteúdo: topbar mobile + main + tabbar mobile -->
	<div class="app-stack">
		<MobileTopbar {userName} />

		<!-- Faixa do período gratuito. Some sozinha quando vira assinatura paga
		     (o server só manda `trial` durante o teste). Fica FORA do
		     {#key pathname} pra não reanimar a cada navegação. -->
		{#if trial}
			<a class="trial-bar" class:urgente={trial.diasRestantes <= 2} href="/assinatura">
				<span class="ponto"></span>
				<span class="txt">Teste gratuito · {trial.label}</span>
				<span class="cta">Assinar agora →</span>
			</a>
		{/if}

		<main class="pf-main">
			<!-- {#key pathname} remonta o conteúdo a cada troca de rota, re-disparando
			     a animação CSS de entrada. Substituto leve das View Transitions
			     (removidas — congelavam a main thread; ver +layout.svelte raiz). -->
			{#key page.url.pathname}
				<div class="page-enter">
					{@render children()}
				</div>
			{/key}
		</main>

		<MobileTabbar onMore={() => (moreOpen = true)} />
	</div>

	<!-- Sheet "mais" mobile (overlay) -->
	<MobileMoreSheet
		open={moreOpen}
		onClose={() => (moreOpen = false)}
		{userName}
		{userCref}
		{isAdmin}
	/>
</div>

<style>
	.app-shell {
		display: flex;
		/* height fixo (não min-height) — trava o shell na viewport pra que
		   só .pf-main role, mantendo o sidebar fixo. Antes, com min-height,
		   o shell crescia com o conteúdo e o body inteiro rolava, levando
		   o sidebar junto. */
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		background: var(--bg-0);
	}
	.app-stack {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.pf-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
	}

	/* Faixa do trial: fora da .pf-main de propósito, pra não rolar junto com o
	   conteúdo. flex-shrink 0 senão o shell de altura fixa a espreme. */
	.trial-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 20px;
		background: var(--accent-wash, rgba(167, 139, 250, 0.1));
		border-bottom: 1px solid var(--ink-line);
		font: 500 13px var(--font-sans);
		color: var(--ink-1);
		text-decoration: none;
	}
	.trial-bar:hover {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
	.trial-bar .ponto {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		flex-shrink: 0;
	}
	.trial-bar .txt {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.trial-bar .cta {
		flex-shrink: 0;
		color: var(--accent-2);
		font-weight: 600;
	}
	/* Últimos dois dias: sai do roxo institucional pro tom de aviso. */
	.trial-bar.urgente {
		background: var(--warn-dim);
		border-bottom-color: var(--warn);
	}
	.trial-bar.urgente .ponto {
		background: var(--warn);
	}
	.trial-bar.urgente .cta {
		color: var(--warn);
	}

	@media (max-width: 600px) {
		.trial-bar {
			padding: 8px 14px;
			font-size: 12.5px;
			gap: 8px;
		}
	}
	.page-enter {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
		animation: pf-fade-up var(--dur-2) var(--ease) both;
	}
	@media (max-width: 1023px) {
		.pf-main {
			/* Espaço pro tab bar fixo (60px + safe-area) */
			padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
		}
	}
	/* Esconde sidebar inteira em mobile */
	@media (max-width: 1023px) {
		.app-shell :global(.pf-sidebar) {
			display: none;
		}
	}
	/* Toggle de tema fixo no canto superior direito (desktop). O .app-stack é
	   o containing block (position:relative) — o botão flutua sobre o main
	   sem empurrar layout. Mobile usa o toggle do topbar. */
	.app-stack {
		position: relative;
	}
</style>

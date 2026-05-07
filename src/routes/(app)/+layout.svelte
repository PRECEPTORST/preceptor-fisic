<script lang="ts">
	import { Sidebar } from '$lib/components/layout';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	const userName = $derived(data.professional?.name ?? 'Visitante');
	const userCref = $derived(data.professional?.cref ?? 'modo design');
</script>

<div style="display:flex;min-height:100vh;background:var(--bg-0)">
	<Sidebar {userName} {userCref} />
	<main class="pf-main">
		{@render children()}
	</main>
</div>

<style>
	.pf-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		view-transition-name: page-content;
	}
</style>

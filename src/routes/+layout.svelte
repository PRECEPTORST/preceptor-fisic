<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import { ToastContainer } from '$lib/components/ui';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	// View Transitions: cross-fade suave entre rotas. Só age no conteúdo
	// marcado com `view-transition-name: page-content` (sidebar fica estável).
	onNavigate((nav) => {
		// @ts-expect-error — startViewTransition é opt-in (Chrome/Edge/Safari recente)
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			// @ts-expect-error
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	});
</script>

{@render children()}
<ToastContainer />

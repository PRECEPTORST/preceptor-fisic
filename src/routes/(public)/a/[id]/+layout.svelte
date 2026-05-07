<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="aluno-shell">
	<div class="aluno-frame">
		{@render children()}
	</div>
</div>

<style>
	.aluno-shell {
		min-height: 100vh;
		background: radial-gradient(ellipse at top, #1a1530 0%, var(--bg-0) 60%);
		display: flex;
		justify-content: center;
		align-items: stretch;
	}
	.aluno-frame {
		width: 100%;
		max-width: 480px;
		min-height: 100vh;
		background: var(--bg-0);
		color: var(--ink-0);
		font: var(--body);
		position: relative;
		display: flex;
		flex-direction: column;
		view-transition-name: aluno-content;
	}
	@media (min-width: 600px) {
		.aluno-frame {
			border-left: 1px solid var(--ink-line);
			border-right: 1px solid var(--ink-line);
			margin: 24px 0;
			border-radius: var(--r-4);
			overflow: hidden;
			box-shadow: var(--shadow-pop);
		}
	}
</style>

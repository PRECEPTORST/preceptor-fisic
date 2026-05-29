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
	/* Tablet + desktop — coluna centralizada com moldura.
	   O app do aluno é pessoal/mobile-first; no PC fica uma coluna focada
	   e centralizada (padrão "app no desktop"), não um dashboard esticado.
	   Topo arredondado + fundo reto (encosta na tab bar fixa, sem flutuar). */
	@media (min-width: 600px) {
		.aluno-shell {
			padding: 28px 20px 0;
			align-items: flex-start;
		}
		.aluno-frame {
			max-width: 460px;
			min-height: calc(100vh - 28px);
			border: 1px solid var(--ink-line);
			border-bottom: 0;
			border-radius: var(--r-4) var(--r-4) 0 0;
			box-shadow: var(--shadow-pop);
		}
	}
</style>

<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toast } from './toast.svelte.js';

	function color(v: string) {
		return v === 'success'
			? 'var(--success)'
			: v === 'error'
				? 'var(--danger)'
				: v === 'warn'
					? 'var(--warn)'
					: 'var(--accent)';
	}
	function bg(v: string) {
		return v === 'success'
			? 'var(--success-dim)'
			: v === 'error'
				? 'var(--danger-dim)'
				: v === 'warn'
					? 'var(--warn-dim)'
					: 'var(--accent-wash)';
	}
	function icon(v: string) {
		return v === 'success' ? '✓' : v === 'error' ? '✗' : v === 'warn' ? '⚠' : 'ℹ';
	}
</script>

<div class="toast-stack" role="status" aria-live="polite">
	{#each toast.items as t (t.id)}
		<div
			class="toast"
			style="--c:{color(t.variant)};--bg:{bg(t.variant)}"
			in:fly={{ y: 16, duration: 200 }}
			out:fade={{ duration: 140 }}
		>
			<span class="toast-icon">{icon(t.variant)}</span>
			<span class="toast-msg">{t.message}</span>
			<button class="toast-close" aria-label="Fechar" onclick={() => toast.dismiss(t.id)}>×</button>
		</div>
	{/each}
</div>

<style>
	.toast-stack {
		position: fixed;
		bottom: 24px;
		right: 24px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		z-index: 1000;
		pointer-events: none;
	}
	.toast {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 280px;
		max-width: 420px;
		padding: 14px 16px;
		background: var(--bg-2);
		border: 1px solid var(--c);
		border-left: 3px solid var(--c);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
		font: var(--body-sm);
		color: var(--ink-0);
		pointer-events: auto;
	}
	.toast-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--bg);
		color: var(--c);
		flex-shrink: 0;
		font-weight: 600;
	}
	.toast-msg {
		flex: 1;
		line-height: 1.45;
	}
	.toast-close {
		background: transparent;
		border: 0;
		color: var(--ink-2);
		font-size: 18px;
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}
	.toast-close:hover {
		color: var(--ink-0);
	}

	@media (max-width: 600px) {
		.toast-stack {
			right: 16px;
			left: 16px;
			bottom: 16px;
		}
		.toast {
			min-width: 0;
			max-width: 100%;
		}
	}
</style>

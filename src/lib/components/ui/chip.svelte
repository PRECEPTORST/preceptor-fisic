<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'default' | 'active' | 'success' | 'warn' | 'danger';
	type Props = {
		variant?: Variant;
		children?: Snippet;
		active?: boolean;
		onclick?: (e: MouseEvent) => void;
		style?: string;
	};
	let { variant = 'default', children, active = false, onclick, style = '' }: Props = $props();

	const palette: Record<Variant, { bg: string; border: string; color: string }> = {
		default: { bg: 'var(--bg-3)', border: 'var(--ink-line-2)', color: 'var(--ink-1)' },
		active: { bg: 'var(--accent-wash)', border: 'var(--accent)', color: 'var(--accent-2)' },
		success: { bg: 'var(--success-dim)', border: 'transparent', color: 'var(--success)' },
		warn: { bg: 'var(--warn-dim)', border: 'transparent', color: 'var(--warn)' },
		danger: { bg: 'var(--danger-dim)', border: 'transparent', color: 'var(--danger)' }
	};
	const v = $derived(palette[active ? 'active' : variant]);
</script>

<button
	type="button"
	{onclick}
	style="display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:var(--r-pill);background:{v.bg};border:1px solid {v.border};color:{v.color};font:500 12px var(--font-sans);letter-spacing:-0.005em;cursor:{onclick ? 'pointer' : 'default'};transition:all 140ms var(--ease);{style}"
>
	{@render children?.()}
</button>

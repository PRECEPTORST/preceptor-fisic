<script lang="ts">
	type Props = {
		label: string;
		unit?: string;
		value?: string;
		name?: string;
		onChange?: (v: string) => void;
	};
	let { label, unit, value = $bindable(''), name, onChange }: Props = $props();
	let focused = $state(false);
</script>

<div>
	<div class="eyebrow" style="margin-bottom:6px">{label}</div>
	<div
		style="display:flex;align-items:center;background:var(--bg-3);border:1px solid {focused
			? 'var(--accent)'
			: 'var(--ink-line-2)'};border-radius:var(--r-2);padding:0 12px;height:42px;{focused
			? 'box-shadow:0 0 0 3px var(--accent-wash)'
			: ''};transition:all 140ms var(--ease)"
	>
		<input
			{name}
			bind:value
			oninput={() => onChange?.(value)}
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
			style="flex:1;background:transparent;border:0;outline:none;color:var(--ink-0);font:500 16px var(--font-mono);font-variant-numeric:tabular-nums;min-width:0"
		/>
		{#if unit}<span style="font:var(--label-mono);color:var(--ink-2)">{unit}</span>{/if}
	</div>
</div>

<script lang="ts">
	type Props = {
		label: string;
		value: string | number;
		unit?: string;
		delta?: string;
		deltaPositive?: boolean;
		style?: string;
	};
	let { label, value, unit, delta, deltaPositive, style = '' }: Props = $props();
</script>

<div style="display:flex;flex-direction:column;gap:6px;{style}">
	<span class="eyebrow">{label}</span>
	<div style="display:flex;align-items:baseline;gap:6px">
		<span class="num" style="font:var(--num-lg);color:var(--ink-0)">{value}</span>
		{#if unit}<span style="font:var(--num-sm);color:var(--ink-2)">{unit}</span>{/if}
	</div>
	{#if delta}
		<span
			style="font:var(--label-mono);color:{deltaPositive ? 'var(--success)' : 'var(--danger)'}"
		>{deltaPositive ? '↗' : '↘'} {delta}</span>
	{/if}
</div>

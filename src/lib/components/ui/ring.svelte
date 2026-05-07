<script lang="ts">
	type Props = {
		value?: number;
		size?: number;
		stroke?: number;
		color?: string;
		label?: string | number;
		sub?: string;
	};
	let { value = 75, size = 120, stroke = 8, color = 'var(--accent)', label, sub }: Props = $props();

	const r = $derived((size - stroke) / 2);
	const c = $derived(2 * Math.PI * r);
	const offset = $derived(c - (value / 100) * c);
</script>

<div
	style:position="relative"
	style:width="{size}px"
	style:height="{size}px"
	style:display="inline-flex"
	style:align-items="center"
	style:justify-content="center"
>
	<svg width={size} height={size} style:transform="rotate(-90deg)">
		<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--ink-line-2)" stroke-width={stroke} />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke={color}
			stroke-width={stroke}
			stroke-dasharray={c}
			stroke-dashoffset={offset}
			stroke-linecap="round"
			style="transition: stroke-dashoffset 600ms var(--ease)"
		/>
	</svg>
	<div style:position="absolute" style:text-align="center">
		<div style:font="var(--num-lg)" style:color="var(--ink-0)" style:line-height="1">{label ?? value}</div>
		{#if sub}
			<div
				style:font="var(--label-mono)"
				style:color="var(--ink-2)"
				style:margin-top="4px"
				style:text-transform="uppercase"
				style:letter-spacing="0.08em"
			>{sub}</div>
		{/if}
	</div>
</div>

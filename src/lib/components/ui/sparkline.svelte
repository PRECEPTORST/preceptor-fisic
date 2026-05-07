<script lang="ts">
	type Props = { data: number[]; width?: number; height?: number; color?: string };
	let { data, width = 120, height = 32, color = 'var(--accent)' }: Props = $props();

	const points = $derived.by(() => {
		const max = Math.max(...data);
		const min = Math.min(...data);
		const range = max - min || 1;
		return data
			.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
			.join(' ');
	});
</script>

<svg {width} {height} style="display:block">
	<polyline
		{points}
		fill="none"
		stroke={color}
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>

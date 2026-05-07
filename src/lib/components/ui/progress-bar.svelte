<script lang="ts">
	type Props = { value?: number; color?: string; height?: number };
	let { value = 50, color = 'var(--accent)', height = 4 }: Props = $props();
</script>

<div
	style="width:100%;height:{height}px;background:var(--ink-line);border-radius:var(--r-pill);overflow:hidden"
>
	<div
		style="width:{value}%;height:100%;background:{color};border-radius:var(--r-pill);transition:width 400ms var(--ease)"
	></div>
</div>

<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { children?: Snippet; style?: string };
	let { children, style = '' }: Props = $props();
</script>

<span class="eyebrow" {style}>{@render children?.()}</span>

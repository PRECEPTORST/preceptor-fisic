<script lang="ts">
	type Variant = 'success' | 'warn' | 'danger' | 'muted';
	type Props = { variant?: Variant; pulse?: boolean };
	let { variant = 'success', pulse = false }: Props = $props();

	const colors: Record<Variant, string> = {
		success: 'var(--success)',
		warn: 'var(--warn)',
		danger: 'var(--danger)',
		muted: 'var(--ink-2)'
	};
	const color = $derived(colors[variant]);
</script>

<span
	style="width:8px;height:8px;border-radius:50%;background:{color};display:inline-block;{pulse
		? `box-shadow:0 0 0 4px ${color}33`
		: ''}"
></span>

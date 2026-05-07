<script lang="ts">
	import { Eyebrow } from '$lib/components/ui';

	type Props = { title: string; description: string; eta?: string };
	let { title, description, eta = 'Em desenvolvimento' }: Props = $props();
</script>

<div style="flex:1;display:flex;flex-direction:column;background:var(--bg-0)">
	<header
		style="padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1)"
	>
		<h1 style="margin:0;font:600 22px var(--font-sans);letter-spacing:-0.015em">{title}</h1>
		<div style="font:var(--body-sm);color:var(--ink-2);margin-top:2px">{description}</div>
	</header>

	<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:32px">
		<div style="max-width:420px;text-align:center">
			<div
				style="width:64px;height:64px;border-radius:var(--r-3);background:var(--accent-wash);border:1px solid var(--accent-dim);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px"
			>
				<span style="font:500 28px var(--font-mono);color:var(--accent)">·</span>
			</div>
			<Eyebrow>{eta}</Eyebrow>
			<h2 style="font:500 24px var(--font-sans);letter-spacing:-0.02em;margin:8px 0 12px;color:var(--ink-0)">
				{title} chega em breve
			</h2>
			<p style="font:var(--body);color:var(--ink-2);line-height:1.55;margin:0">
				Esta tela está no roadmap mas ainda não foi implementada. Acompanhe o progresso no README.
			</p>
		</div>
	</div>
</div>

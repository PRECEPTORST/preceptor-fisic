<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import { enhance } from '$app/forms';
	import { toast } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: { error?: string } | null } = $props();
	let entrando = $state(false);

	const MOTIVO: Record<string, string> = {
		usado: 'Esse convite já foi usado.',
		cancelado: 'Esse convite foi cancelado pela clínica.',
		expirado: 'Esse convite expirou. Peça um novo para a clínica.',
		ja_membro: 'Sua conta já faz parte dessa clínica.',
		outra_clinica:
			'Sua conta já pertence a outra clínica. Saia dela antes de aceitar este convite.'
	};
</script>

<svelte:head>
	<title>Convite · PreceptorFISIC</title>
</svelte:head>

<div class="wrap">
	<div class="bloco">
		<Eyebrow>◆ Convite</Eyebrow>

		{#if data.situacao === 'valido'}
			<h1>Entrar na {data.clinica}</h1>
			<p class="sub">
				Ao aceitar, sua conta passa a fazer parte da clínica. O acesso à plataforma passa a vir da
				assinatura dela, e as gerações por IA saem da franquia da equipe.
			</p>

			<div class="quadro">
				<div class="item">
					<span>Sua conta</span>
					<strong>{data.voce.nome}</strong>
					<span class="mono">{data.voce.email}</span>
				</div>
				<div class="item">
					<span>Convite enviado para</span>
					<strong class="mono">{data.convidado}</strong>
				</div>
			</div>

			<p class="nota">
				Seus alunos e planos continuam seus. A clínica passa a ver quantos alunos e quantos planos
				você tem, sem acessar a ficha clínica de ninguém.
			</p>

			{#if form?.error}
				<div class="erro">{form.error}</div>
			{/if}

			<form
				method="POST"
				action="?/aceitar"
				use:enhance={() => {
					entrando = true;
					return async ({ update, result }) => {
						entrando = false;
						if (result.type === 'error') toast.error('Falha inesperada. Tente de novo.');
						await update();
					};
				}}
			>
				<Button size="lg" type="submit" disabled={entrando} style="width:100%;justify-content:center">
					{entrando ? 'Entrando…' : `Aceitar e entrar na ${data.clinica}`}
				</Button>
			</form>
			<a class="recusar" href="/dashboard">Agora não</a>
		{:else}
			<h1>Convite indisponível</h1>
			<p class="sub">{MOTIVO[data.situacao] ?? 'Esse convite não pode ser usado.'}</p>
			<Button size="lg" onclick={() => (window.location.href = '/dashboard')}>
				Ir para o app
			</Button>
		{/if}
	</div>
</div>

<style>
	.wrap {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 24px;
	}
	.bloco {
		width: 100%;
		max-width: 520px;
		text-align: center;
	}
	h1 {
		font: 600 27px var(--font-sans);
		letter-spacing: -0.02em;
		color: var(--ink-0);
		margin: 12px 0 10px;
		line-height: 1.2;
	}
	.sub {
		margin: 0 auto 22px;
		max-width: 44ch;
		font: var(--body);
		color: var(--ink-2);
		line-height: 1.6;
	}
	.quadro {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
		margin-bottom: 16px;
		text-align: left;
	}
	.item {
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
		padding: 14px;
	}
	.item span {
		display: block;
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-3);
		margin-bottom: 4px;
	}
	.item strong {
		display: block;
		font: 500 14.5px var(--font-sans);
		color: var(--ink-0);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 12.5px;
		color: var(--ink-2);
	}
	.nota {
		font: var(--body-sm);
		color: var(--ink-3);
		line-height: 1.6;
		margin: 0 auto 20px;
		max-width: 46ch;
	}
	.erro {
		padding: 10px 14px;
		margin-bottom: 14px;
		border-radius: var(--r-2);
		background: var(--danger-dim);
		border: 1px solid var(--danger);
		color: var(--danger);
		font: var(--body-sm);
	}
	.recusar {
		display: inline-block;
		margin-top: 14px;
		font: 500 13.5px var(--font-sans);
		color: var(--ink-2);
		text-decoration: none;
	}
	.recusar:hover {
		color: var(--ink-0);
	}
</style>

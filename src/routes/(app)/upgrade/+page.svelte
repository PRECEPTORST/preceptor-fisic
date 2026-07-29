<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const temAcervo = $derived(data.acervo.alunos > 0 || data.acervo.planos > 0);

	// Zero não entra: "0 planos" na tela que tenta mostrar o que a pessoa
	// construiu trabalha contra o argumento.
	const NUMEROS = $derived(
		[
			{ n: data.acervo.alunos, label: data.acervo.alunos === 1 ? 'aluno' : 'alunos' },
			{ n: data.acervo.planos, label: data.acervo.planos === 1 ? 'plano' : 'planos' },
			{ n: data.acervo.publicados, label: 'publicados' }
		].filter((i) => i.n > 0)
	);
</script>

<svelte:head>
	<title>Assinar · PreceptorFISIC</title>
</svelte:head>

<div class="wrap">
	<div class="bloco">
		<Eyebrow>{data.usouTrial ? '◆ Teste encerrado' : '◆ Assinatura'}</Eyebrow>

		<h1>
			{#if data.usouTrial}
				{data.nome}, seus 7 dias acabaram.
			{:else}
				{data.nome}, falta assinar para começar.
			{/if}
		</h1>

		<p class="sub">
			{#if data.usouTrial && temAcervo}
				Nada foi apagado. Seus alunos, avaliações e planos continuam salvos e voltam a aparecer no
				instante em que o pagamento confirmar.
			{:else if data.usouTrial}
				Assine para voltar a cadastrar alunos e prescrever treinos.
			{:else}
				Escolha um plano para liberar o cadastro de alunos e a prescrição.
			{/if}
		</p>

		{#if temAcervo}
			<div class="acervo">
				{#each NUMEROS as item (item.label)}
					<div class="num">
						<strong>{item.n}</strong>
						<span>{item.label}</span>
					</div>
				{/each}
			</div>
			<p class="guardado">Guardados na sua conta, esperando você voltar.</p>
		{/if}

		<div class="acoes">
			<Button size="lg" onclick={() => goto('/assinatura')}>Ver planos e assinar</Button>
			<a class="secundario" href="/guia">Ler o guia de uso antes</a>
		</div>

		<div class="rodape">
			Dúvida sobre qual plano faz sentido para você?
			<a
				href="https://wa.me/553591481514?text={encodeURIComponent(
					'Olá! Tenho uma dúvida sobre os planos do PreceptorFISIC.'
				)}"
				target="_blank"
				rel="noopener">Fale com o time no WhatsApp</a
			>
		</div>
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
		max-width: 560px;
		text-align: center;
	}
	h1 {
		font: 600 30px var(--font-sans);
		letter-spacing: -0.025em;
		color: var(--ink-0);
		margin: 14px 0 10px;
		line-height: 1.15;
	}
	.sub {
		margin: 0 auto 28px;
		max-width: 46ch;
		font: var(--body);
		color: var(--ink-2);
		line-height: 1.6;
	}
	.acervo {
		display: flex;
		justify-content: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.num {
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-3);
		padding: 16px 22px;
		min-width: 104px;
	}
	.num strong {
		display: block;
		font: 600 26px var(--font-sans);
		color: var(--ink-0);
		letter-spacing: -0.02em;
	}
	.num span {
		display: block;
		margin-top: 2px;
		font: var(--label-mono);
		color: var(--ink-2);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.guardado {
		margin: 12px 0 0;
		font: var(--body-sm);
		color: var(--ink-3);
	}
	.acoes {
		margin-top: 30px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.secundario {
		font: 500 13.5px var(--font-sans);
		color: var(--ink-2);
		text-decoration: none;
	}
	.secundario:hover {
		color: var(--ink-0);
	}
	.rodape {
		margin-top: 34px;
		padding-top: 18px;
		border-top: 1px solid var(--ink-line);
		font: var(--body-sm);
		color: var(--ink-3);
		line-height: 1.6;
	}
	.rodape a {
		color: var(--accent-2);
		text-decoration: none;
	}

	@media (max-width: 600px) {
		h1 {
			font-size: 25px;
		}
	}
</style>

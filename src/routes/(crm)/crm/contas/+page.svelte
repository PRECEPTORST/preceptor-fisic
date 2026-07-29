<script lang="ts">
	import { Button, Chip, Avatar, toast } from '$lib/components/ui';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const contas = $derived(data.contas);

	let busca = $state('');
	let gerando = $state<string | null>(null);
	// Telefone digitado na hora: profissional não tem telefone cadastrado.
	let telefone = $state('');
	// Guardado em estado local, e não lido da prop `form`: assim o painel não
	// depende de invalidação de load e o link não some ao recarregar a lista.
	let gerado = $state<{ email: string; url: string } | null>(null);

	const filtradas = $derived.by(() => {
		const q = busca.trim().toLowerCase();
		if (!q) return contas;
		return contas.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.email.toLowerCase().includes(q) ||
				(c.cref ?? '').toLowerCase().includes(q)
		);
	});

	const linkGerado = $derived(gerado?.url ?? null);
	const emailDoLink = $derived(gerado?.email ?? null);

	/**
	 * Dias que faltam, arredondando pra cima — mesma regra do contador que o
	 * profissional vê no topo do app, pra suporte e usuário lerem o mesmo
	 * número. Calculado no cliente a partir da data, então atualiza sozinho
	 * conforme o tempo passa, sem depender de job nenhum.
	 */
	function diasRestantes(expira: Date | string | null): number {
		if (!expira) return 0;
		const ms = new Date(expira).getTime() - Date.now();
		return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
	}

	function situacao(c: (typeof contas)[number]) {
		const venceu = c.subscriptionExpiresAt
			? new Date(c.subscriptionExpiresAt).getTime() < Date.now()
			: true;
		const dias = diasRestantes(c.subscriptionExpiresAt);
		if (c.subscriptionStatus === 'active' && !venceu)
			return { label: 'Ativa', cor: 'var(--success)', dias: 0 };
		if (c.subscriptionStatus === 'trial' && !venceu)
			return {
				label: dias === 1 ? 'Teste · 1 dia' : `Teste · ${dias} dias`,
				cor: dias <= 2 ? 'var(--warn)' : 'var(--accent)',
				dias
			};
		if (c.subscriptionStatus === 'past_due')
			return { label: 'Pendente', cor: 'var(--warn)', dias: 0 };
		return { label: 'Sem acesso', cor: 'var(--ink-3)', dias: 0 };
	}

	async function copiar(texto: string) {
		try {
			await navigator.clipboard.writeText(texto);
			toast.success('Link copiado.');
		} catch {
			toast.error('Não consegui copiar — selecione o texto e copie manualmente.');
		}
	}

	function whatsappUrl(link: string, fone: string) {
		const digits = fone.replace(/\D/g, '');
		const numero = digits.length <= 11 ? `55${digits}` : digits;
		const msg =
			`Olá! Aqui é do PreceptorFISIC.\n\n` +
			`Segue o link para você criar uma nova senha e voltar a acessar sua conta:\n\n${link}\n\n` +
			`O link vale por uma hora e só pode ser usado uma vez. Qualquer coisa, é só chamar por aqui.`;
		return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
	}

	const fmtData = (d: Date | string | null) =>
		d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
</script>

<svelte:head>
	<title>Contas · CRM PreceptorFISIC</title>
</svelte:head>

<div class="head">
	<div>
		<h1>Contas</h1>
		<p class="sub">
			{contas.length} profissionais. Gere o link de nova senha e envie por WhatsApp quando alguém
			pedir ajuda para entrar.
		</p>
	</div>
	<input class="busca" placeholder="Buscar por nome, e-mail ou CREF" bind:value={busca} />
</div>

{#if linkGerado && emailDoLink}
	<section class="painel">
		<div class="painel-topo">
			<div>
				<div class="eyebrow">Link pronto</div>
				<strong>{emailDoLink}</strong>
			</div>
			<span class="validade">vale por 1 hora · uso único</span>
		</div>

		<div class="link-box">
			<code>{linkGerado}</code>
			<Button onclick={() => copiar(linkGerado)}>Copiar</Button>
		</div>

		<div class="zap">
			<input
				class="fone"
				placeholder="WhatsApp do profissional, ex: 35 99148 1514"
				bind:value={telefone}
				inputmode="tel"
			/>
			<a
				class="btn-zap"
				class:off={telefone.replace(/\D/g, '').length < 10}
				href={whatsappUrl(linkGerado, telefone)}
				target="_blank"
				rel="noopener"
			>
				Abrir no WhatsApp
			</a>
		</div>
		<p class="aviso">
			O link dá acesso à conta. Envie só para a pessoa dona do e-mail acima, no contato que você já
			conhece.
		</p>
	</section>
{/if}

<div class="tabela">
	{#each filtradas as c (c.id)}
		{@const s = situacao(c)}
		<article class="linha">
			<Avatar name={c.name} size={34} />
			<div class="quem">
				<div class="nome">
					{c.name}
					{#if c.isAdmin}<Chip>admin</Chip>{/if}
				</div>
				<div class="mail">{c.email}</div>
			</div>
			<div class="meta">
				<span class="ponto" style="background:{s.cor}"></span>
				{s.label}
			</div>
			<div class="desde">desde {fmtData(c.createdAt)}</div>
			<form
				method="POST"
				action="?/gerarLink"
				use:enhance={() => {
					gerando = c.id;
					return async ({ result }) => {
						gerando = null;
						if (result.type === 'success' && result.data?.resetUrl) {
							gerado = {
								email: String(result.data.email),
								url: String(result.data.resetUrl)
							};
							telefone = '';
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Não consegui gerar o link.'));
						} else if (result.type === 'error') {
							toast.error('Falha inesperada ao gerar o link.');
						}
					};
				}}
			>
				<input type="hidden" name="email" value={c.email} />
				<Button type="submit" disabled={gerando === c.id}>
					{gerando === c.id ? 'Gerando…' : 'Gerar link'}
				</Button>
			</form>
		</article>
	{:else}
		<p class="vazio">Nenhuma conta encontrada para “{busca}”.</p>
	{/each}
</div>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 20px;
		flex-wrap: wrap;
		margin-bottom: 24px;
	}
	h1 {
		font: 600 26px var(--font-sans);
		letter-spacing: -0.02em;
		margin: 0 0 6px;
		color: var(--ink-0);
	}
	.sub {
		margin: 0;
		color: var(--ink-2);
		font: var(--body-sm);
		max-width: 60ch;
	}
	.busca {
		background: var(--bg-2);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
		padding: 10px 14px;
		color: var(--ink-0);
		font: var(--body-sm);
		min-width: 280px;
		outline: none;
	}
	.busca:focus {
		border-color: var(--accent);
	}

	.painel {
		background: var(--bg-2);
		border: 1px solid var(--accent);
		border-radius: var(--r-3);
		padding: 18px;
		margin-bottom: 24px;
	}
	.painel-topo {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}
	.eyebrow {
		font: 500 10.5px var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--accent);
		margin-bottom: 3px;
	}
	.painel-topo strong {
		color: var(--ink-0);
		font: 500 15px var(--font-sans);
	}
	.validade {
		font: 500 11px var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
	}
	.link-box {
		display: flex;
		gap: 10px;
		align-items: center;
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
		padding: 10px 10px 10px 14px;
		margin-bottom: 12px;
	}
	.link-box code {
		flex: 1;
		font: 400 12px var(--font-mono);
		color: var(--ink-1);
		overflow-x: auto;
		white-space: nowrap;
	}

	.zap {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.fone {
		flex: 1;
		min-width: 220px;
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
		padding: 10px 14px;
		color: var(--ink-0);
		font: var(--body-sm);
		outline: none;
	}
	.fone:focus {
		border-color: var(--accent);
	}
	.btn-zap {
		display: inline-flex;
		align-items: center;
		padding: 10px 20px;
		border-radius: var(--r-2);
		background: var(--success);
		color: var(--on-accent);
		font: 600 14px var(--font-sans);
		text-decoration: none;
	}
	.btn-zap.off {
		opacity: 0.45;
		pointer-events: none;
	}
	.aviso {
		margin: 12px 0 0;
		font: var(--body-sm);
		color: var(--ink-2);
	}

	.tabela {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.linha {
		display: grid;
		/* 3ª coluna passou de 130px pra 150px: "Teste · 7 dias" não cabia. */
		grid-template-columns: 34px 1fr 150px 110px auto;
		align-items: center;
		gap: 14px;
		padding: 12px 14px;
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
	}
	.nome {
		font: 500 14.5px var(--font-sans);
		color: var(--ink-0);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.mail {
		font: 400 12.5px var(--font-mono);
		color: var(--ink-2);
		margin-top: 2px;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 7px;
		font: var(--body-sm);
		color: var(--ink-1);
	}
	.ponto {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.desde {
		font: 500 11.5px var(--font-mono);
		color: var(--ink-3);
	}
	.vazio {
		color: var(--ink-2);
		font: var(--body-sm);
		padding: 24px 0;
	}

	@media (max-width: 860px) {
		.linha {
			grid-template-columns: 34px 1fr auto;
			row-gap: 8px;
		}
		.meta,
		.desde {
			grid-column: 2 / -1;
		}
	}
</style>

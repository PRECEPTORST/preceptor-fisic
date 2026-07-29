<script lang="ts">
	import { Button, Eyebrow, Avatar, Chip, toast } from '$lib/components/ui';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let enviando = $state(false);
	// Link fica em estado local, e não na prop `form`: assim ele não some
	// quando a lista recarrega. Mesmo motivo do painel do CRM.
	let gerado = $state<{ email: string; url: string } | null>(null);

	const org = $derived(data.org);
	const vagasUsadas = $derived(data.membros.length + data.convites.length);
	const restamGeracoes = $derived(Math.max(0, org.generationsLimit - data.usadasNoCiclo));
	const pctPool = $derived(
		Math.min(100, Math.round((data.usadasNoCiclo / org.generationsLimit) * 100))
	);

	async function copiar(texto: string) {
		try {
			await navigator.clipboard.writeText(texto);
			toast.success('Link copiado.');
		} catch {
			toast.error('Não consegui copiar. Selecione o texto e copie manualmente.');
		}
	}

	const fmt = (d: Date | string) =>
		new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
</script>

<svelte:head>
	<title>Equipe · PreceptorFISIC</title>
</svelte:head>

<div class="pagina">
	<header class="topo">
		<div>
			<Eyebrow>◆ Institucional</Eyebrow>
			<h1>{org.name}</h1>
			<p class="sub">
				{data.membros.length}
				{data.membros.length === 1 ? 'profissional' : 'profissionais'} de {org.seats} vagas
				{#if data.convites.length}
					· {data.convites.length} convite{data.convites.length === 1 ? '' : 's'} pendente{data
						.convites.length === 1
						? ''
						: 's'}
				{/if}
			</p>
		</div>
	</header>

	<section class="cartoes">
		<div class="cartao">
			<div class="rotulo">Gerações por IA no ciclo</div>
			<div class="numero">{data.usadasNoCiclo} <span>de {org.generationsLimit}</span></div>
			<div class="barra"><div class="preenchida" style="width:{pctPool}%"></div></div>
			<div class="pe">
				{restamGeracoes} restantes · ciclo desde {fmt(data.cicloDesde)}
			</div>
		</div>

		<div class="cartao">
			<div class="rotulo">Teto por profissional</div>
			<form
				method="POST"
				action="?/limite"
				use:enhance={() => async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') toast.success('Teto atualizado.');
					else if (result.type === 'failure')
						toast.error(String(result.data?.error ?? 'Não consegui salvar.'));
				}}
			>
				<div class="linha-cap">
					<input
						name="cap"
						type="number"
						min="1"
						max={org.generationsLimit}
						value={org.perMemberGenerationCap ?? ''}
						placeholder="sem teto"
					/>
					<Button type="submit" variant="secondary">Salvar</Button>
				</div>
			</form>
			<div class="pe">
				Em branco, cada profissional puxa livremente do total da clínica.
			</div>
		</div>
	</section>

	<section class="bloco">
		<h2>Convidar profissional</h2>
		{#if vagasUsadas >= org.seats}
			<p class="aviso">
				As {org.seats} vagas do contrato estão ocupadas. Fale com o time para ampliar.
			</p>
		{:else}
			<form
				method="POST"
				action="?/convidar"
				use:enhance={() => {
					enviando = true;
					return async ({ update, result }) => {
						enviando = false;
						if (result.type === 'success' && result.data?.convite) {
							gerado = result.data.convite as { email: string; url: string };
							email = '';
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Não consegui criar o convite.'));
						}
						await update({ reset: false });
					};
				}}
			>
				<div class="linha-convite">
					<input
						name="email"
						type="email"
						bind:value={email}
						placeholder="email@doprofissional.com"
						required
					/>
					<Button type="submit" disabled={enviando}>
						{enviando ? 'Gerando…' : 'Gerar convite'}
					</Button>
				</div>
			</form>
		{/if}

		{#if gerado}
			<div class="painel">
				<div class="painel-topo">
					<strong>{gerado.email}</strong>
					<span class="validade">vale 7 dias · uso único</span>
				</div>
				<div class="link-box">
					<code>{gerado.url}</code>
					<Button onclick={() => copiar(gerado!.url)}>Copiar</Button>
				</div>
				<p class="pe">
					Envie esse link para a pessoa. Ela precisa ter conta no PreceptorFISIC (ou criar uma) e
					o link vincula a conta dela à clínica.
				</p>
			</div>
		{/if}

		{#if data.convites.length}
			<div class="pendentes">
				{#each data.convites as c (c.id)}
					<div class="pendente">
						<span>{c.email}</span>
						<span class="pe">expira {fmt(c.expiresAt)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="bloco">
		<h2>Profissionais</h2>
		<div class="tabela">
			{#each data.membros as m (m.id)}
				<article class="linha">
					<Avatar name={m.name} size={34} />
					<div class="quem">
						<div class="nome">
							{m.name}
							{#if m.is_owner}<Chip>administra</Chip>{/if}
						</div>
						<div class="mail">{m.email}{m.cref ? ' · ' + m.cref : ''}</div>
					</div>
					<div class="num-col"><strong>{m.alunos}</strong><span>alunos</span></div>
					<div class="num-col"><strong>{m.planos}</strong><span>planos</span></div>
					<div class="num-col">
						<strong>{m.noCiclo}</strong><span>IA no ciclo</span>
					</div>
					{#if !m.is_owner}
						<form
							method="POST"
							action="?/remover"
							use:enhance={() => async ({ update, result }) => {
								await update();
								if (result.type === 'success') toast.success('Profissional removido da clínica.');
							}}
						>
							<input type="hidden" name="professionalId" value={m.id} />
							<Button type="submit" variant="ghost">Remover</Button>
						</form>
					{:else}
						<span></span>
					{/if}
				</article>
			{/each}
		</div>
		<p class="pe rodape">
			Ficha clínica de aluno continua acessível apenas ao profissional que atende.
		</p>
	</section>

	<section class="bloco">
		<div class="cabecalho-alunos">
			<h2>Alunos da clínica</h2>
			<a class="acao" href="/alunos/novo">+ Cadastrar aluno</a>
		</div>
		{#if data.alunos.length === 0}
			<p class="pe">Nenhum aluno cadastrado pela equipe ainda.</p>
		{:else}
			<div class="tabela">
				{#each data.alunos as a (a.id)}
					<article class="linha-aluno">
						<Avatar name={a.nome} size={30} />
						<div class="quem">
							<div class="nome">{a.nome}</div>
							<div class="mail">desde {fmt(a.criado_em)}</div>
						</div>
						<div class="resp">
							<span class="resp-rot">Responsável</span>
							<strong>{a.responsavel}</strong>
						</div>
						<div class="num-col">
							<strong>{a.planos}</strong><span>publicados</span>
						</div>
					</article>
				{/each}
			</div>
		{/if}
		<p class="pe rodape">
			Cadastrando por aqui, você escolhe qual profissional fica responsável pelo aluno.
		</p>
	</section>
</div>

<style>
	.pagina {
		flex: 1;
		padding: 32px 40px;
		max-width: 1040px;
		width: 100%;
		margin: 0 auto;
	}
	.topo {
		margin-bottom: 24px;
	}
	h1 {
		font: 600 28px var(--font-sans);
		letter-spacing: -0.02em;
		color: var(--ink-0);
		margin: 8px 0 6px;
	}
	.sub {
		margin: 0;
		font: var(--body-sm);
		color: var(--ink-2);
	}
	h2 {
		font: 500 17px var(--font-sans);
		color: var(--ink-0);
		margin: 0 0 14px;
	}

	.cartoes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 14px;
		margin-bottom: 28px;
	}
	.cartao {
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-3);
		padding: 18px;
	}
	.rotulo {
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
		margin-bottom: 10px;
	}
	.numero {
		font: 600 26px var(--font-sans);
		color: var(--ink-0);
		letter-spacing: -0.02em;
	}
	.numero span {
		font: 400 14px var(--font-sans);
		color: var(--ink-2);
	}
	.barra {
		height: 6px;
		border-radius: 999px;
		background: var(--bg-3, var(--bg-2));
		margin: 10px 0 8px;
		overflow: hidden;
	}
	.preenchida {
		height: 100%;
		background: var(--accent);
	}
	.pe {
		font: var(--body-sm);
		color: var(--ink-3);
		margin: 0;
	}
	.rodape {
		margin-top: 12px;
	}

	.bloco {
		margin-bottom: 30px;
	}
	.linha-convite,
	.linha-cap {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.linha-convite input,
	.linha-cap input {
		flex: 1;
		min-width: 200px;
		background: var(--bg-2);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
		padding: 10px 14px;
		color: var(--ink-0);
		font: var(--body-sm);
		outline: none;
	}
	.linha-convite input:focus,
	.linha-cap input:focus {
		border-color: var(--accent);
	}
	.aviso {
		font: var(--body-sm);
		color: var(--warn);
		margin: 0;
	}

	.painel {
		margin-top: 14px;
		background: var(--bg-2);
		border: 1px solid var(--accent);
		border-radius: var(--r-3);
		padding: 16px;
	}
	.painel-topo {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}
	.painel-topo strong {
		color: var(--ink-0);
		font: 500 14.5px var(--font-sans);
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
		margin-bottom: 10px;
	}
	.link-box code {
		flex: 1;
		font: 400 12px var(--font-mono);
		color: var(--ink-1);
		overflow-x: auto;
		white-space: nowrap;
	}

	.pendentes {
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.pendente {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 14px;
		background: var(--bg-1);
		border: 1px dashed var(--ink-line-2, var(--ink-line));
		border-radius: var(--r-2);
		font: var(--body-sm);
		color: var(--ink-1);
	}

	.tabela {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.cabecalho-alunos {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}
	.acao {
		font: 500 13px var(--font-sans);
		color: var(--accent-2);
		text-decoration: none;
	}
	.linha-aluno {
		display: grid;
		grid-template-columns: 30px 1fr 200px 100px;
		align-items: center;
		gap: 14px;
		padding: 11px 14px;
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
	}
	.resp-rot {
		display: block;
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
	}
	.resp strong {
		font: 500 13.5px var(--font-sans);
		color: var(--ink-1);
	}
	.linha {
		display: grid;
		grid-template-columns: 34px 1fr 90px 90px 110px auto;
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
	.num-col strong {
		display: block;
		font: 600 16px var(--font-sans);
		color: var(--ink-0);
	}
	.num-col span {
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
	}

	@media (max-width: 860px) {
		.pagina {
			padding: 24px 16px;
		}
		.linha {
			grid-template-columns: 34px 1fr auto;
			row-gap: 10px;
		}
		.linha-aluno {
			grid-template-columns: 30px 1fr;
			row-gap: 8px;
		}
		.resp,
		.linha-aluno .num-col {
			grid-column: 2 / -1;
		}
		.num-col {
			grid-column: span 1;
		}
	}
</style>

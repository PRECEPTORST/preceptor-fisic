<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast, BrandMark } from '$lib/components/ui';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const prof = $derived(data.professional);
	const needsCpf = $derived(!prof.asaasCustomerId);
	const ativo = $derived(data.situacao === 'ativo');

	type PlanDef = {
		base: 'essencial' | 'pro';
		name: string;
		monthly: string;
		yearly: string;
		desc: string;
		items: string[];
		pop?: boolean;
	};
	const PLANS: PlanDef[] = [
		{
			base: 'essencial',
			name: 'Essencial',
			monthly: 'R$ 69,90',
			yearly: 'R$ 699,00',
			desc: 'Para o profissional em crescimento.',
			items: [
				'Até 60 alunos ativos',
				'Até 20 treinos por IA/mês',
				'Histórico completo de planos',
				'Suporte por e-mail'
			]
		},
		{
			base: 'pro',
			name: 'Pro',
			monthly: 'R$ 149,90',
			yearly: 'R$ 1.498,80',
			desc: 'Para quem vive de prescrição clínica.',
			pop: true,
			items: [
				'Até 150 alunos ativos',
				'Até 50 treinos por IA/mês',
				'Auditoria completa de cada plano',
				'Prioridade na geração'
			]
		}
	];
	const WA_INST =
		'https://wa.me/553591481514?text=' +
		encodeURIComponent('Olá! Tenho interesse no plano Institucional do PreceptorFISIC.');

	// Funil da LP: /assinatura?plan=pro_mensal já cai no passo de confirmar.
	const PLAN_KEYS = ['essencial_mensal', 'essencial_anual', 'pro_mensal', 'pro_anual'];
	const planParam = page.url.searchParams.get('plan');
	const preselected = planParam && PLAN_KEYS.includes(planParam) ? planParam : null;

	let annual = $state(preselected?.endsWith('_anual') ?? false);
	let step = $state<'planos' | 'confirm'>(preselected ? 'confirm' : 'planos');
	let chosenBase = $state<'essencial' | 'pro' | null>(
		preselected ? (preselected.split('_')[0] as 'essencial' | 'pro') : null
	);
	let cpf = $state('');
	let submitting = $state(false);

	const chosen = $derived(PLANS.find((p) => p.base === chosenBase) ?? null);
	const chosenKey = $derived(chosenBase ? `${chosenBase}_${annual ? 'anual' : 'mensal'}` : '');

	function escolher(base: 'essencial' | 'pro') {
		chosenBase = base;
		step = 'confirm';
	}

	function fmtDate(d: Date | string | null) {
		if (!d) return null;
		return new Date(d).toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Assinatura · PreceptorFISIC</title>
</svelte:head>

<div class="pay">
	<header class="topbar">
		<div class="brand">
			<BrandMark size={28} />
			<div class="nm">Preceptor<b>FISIC</b></div>
		</div>
		{#if ativo}
			<a class="topbar-link" href="/dashboard">Voltar ao app →</a>
		{:else}
			<a class="topbar-link" href="/logout">Sair</a>
		{/if}
	</header>

	<div class="wrap">
		{#if !data.billingEnabled}
			<div class="head">
				<div class="eyebrow">◆ Assinatura</div>
				<h1>Pagamentos indisponíveis no momento.</h1>
				<p class="sub">Estamos ajustando o sistema de cobrança. Tente de novo em alguns minutos.</p>
			</div>
		{:else if ativo}
			<!-- Assinante ativo: status + oferta do ebook -->
			<div class="head">
				<div class="eyebrow">◆ Assinatura</div>
				<h1>Sua assinatura está ativa.</h1>
				<p class="sub">
					{#if prof.subscriptionPlan}
						Plano {prof.subscriptionPlan.charAt(0).toUpperCase() + prof.subscriptionPlan.slice(1)}.
					{/if}
					{#if prof.subscriptionExpiresAt}
						Válida até {fmtDate(prof.subscriptionExpiresAt)}.
					{/if}
				</p>
			</div>

			<div class="ebook">
				<div class="ebook-eyebrow">◆ Oferta para assinantes</div>
				<div class="ebook-title">
					Ebook · Recomendações ACSM para população geral e populações especiais
				</div>
				<p class="ebook-desc">
					O material de referência que fundamenta o PreceptorFISIC, organizado para consulta rápida
					na prescrição do dia a dia.
				</p>
				<div class="ebook-price">
					<span class="was">R$ 100,00</span>
					<span class="now">R$ 29,90</span>
				</div>
				<a
					class="btn btn-primary"
					href="https://www.asaas.com/c/mtnzj35g4ckbbukf"
					target="_blank"
					rel="noopener"
				>
					Quero o ebook por R$ 29,90 →
				</a>
				<p class="ebook-note">
					<strong>Como funciona a entrega:</strong> após o pagamento, o time libera seu acesso ao
					ebook no Google Drive no e-mail da sua conta. Pagou e quer agilizar?
					<a
						href={'https://wa.me/553591481514?text=' +
							encodeURIComponent(
								`Olá! Acabei de comprar o Ebook ACSM pelo PreceptorFISIC. Sou ${prof.name} e meu e-mail de acesso é ${prof.email}. Pode liberar meu acesso no Drive?`
							)}
						target="_blank"
						rel="noopener">Chame no WhatsApp com o comprovante →</a
					>
				</p>
			</div>
		{:else if step === 'confirm' && chosen}
			<!-- Passo 2: confirmar plano + CPF só aqui -->
			<div class="head">
				<div class="eyebrow">◆ Confirmar assinatura</div>
				<h1>Você escolheu o {chosen.name}.</h1>
				<p class="sub">Confirme abaixo. A liberação é na hora em que o pagamento confirma.</p>
			</div>

			<form
				method="POST"
				action="?/subscribe"
				class="confirm-card"
				use:enhance={() => {
					submitting = true;
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'redirect') {
							window.location.href = result.location;
							return;
						}
						if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Não foi possível assinar.'));
							return;
						}
						if (result.type === 'success') {
							toast.success('Assinatura criada! A fatura chega no seu e-mail em instantes.');
						}
					};
				}}
			>
				<input type="hidden" name="plan" value={chosenKey} />
				<input type="hidden" name="cpf" value={cpf} />

				<div class="resumo">
					<div>
						<div class="resumo-plano">{chosen.name} · {annual ? 'anual' : 'mensal'}</div>
						{#if annual}
							<div class="resumo-obs">2 meses grátis no plano anual</div>
						{/if}
					</div>
					<div class="resumo-preco">
						{annual ? chosen.yearly : chosen.monthly}<span>{annual ? '/ano' : '/mês'}</span>
					</div>
				</div>

				{#if needsCpf}
					<div class="cpf-field">
						<label for="cpf">CPF ou CNPJ</label>
						<input
							id="cpf"
							bind:value={cpf}
							placeholder="000.000.000-00"
							inputmode="numeric"
							autocomplete="off"
						/>
						<div class="note">Exigido pelo Asaas para emitir a cobrança.</div>
					</div>
				{/if}

				<button class="btn btn-primary lg" type="submit" disabled={submitting}>
					{submitting ? 'Gerando cobrança…' : 'Confirmar assinatura'}
				</button>
				<button class="voltar" type="button" onclick={() => (step = 'planos')}>
					← Escolher outro plano
				</button>
			</form>

			<p class="trust">
				Você será levado à fatura segura do Asaas. Nenhum dado de cartão passa pelos nossos
				servidores.
			</p>
		{:else}
			<!-- Passo 1: escolher o plano -->
			<div class="head">
				<div class="eyebrow">◆ Assinatura</div>
				{#if data.situacao === 'expirado'}
					<h1>Seu acesso terminou.</h1>
					<p class="sub">
						Escolha um plano para voltar. Seus alunos e planos continuam salvos e voltam assim que a
						assinatura confirmar.
					</p>
				{:else}
					<h1>Falta um passo pra começar.</h1>
					<p class="sub">Escolha seu plano. A liberação é na hora em que o pagamento confirma.</p>
				{/if}
			</div>

			<div class="toggle">
				<button class:on={!annual} onclick={() => (annual = false)}>Mensal</button>
				<button class:on={annual} onclick={() => (annual = true)}>
					Anual <span class="tag">2 meses grátis</span>
				</button>
			</div>

			<div class="grid">
				{#each PLANS as p (p.base)}
					<div class="card" class:pop={p.pop}>
						{#if p.pop}<div class="badge">Mais popular</div>{/if}
						<h2>{p.name}</h2>
						<div class="price">
							<span class="num">{annual ? p.yearly : p.monthly}</span>
							<span class="per">{annual ? '/ano' : '/mês'}</span>
						</div>
						<p class="desc">{p.desc}</p>
						<ul>
							{#each p.items as it (it)}<li>{it}</li>{/each}
						</ul>
						<button class="btn {p.pop ? 'btn-primary' : 'btn-ghost'}" onclick={() => escolher(p.base)}>
							Assinar {p.name}
						</button>
					</div>
				{/each}

				<div class="card">
					<h2>Institucional</h2>
					<div class="price">
						<span class="num">R$ 499,90</span><span class="per">a partir de · /mês</span>
					</div>
					<p class="desc">Para clínicas, academias e equipes.</p>
					<ul>
						<li>Múltiplos profissionais</li>
						<li>Onboarding dedicado</li>
						<li>Contrato e faturamento</li>
					</ul>
					<a class="btn btn-ghost" href={WA_INST} target="_blank" rel="noopener noreferrer">
						Falar com o time
					</a>
				</div>
			</div>

			<p class="trust">Pix ou cartão · Ativação automática · Pagamento seguro pelo Asaas</p>
		{/if}
	</div>
</div>

<style>
	/* Tela de assinatura focada: fora do app (sem barras), dark comercial fixo,
	   igual à LP de preços. Paleta local pra não seguir o tema claro do app. */
	.pay {
		--bg-0: #050505;
		--bg-1: #0a0a0a;
		--bg-2: #121212;
		--ink-0: #fafafa;
		--ink-1: #b8b8b8;
		--ink-2: #7a7a7a;
		--ink-3: #4d4d4d;
		--line: #2a2a2a;
		--accent: #a78bfa;
		--accent-2: #c4b5fd;
		--accent-dim: #6d5fa3;
		--accent-wash: rgba(167, 139, 250, 0.08);
		--sans: 'Geist Sans', system-ui, -apple-system, sans-serif;
		--mono: 'Geist Mono', ui-monospace, 'SF Mono', monospace;

		background: var(--bg-0);
		color: var(--ink-0);
		font-family: var(--sans);
		min-height: 100vh;
		padding: 0 20px 72px;
	}

	.topbar {
		max-width: 1040px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 22px 0;
		border-bottom: 1px solid var(--line);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 11px;
	}
	.brand .nm {
		font: 600 15px var(--sans);
		letter-spacing: -0.01em;
	}
	.brand .nm b {
		font-weight: 700;
	}
	.topbar-link {
		font: 500 13px var(--sans);
		color: var(--ink-2);
		text-decoration: none;
	}
	.topbar-link:hover {
		color: var(--ink-0);
	}

	.wrap {
		max-width: 1040px;
		margin: 0 auto;
	}

	.head {
		text-align: center;
		padding: 52px 0 28px;
	}
	.eyebrow {
		font: 500 11px var(--mono);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: var(--accent);
		margin-bottom: 14px;
	}
	.head h1 {
		font: 600 34px/1.1 var(--sans);
		letter-spacing: -0.025em;
		margin: 0 0 12px;
		text-wrap: balance;
		color: var(--ink-0);
	}
	.sub {
		font: 400 16px/1.55 var(--sans);
		color: var(--ink-1);
		margin: 0 auto;
		max-width: 470px;
	}

	.toggle {
		display: flex;
		width: fit-content;
		gap: 4px;
		padding: 4px;
		margin: 0 auto 34px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 999px;
	}
	.toggle button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 20px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--ink-2);
		font: 500 13.5px var(--sans);
		cursor: pointer;
	}
	.toggle button.on {
		background: var(--accent);
		color: #0a0a12;
	}
	.tag {
		font: 600 10px var(--mono);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--accent-wash);
		color: var(--accent);
	}
	.toggle button.on .tag {
		background: rgba(10, 10, 18, 0.18);
		color: #0a0a12;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		align-items: stretch;
	}
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 26px 22px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 16px;
	}
	.card.pop {
		border-color: rgba(167, 139, 250, 0.5);
		background: rgba(167, 139, 250, 0.05);
	}
	.badge {
		position: absolute;
		top: -11px;
		left: 22px;
		padding: 3px 10px;
		background: linear-gradient(180deg, var(--accent), var(--accent-dim));
		color: #0a0a12;
		border-radius: 999px;
		font: 600 10px var(--mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.card h2 {
		font: 500 18px var(--sans);
		margin: 0 0 8px;
		color: var(--ink-0);
	}
	.price {
		display: flex;
		align-items: baseline;
		gap: 5px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}
	.price .num {
		font: 600 27px var(--mono);
		letter-spacing: -0.02em;
		color: var(--ink-0);
	}
	.price .per {
		font: 500 11px var(--mono);
		color: var(--ink-3);
		text-transform: uppercase;
	}
	.desc {
		font: 400 13.5px/1.5 var(--sans);
		color: var(--ink-1);
		margin: 0 0 16px;
	}
	.card ul {
		list-style: none;
		margin: 0 0 20px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 9px;
		flex: 1;
	}
	.card li {
		font: 400 13.5px var(--sans);
		color: var(--ink-1);
		display: flex;
		gap: 9px;
	}
	.card li::before {
		content: '✓';
		color: var(--accent);
		font-weight: 700;
	}

	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 46px;
		border-radius: 10px;
		font: 600 14px var(--sans);
		text-decoration: none;
		cursor: pointer;
		border: none;
		width: 100%;
		box-sizing: border-box;
	}
	.btn.lg {
		height: 50px;
	}
	.btn-primary {
		background: var(--accent);
		color: #0a0a12;
		box-shadow:
			0 0 0 1px rgba(167, 139, 250, 0.35),
			0 0 22px rgba(167, 139, 250, 0.2);
	}
	.btn-primary:hover {
		filter: brightness(1.05);
	}
	.btn-ghost {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--ink-0);
	}
	.btn-ghost:hover {
		border-color: var(--ink-2);
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.trust {
		text-align: center;
		margin-top: 30px;
		font: 400 12.5px var(--mono);
		color: var(--ink-3);
		letter-spacing: 0.02em;
	}

	/* Passo de confirmação */
	.confirm-card {
		max-width: 440px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 16px;
	}
	.resumo {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}
	.resumo-plano {
		font: 600 16px var(--sans);
		color: var(--ink-0);
	}
	.resumo-obs {
		font: 500 11.5px var(--mono);
		color: var(--accent);
		margin-top: 3px;
	}
	.resumo-preco {
		font: 600 22px var(--mono);
		color: var(--ink-0);
		white-space: nowrap;
	}
	.resumo-preco span {
		font: 500 11px var(--mono);
		color: var(--ink-3);
		text-transform: uppercase;
	}
	.cpf-field label {
		display: block;
		font: 500 11px var(--mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
		margin-bottom: 7px;
	}
	.cpf-field input {
		width: 100%;
		box-sizing: border-box;
		height: 46px;
		padding: 0 14px;
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: 10px;
		color: var(--ink-0);
		font: 400 15px var(--mono);
		outline: none;
	}
	.cpf-field input:focus {
		border-color: var(--accent);
	}
	.cpf-field .note {
		font: 400 11.5px var(--sans);
		color: var(--ink-3);
		margin-top: 6px;
	}
	.voltar {
		all: unset;
		text-align: center;
		cursor: pointer;
		font: 500 13px var(--sans);
		color: var(--ink-2);
	}
	.voltar:hover {
		color: var(--ink-0);
	}

	/* Ebook (assinante ativo) */
	.ebook {
		max-width: 620px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 24px;
		background: rgba(167, 139, 250, 0.05);
		border: 1px solid rgba(167, 139, 250, 0.4);
		border-radius: 16px;
	}
	.ebook-eyebrow {
		font: 500 11px var(--mono);
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.ebook-title {
		font: 600 18px var(--sans);
		color: var(--ink-0);
	}
	.ebook-desc {
		font: 400 13.5px/1.5 var(--sans);
		color: var(--ink-1);
		margin: 0;
	}
	.ebook-price {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 4px 0;
	}
	.ebook-price .was {
		font: 500 14px var(--mono);
		color: var(--ink-3);
		text-decoration: line-through;
	}
	.ebook-price .now {
		font: 600 24px var(--mono);
		color: var(--accent);
	}
	.ebook-note {
		font: 400 13px/1.5 var(--sans);
		color: var(--ink-2);
		margin: 8px 0 0;
	}
	.ebook-note strong {
		color: var(--ink-0);
	}
	.ebook a {
		color: var(--accent);
	}

	@media (max-width: 820px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.head h1 {
			font-size: 28px;
		}
	}
</style>

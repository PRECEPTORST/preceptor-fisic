<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let mode = $state<'login' | 'signup'>('login');
	let email = $state(form?.email ?? 'matheus@studio.fit');
	let pass = $state('');
	let name = $state('');
	let cref = $state('');
	let focused = $state<string | null>(null);
	let submitting = $state(false);

	const stats = [
		{ num: '2.4k', lbl: 'profissionais ativos' },
		{ num: '180k', lbl: 'planos prescritos' },
		{ num: '94%', lbl: 'aderência média' }
	];

	function fieldStyle(key: string) {
		const isFocused = focused === key;
		return `width:100%;height:44px;box-sizing:border-box;background:var(--bg-2);border:1px solid ${isFocused ? 'var(--accent)' : 'var(--ink-line-2)'};border-radius:var(--r-2);padding:0 14px;font:400 14px var(--font-sans);color:var(--ink-0);outline:none;transition:all 140ms var(--ease);${isFocused ? 'box-shadow:0 0 0 3px var(--accent-wash)' : ''}`;
	}
</script>

<div class="login-grid">
	<!-- Esquerda — marca + ambient -->
	<div class="login-left">
		<div class="login-glow login-glow--top"></div>
		<div class="login-glow login-glow--bottom"></div>

		<div style="display:flex;align-items:center;gap:12px;position:relative">
			<div class="login-logo">P</div>
			<div style="font:600 18px var(--font-sans);letter-spacing:-0.02em">Preceptor Fisic</div>
		</div>

		<div style="flex:1;display:flex;align-items:center;position:relative">
			<div style="max-width:460px">
				<div class="eyebrow" style="margin-bottom:18px">◆ Plataforma para profissionais</div>
				<h1 style="font:500 56px/1.05 var(--font-sans);margin:0;letter-spacing:-0.03em;color:var(--ink-0)">
					Prescreva treinos<br />com<span style="color:var(--accent)"> rigor clínico</span>.
				</h1>
				<p style="font:400 16px/1.5 var(--font-sans);color:var(--ink-1);margin-top:24px;max-width:420px">
					Plataforma para personal trainers, fisioterapeutas e clínicas que prescrevem exercícios para populações especiais.
				</p>

				<div style="margin-top:36px;display:flex;flex-direction:column;gap:14px">
					{#each stats as s, i (s.lbl)}
						<div
							style="display:flex;align-items:baseline;gap:14px;padding:12px 0;{i ? 'border-top:1px solid var(--ink-line)' : ''}"
						>
							<span class="num" style="font:var(--num-md);color:var(--ink-0);min-width:80px">{s.num}</span>
							<span style="font:var(--label-mono);color:var(--ink-2)">{s.lbl}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="eyebrow" style="position:relative">v3.2.1 · São Paulo · CONFEF parceiro</div>
	</div>

	<!-- Direita — formulário -->
	<div class="login-right">
		<div style="width:100%;max-width:380px">
			<div class="login-tabs">
				<button class:on={mode === 'login'} onclick={() => (mode = 'login')}>Entrar</button>
				<button class:on={mode === 'signup'} onclick={() => (mode = 'signup')}>Criar conta</button>
			</div>

			<h2 style="font:500 28px var(--font-sans);letter-spacing:-0.02em;margin:0 0 8px">
				{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
			</h2>
			<p style="font:var(--body);color:var(--ink-2);margin:0 0 28px">
				{mode === 'login' ? 'Acesse sua área de profissional' : 'Comece grátis · 14 dias'}
			</p>

			<form
				method="POST"
				action="?/{mode}"
				style="display:flex;flex-direction:column;gap:14px"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				{#if mode === 'signup'}
					<div>
						<div class="eyebrow" style="margin-bottom:6px">Nome completo</div>
						<input
							name="name"
							type="text"
							bind:value={name}
							placeholder="Matheus Castro"
							onfocus={() => (focused = 'name')}
							onblur={() => (focused = null)}
							style={fieldStyle('name')}
						/>
					</div>
				{/if}
				<div>
					<div class="eyebrow" style="margin-bottom:6px">E-mail profissional</div>
					<input
						name="email"
						type="email"
						bind:value={email}
						onfocus={() => (focused = 'email')}
						onblur={() => (focused = null)}
						style={fieldStyle('email')}
					/>
				</div>
				{#if mode === 'signup'}
					<div>
						<div class="eyebrow" style="margin-bottom:6px">Registro profissional</div>
						<input
							name="cref"
							type="text"
							bind:value={cref}
							placeholder="CREF 123456-G · CREFITO 0000"
							onfocus={() => (focused = 'cref')}
							onblur={() => (focused = null)}
							style={fieldStyle('cref')}
						/>
						<div style="font:var(--label-mono);color:var(--ink-3);margin-top:6px">CREF, CREFITO ou CRM</div>
					</div>
				{/if}
				<div>
					<div class="eyebrow" style="margin-bottom:6px">Senha</div>
					<input
						name="password"
						type="password"
						bind:value={pass}
						onfocus={() => (focused = 'pass')}
						onblur={() => (focused = null)}
						style={fieldStyle('pass')}
					/>
				</div>

				{#if form?.error}
					<div
						style="padding:10px 12px;border-radius:var(--r-2);background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger);font:var(--body-sm)"
					>{form.error}</div>
				{/if}

				{#if mode === 'login'}
					<div style="margin-top:-2px;text-align:right">
						<a href="/recuperar" style="font:500 13px var(--font-sans);color:var(--accent-2);text-decoration:none">Esqueci minha senha</a>
					</div>
				{/if}

				<Button size="lg" type="submit" disabled={submitting} style="width:100%;justify-content:center;margin-top:10px">
					{#if submitting}
						{mode === 'login' ? 'Entrando…' : 'Criando…'}
					{:else}
						{mode === 'login' ? 'Entrar →' : 'Criar conta grátis →'}
					{/if}
				</Button>
			</form>

			<div style="display:flex;align-items:center;gap:12px;margin:28px 0">
				<div style="flex:1;height:1px;background:var(--ink-line)"></div>
				<span class="eyebrow">OU</span>
				<div style="flex:1;height:1px;background:var(--ink-line)"></div>
			</div>

			<div style="display:flex;flex-direction:column;gap:10px">
				<Button variant="secondary" size="lg" style="width:100%;justify-content:center">Continuar com Google</Button>
				<Button variant="secondary" size="lg" style="width:100%;justify-content:center">Continuar com Apple</Button>
			</div>

			<div class="login-trust">
				<span style="color:var(--accent)">◆</span>
				<span style="font:var(--body-sm);color:var(--ink-1)">Validado pelo CONFEF · Conformidade LGPD</span>
			</div>
		</div>
	</div>
</div>

<style>
	.login-grid {
		width: 100%;
		height: 100vh;
		background: var(--bg-0);
		display: grid;
		grid-template-columns: 1fr 1fr;
		overflow: hidden;
	}
	.login-left {
		position: relative;
		overflow: hidden;
		background: linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%);
		padding: 48px 56px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--ink-line);
	}
	.login-glow {
		position: absolute;
		pointer-events: none;
	}
	.login-glow--top {
		top: -100px;
		left: -100px;
		width: 480px;
		height: 480px;
		background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
	}
	.login-glow--bottom {
		bottom: -120px;
		right: -80px;
		width: 380px;
		height: 380px;
		background: radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, transparent 70%);
	}
	.login-logo {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: linear-gradient(135deg, var(--accent), var(--accent-dim));
		display: flex;
		align-items: center;
		justify-content: center;
		font: 700 18px var(--font-sans);
		color: #0a0a0a;
		box-shadow: var(--glow-accent);
	}
	.login-right {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px;
		background: var(--bg-0);
	}
	.login-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: var(--r-2);
		background: var(--bg-2);
		border: 1px solid var(--ink-line);
		margin-bottom: 32px;
	}
	.login-tabs button {
		flex: 1;
		height: 36px;
		border: 0;
		cursor: pointer;
		border-radius: var(--r-1);
		background: transparent;
		color: var(--ink-2);
		font: 500 13px var(--font-sans);
		transition: all 140ms var(--ease);
	}
	.login-tabs button.on {
		background: var(--bg-4);
		color: var(--ink-0);
	}
	.login-trust {
		margin-top: 28px;
		padding: 12px;
		border-radius: var(--r-2);
		background: var(--bg-2);
		border: 1px solid var(--ink-line);
		display: flex;
		align-items: center;
		gap: 10px;
	}

	@media (max-width: 900px) {
		.login-grid {
			grid-template-columns: 1fr;
		}
		.login-left {
			display: none;
		}
	}
</style>

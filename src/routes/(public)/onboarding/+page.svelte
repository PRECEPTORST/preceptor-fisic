<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let name = $state(data.suggestedName ?? '');
	let cref = $state('');
	let specialty = $state<
		| 'prescricao_clinica'
		| 'treinamento_funcional'
		| 'reabilitacao'
		| 'musculacao'
		| 'personal'
		| 'pilates'
		| 'outro'
	>('prescricao_clinica');
	let submitting = $state(false);

	const SPECIALTIES = [
		{ id: 'prescricao_clinica', label: 'Prescrição clínica' },
		{ id: 'treinamento_funcional', label: 'Treinamento funcional' },
		{ id: 'reabilitacao', label: 'Reabilitação' },
		{ id: 'musculacao', label: 'Musculação' },
		{ id: 'personal', label: 'Personal' },
		{ id: 'pilates', label: 'Pilates' },
		{ id: 'outro', label: 'Outro' }
	] as const;
</script>

<div class="onb-shell">
	<div class="onb-glow"></div>

	<div class="onb-frame">
		<header class="brand">
			<div class="logo">P</div>
			<div>
				<div class="brand-name">Preceptor Fisic</div>
				<div class="brand-sub">PRO · v3.2</div>
			</div>
		</header>

		<div style="margin-bottom:32px">
			<Eyebrow>◆ Configuração inicial</Eyebrow>
			<h1 style="font:500 32px var(--font-sans);margin:8px 0 6px;letter-spacing:-0.025em">
				Bem-vindo ao Preceptor Fisic.
			</h1>
			<p style="font:var(--body);color:var(--ink-2);max-width:440px;line-height:1.55;margin:0">
				Vamos configurar seu perfil profissional em 30 segundos pra você começar a prescrever.
			</p>
		</div>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#if form?.error}
				<div
					style="padding:12px 16px;margin-bottom:16px;border-radius:var(--r-2);background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger);font:var(--body-sm)"
				>{form.error}</div>
			{/if}

			<div style="margin-bottom:18px">
				<label class="lbl">E-mail (vinculado à sua conta)</label>
				<input class="inp" disabled value={data.email} />
			</div>

			<div style="margin-bottom:18px">
				<label class="lbl">Nome completo *</label>
				<input
					class="inp"
					name="name"
					bind:value={name}
					required
					placeholder="Matheus da Cunha Castro"
					autofocus
				/>
				<div class="hint">Aparece pros seus alunos</div>
			</div>

			<div style="margin-bottom:18px">
				<label class="lbl">Registro profissional</label>
				<input class="inp" name="cref" bind:value={cref} placeholder="CREF 123456-G/SP" />
				<div class="hint">CREF, CREFITO ou CRM — pode preencher depois em Configurações</div>
			</div>

			<div style="margin-bottom:24px">
				<label class="lbl">Especialidade principal</label>
				<div class="spec-grid">
					{#each SPECIALTIES as s (s.id)}
						{@const on = specialty === s.id}
						<button
							type="button"
							onclick={() => (specialty = s.id as typeof specialty)}
							class="spec-btn"
							class:on
						>{on ? '✓ ' : ''}{s.label}</button>
					{/each}
				</div>
				<input type="hidden" name="specialty" value={specialty} />
			</div>

			<Button type="submit" size="lg" disabled={submitting} style="width:100%;justify-content:center">
				{submitting ? 'Configurando…' : 'Concluir e entrar →'}
			</Button>

			<div style="margin-top:18px;text-align:center;font:var(--label-mono);color:var(--ink-3)">
				CONFORMIDADE LGPD · DADOS NA REGIÃO BR · SA-EAST-1
			</div>
		</form>
	</div>
</div>

<style>
	.onb-shell {
		min-height: 100vh;
		background: var(--bg-0);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		position: relative;
		overflow: hidden;
	}
	.onb-glow {
		position: absolute;
		top: -200px;
		left: 50%;
		transform: translateX(-50%);
		width: 700px;
		height: 700px;
		background: radial-gradient(circle, var(--accent-glow) 0%, transparent 65%);
		pointer-events: none;
	}
	.onb-frame {
		width: 100%;
		max-width: 560px;
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-3);
		padding: 40px 36px;
		position: relative;
		box-shadow: var(--shadow-pop);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 28px;
	}
	.logo {
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
	.brand-name {
		font: 600 16px var(--font-sans);
		letter-spacing: -0.015em;
	}
	.brand-sub {
		font: 500 9.5px var(--font-mono);
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-top: 2px;
	}
	.lbl {
		display: block;
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
		margin-bottom: 6px;
	}
	.hint {
		font: var(--label-mono);
		color: var(--ink-3);
		margin-top: 6px;
	}
	.inp {
		width: 100%;
		box-sizing: border-box;
		height: 44px;
		padding: 0 14px;
		background: var(--bg-2);
		border: 1px solid var(--ink-line-2);
		border-radius: var(--r-2);
		color: var(--ink-0);
		font: 400 14px var(--font-sans);
		outline: none;
		transition: all 140ms var(--ease);
	}
	.inp:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-wash);
	}
	.inp:disabled {
		opacity: 0.6;
	}
	.spec-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.spec-btn {
		all: unset;
		cursor: pointer;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-3);
		color: var(--ink-1);
		border: 1px solid var(--ink-line-2);
		border-radius: var(--r-2);
		font: 500 13px var(--font-sans);
		transition: all 140ms var(--ease);
	}
	.spec-btn.on {
		background: var(--accent-wash);
		color: var(--accent-2);
		border-color: var(--accent);
	}
</style>

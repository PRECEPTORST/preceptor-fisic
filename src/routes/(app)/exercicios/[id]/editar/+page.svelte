<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const ex = $derived(data.exercise);

	const GROUPS = ['Membros inferiores', 'Posterior', 'Peito', 'Costas', 'Ombros', 'Braços', 'Core', 'Mobilidade', 'Cardio'];
	const EQUIPS = ['Barra', 'Halter', 'Máquina', 'Polia', 'Peso corporal', 'Solo', 'Kettlebell', 'TRX', 'Esteira', 'Bike'];
	const LEVELS = ['iniciante', 'intermediario', 'avancado'];
	const PATTERNS = ['Squat', 'Hinge', 'Push', 'Pull', 'Lunge', 'Carry', 'Rotation', 'Anti-ext', 'Anti-rot', 'Isolado', 'Mob'];

	let muscleGroup = $state(ex.muscleGroup);
	let equipment = $state(ex.equipment ?? '');
	let level = $state(ex.level ?? '');
	let pattern = $state(ex.pattern ?? '');
	let submitting = $state(false);
	let confirmingDelete = $state(false);

	const initialContra = ((ex.contraindications as string[] | null) ?? []).join(', ');
</script>

<svelte:head>
	<title>Editar exercício · PreceptorFISIC</title>
</svelte:head>

<div style="flex:1;overflow-y:auto;background:var(--bg-0)">
	<header
		style="display:flex;align-items:center;gap:16px;padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);position:sticky;top:0;z-index:10"
	>
		<button
			onclick={() => goto('/exercicios/meus')}
			style="background:var(--bg-3);border:1px solid var(--ink-line-2);cursor:pointer;width:36px;height:36px;border-radius:var(--r-1);color:var(--ink-1);font-size:18px"
		>←</button>
		<div style="flex:1">
			<Eyebrow>Editar exercício</Eyebrow>
			<h1 style="margin:4px 0 0;font:600 22px var(--font-sans);letter-spacing:-0.015em">{ex.name}</h1>
		</div>
	</header>

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
		style="padding:32px;max-width:780px;margin:0 auto"
	>
		{#if form?.error}
			<div
				style="padding:12px 16px;margin-bottom:20px;border-radius:var(--r-2);background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger);font:var(--body-sm)"
			>{form.error}</div>
		{/if}

		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Identidade</Eyebrow>
			<div style="display:grid;grid-template-columns:120px 1fr;gap:14px;margin-top:14px">
				<div>
					<label class="lbl">Código</label>
					<input class="inp" name="code" value={ex.code ?? ''} />
				</div>
				<div>
					<label class="lbl">Nome *</label>
					<input class="inp" name="name" required value={ex.name} />
				</div>
			</div>
		</div>

		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Classificação</Eyebrow>

			<div style="margin-top:14px">
				<label class="lbl">Grupo muscular *</label>
				<div style="display:flex;flex-wrap:wrap;gap:6px">
					{#each GROUPS as g (g)}
						<button
							type="button"
							onclick={() => (muscleGroup = g)}
							style="all:unset;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--r-pill);background:{muscleGroup ===
							g
								? 'var(--accent-wash)'
								: 'var(--bg-3)'};border:1px solid {muscleGroup === g
								? 'var(--accent)'
								: 'var(--ink-line-2)'};color:{muscleGroup === g
								? 'var(--accent-2)'
								: 'var(--ink-1)'};font:500 12px var(--font-sans);cursor:pointer"
						>{muscleGroup === g ? '✓' : '·'} {g}</button>
					{/each}
				</div>
				<input type="hidden" name="muscleGroup" value={muscleGroup} required />
			</div>

			<div style="margin-top:18px">
				<label class="lbl">Equipamento</label>
				<div style="display:flex;flex-wrap:wrap;gap:6px">
					{#each EQUIPS as e (e)}
						<button
							type="button"
							onclick={() => (equipment = equipment === e ? '' : e)}
							style="all:unset;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:var(--r-pill);background:{equipment ===
							e
								? 'var(--accent-wash)'
								: 'var(--bg-3)'};border:1px solid {equipment === e
								? 'var(--accent)'
								: 'var(--ink-line-2)'};color:{equipment === e
								? 'var(--accent-2)'
								: 'var(--ink-1)'};font:500 12px var(--font-sans);cursor:pointer"
						>{equipment === e ? '✓' : '+'} {e}</button>
					{/each}
				</div>
				<input type="hidden" name="equipment" value={equipment} />
			</div>

			<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px">
				<div>
					<label class="lbl">Padrão</label>
					<select class="inp" name="pattern" bind:value={pattern}>
						<option value="">—</option>
						{#each PATTERNS as p (p)}
							<option value={p}>{p}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="lbl">Nível</label>
					<select class="inp" name="level" bind:value={level}>
						<option value="">—</option>
						{#each LEVELS as l (l)}
							<option value={l}>{l}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<div class="card" style="padding:24px;margin-bottom:24px">
			<Eyebrow>Forma de execução</Eyebrow>
			<textarea
				class="inp"
				name="executionNotes"
				rows="4"
				style="margin-top:10px;min-height:90px;padding:12px;height:auto;line-height:1.5;resize:vertical"
				>{ex.executionNotes ?? ''}</textarea>

			<label class="lbl" style="margin-top:18px">Contraindicações (separe por vírgula)</label>
			<input class="inp" name="contraindications" value={initialContra} style="margin-top:6px" />
		</div>

		<div
			style="display:flex;justify-content:space-between;gap:8px;padding-top:16px;border-top:1px solid var(--ink-line)"
		>
			<Button variant="secondary" onclick={() => goto('/exercicios/meus')}>Cancelar</Button>
			<Button type="submit" disabled={submitting} size="lg">
				{submitting ? 'Salvando…' : 'Salvar alterações'}
			</Button>
		</div>
	</form>

	<div style="padding:0 32px 64px;max-width:780px;margin:0 auto">
		<div class="card" style="padding:20px;border:1px solid var(--danger-dim);background:var(--bg-2)">
			<div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
				<div>
					<div style="font:500 14px var(--font-sans);color:var(--danger);margin-bottom:4px">⚠ Excluir exercício</div>
					<div style="font:var(--body-sm);color:var(--ink-2)">Remove da sua biblioteca. Não pode ser desfeito.</div>
				</div>
				{#if !confirmingDelete}
					<Button variant="danger" onclick={() => (confirmingDelete = true)}>Excluir</Button>
				{:else}
					<form method="POST" action="?/delete" style="display:inline-flex;gap:6px">
						<Button variant="secondary" onclick={() => (confirmingDelete = false)}>Cancelar</Button>
						<Button variant="danger" type="submit">Confirmar exclusão</Button>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.lbl {
		display: block;
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
		margin-bottom: 8px;
	}
	.inp {
		width: 100%;
		box-sizing: border-box;
		height: 40px;
		padding: 0 12px;
		background: var(--bg-3);
		border: 1px solid var(--ink-line-2);
		border-radius: var(--r-2);
		color: var(--ink-0);
		font: 400 14px var(--font-sans);
		outline: none;
	}
	.inp:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-wash);
	}
</style>

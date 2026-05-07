<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const students = $derived(data.students);

	const today = new Date();
	let date = $state(today.toISOString().slice(0, 10));
	let time = $state('09:00');
	let studentId = $state('');
	let type = $state<'treino' | 'avaliacao' | 'reabilitacao' | 'consulta'>('treino');
	let duration = $state(60);
	let label = $state('');
	let notes = $state('');
	let submitting = $state(false);

	const TYPES = [
		{ id: 'treino', label: 'Treino', color: 'var(--accent)' },
		{ id: 'avaliacao', label: 'Avaliação', color: 'var(--info)' },
		{ id: 'reabilitacao', label: 'Reabilitação', color: 'var(--warn)' },
		{ id: 'consulta', label: 'Consulta', color: 'var(--ink-1)' }
	] as const;
</script>

<div style="flex:1;overflow-y:auto;background:var(--bg-0)">
	<header
		style="display:flex;align-items:center;gap:16px;padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);position:sticky;top:0;z-index:10"
	>
		<button
			onclick={() => goto('/agenda')}
			style="background:var(--bg-3);border:1px solid var(--ink-line-2);cursor:pointer;width:36px;height:36px;border-radius:var(--r-1);color:var(--ink-1);font-size:18px"
		>←</button>
		<div style="flex:1">
			<Eyebrow>Agenda</Eyebrow>
			<h1 style="margin:4px 0 0;font:600 22px var(--font-sans);letter-spacing:-0.015em">Nova sessão</h1>
		</div>
	</header>

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
		style="padding:32px;max-width:680px;margin:0 auto"
	>
		{#if form?.error}
			<div
				style="padding:12px 16px;margin-bottom:20px;border-radius:var(--r-2);background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger);font:var(--body-sm)"
			>{form.error}</div>
		{/if}

		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Tipo</Eyebrow>
			<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px">
				{#each TYPES as t (t.id)}
					{@const on = type === t.id}
					<button
						type="button"
						onclick={() => (type = t.id)}
						style="all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:var(--r-2);background:{on
							? 'var(--accent-wash)'
							: 'var(--bg-3)'};border:1px solid {on ? 'var(--accent)' : 'var(--ink-line-2)'};color:{on
							? 'var(--ink-0)'
							: 'var(--ink-1)'};font:500 13px var(--font-sans)"
					>
						<span style="width:8px;height:8px;border-radius:2px;background:{t.color}"></span>
						{t.label}
					</button>
				{/each}
			</div>
			<input type="hidden" name="type" value={type} />
		</div>

		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Quando</Eyebrow>
			<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px">
				<div>
					<label class="lbl">Data *</label>
					<input class="inp" name="date" type="date" required bind:value={date} />
				</div>
				<div>
					<label class="lbl">Horário *</label>
					<input class="inp" name="time" type="time" required bind:value={time} />
				</div>
				<div>
					<label class="lbl">Duração (min) *</label>
					<input class="inp" name="duration" type="number" min="15" max="240" step="15" required bind:value={duration} />
				</div>
			</div>
		</div>

		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Aluno</Eyebrow>
			<select class="inp" name="studentId" bind:value={studentId} style="margin-top:10px">
				<option value="">— Sem aluno (bloqueio interno)</option>
				{#each students as s (s.id)}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		</div>

		<div class="card" style="padding:24px;margin-bottom:24px">
			<Eyebrow>Detalhes</Eyebrow>
			<div style="margin-top:14px">
				<label class="lbl">Título / descrição (opcional)</label>
				<input
					class="inp"
					name="label"
					bind:value={label}
					placeholder={type === 'treino' ? 'Treino A · Push' : type === 'avaliacao' ? 'Bioimpedância' : 'Reabilitação · LCA'}
				/>
			</div>
			<div style="margin-top:14px">
				<label class="lbl">Notas (opcional)</label>
				<textarea
					class="inp"
					name="notes"
					rows="3"
					bind:value={notes}
					placeholder="Lembrete sobre o foco da sessão…"
					style="resize:vertical;min-height:60px;padding:10px 12px;height:auto;line-height:1.5"
				></textarea>
			</div>
		</div>

		<div
			style="display:flex;justify-content:space-between;gap:8px;padding-top:16px;border-top:1px solid var(--ink-line)"
		>
			<Button variant="secondary" onclick={() => goto('/agenda')}>Cancelar</Button>
			<Button type="submit" disabled={submitting} size="lg">
				{submitting ? 'Agendando…' : '✓ Agendar sessão'}
			</Button>
		</div>
	</form>
</div>

<style>
	.lbl {
		display: block;
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
		margin-bottom: 6px;
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
		font-variant-numeric: tabular-nums;
		outline: none;
		transition: border-color 140ms var(--ease);
	}
	.inp:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-wash);
	}
</style>

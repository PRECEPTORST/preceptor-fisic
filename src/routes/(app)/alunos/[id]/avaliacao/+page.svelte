<script lang="ts">
	import { Button, Eyebrow } from '$lib/components/ui';
	import NumField from '$lib/components/ui/num-field.svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const student = $derived(data.student);

	let weightKg = $state(student.weightKg ? String(student.weightKg) : '');
	let heightCm = $state(student.heightCm ? String(student.heightCm) : '');
	let bodyFatPct = $state('');
	let leanMassKg = $state('');
	let restingHr = $state('');
	let bpSys = $state('');
	let bpDia = $state('');
	let notes = $state('');
	let submitting = $state(false);

	const bmi = $derived.by(() => {
		const w = Number(weightKg);
		const h = Number(heightCm);
		if (!w || !h) return null;
		return (w / Math.pow(h / 100, 2)).toFixed(1);
	});
	const bmiCat = $derived(
		!bmi
			? '—'
			: Number(bmi) < 18.5
				? 'baixo peso'
				: Number(bmi) < 25
					? 'normal'
					: Number(bmi) < 30
						? 'sobrepeso'
						: 'obeso'
	);
	const bmiColor = $derived(
		!bmi
			? 'var(--ink-3)'
			: Number(bmi) < 18.5 || Number(bmi) >= 30
				? 'var(--danger)'
				: Number(bmi) >= 25
					? 'var(--warn)'
					: 'var(--success)'
	);
</script>

<svelte:head>
	<title>Avaliação física · PreceptorFISIC</title>
</svelte:head>

<div style="flex:1;overflow-y:auto;background:var(--bg-0)">
	<header
		style="display:flex;align-items:center;gap:16px;padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);position:sticky;top:0;z-index:10"
	>
		<button
			onclick={() => goto(`/alunos/${student.id}`)}
			style="background:var(--bg-3);border:1px solid var(--ink-line-2);cursor:pointer;width:36px;height:36px;border-radius:var(--r-1);color:var(--ink-1);font-size:18px"
		>←</button>
		<div style="flex:1">
			<Eyebrow>Avaliação física · {student.name}</Eyebrow>
			<h1 style="margin:4px 0 0;font:600 22px var(--font-sans);letter-spacing:-0.015em">Nova avaliação</h1>
		</div>
	</header>

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				// reset:false preserva o que foi digitado quando a action falha
				await update({ reset: false });
				submitting = false;
			};
		}}
		style="padding:32px;max-width:880px;margin:0 auto"
	>
		{#if form?.error}
			<div
				style="padding:12px 16px;margin-bottom:20px;border-radius:var(--r-2);background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger);font:var(--body-sm)"
			>{form.error}</div>
		{/if}

		<!-- Antropometria básica -->
		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Antropometria</Eyebrow>
			<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px">
				<NumField label="Peso" unit="kg" name="weightKg" bind:value={weightKg} />
				<NumField label="Altura" unit="cm" name="heightCm" bind:value={heightCm} />
				<div>
					<div class="eyebrow" style="margin-bottom:6px">IMC (calculado)</div>
					<div
						style="display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;background:var(--bg-3);border:1px solid var(--ink-line-2);border-radius:var(--r-2)"
					>
						<span class="num" style="font:500 16px var(--font-mono);color:{bmiColor}">{bmi ?? '—'}</span>
						<span style="font:var(--label-mono);color:var(--ink-2)">{bmiCat}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Composição corporal -->
		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Composição corporal (bioimpedância)</Eyebrow>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
				<NumField label="% Gordura" unit="%" name="bodyFatPct" bind:value={bodyFatPct} />
				<NumField label="Massa magra" unit="kg" name="leanMassKg" bind:value={leanMassKg} />
			</div>
		</div>

		<!-- Cardio -->
		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Cardiovascular</Eyebrow>
			<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px">
				<NumField label="FC repouso" unit="bpm" name="restingHr" inputmode="numeric" bind:value={restingHr} />
				<NumField label="PA sistólica" unit="mmHg" name="bpSys" inputmode="numeric" bind:value={bpSys} />
				<NumField label="PA diastólica" unit="mmHg" name="bpDia" inputmode="numeric" bind:value={bpDia} />
			</div>
		</div>

		<!-- Notas -->
		<div class="card" style="padding:24px;margin-bottom:24px">
			<Eyebrow>Observações clínicas</Eyebrow>
			<textarea
				name="notes"
				bind:value={notes}
				placeholder="Aluno apresenta boa progressão. Manter PPL com leve aumento de carga em puxada e supino."
				style="width:100%;box-sizing:border-box;min-height:90px;padding:12px;background:var(--bg-3);border:1px solid var(--ink-line-2);border-radius:var(--r-2);color:var(--ink-0);font:400 14px/1.5 var(--font-sans);outline:none;resize:vertical;margin-top:10px"
			></textarea>
		</div>

		<div
			style="display:flex;justify-content:space-between;gap:8px;padding-top:16px;border-top:1px solid var(--ink-line)"
		>
			<Button variant="secondary" onclick={() => goto(`/alunos/${student.id}`)}>Cancelar</Button>
			<Button type="submit" disabled={submitting} size="lg">
				{submitting ? 'Salvando…' : '✓ Salvar avaliação'}
			</Button>
		</div>
	</form>
</div>

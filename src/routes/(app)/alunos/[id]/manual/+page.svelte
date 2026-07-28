<script lang="ts">
	import { Button, Avatar, Eyebrow, toast } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

	const student = $derived(data.detail.student);

	// Frequência e duração puxam a preferência do aluno quando existe: é o
	// número que o profissional já combinou com ele, então começar por outro
	// valor só dá trabalho de corrigir.
	const prefs = $derived(data.detail.preferences);
	let sessions = $state(3);
	let minutes = $state(60);
	let weeks = $state(12);
	let objective = $state('');
	let focos = $state<string[]>([]);
	let salvando = $state(false);

	$effect(() => {
		const s = prefs?.weeklySessions;
		if (typeof s === 'number' && s >= 1 && s <= 7) sessions = s;
		const m = prefs?.minutesPerSession;
		if (typeof m === 'number' && m >= 20 && m <= 180) minutes = m;
	});

	// Uma caixa de foco por sessão. Cresce e encolhe junto com o número de
	// sessões, preservando o que já foi digitado.
	const camposFoco = $derived(
		Array.from({ length: sessions }, (_, i) => focos[i] ?? '')
	);
	const LETRAS = 'ABCDEFG';
</script>

<svelte:head>
	<title>Montar treino na mão · PreceptorFISIC</title>
</svelte:head>

<div style="flex:1;overflow-y:auto;background:var(--bg-0)">
	<header
		style="display:flex;align-items:center;justify-content:space-between;padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);position:sticky;top:0;z-index:10"
	>
		<div style="display:flex;align-items:center;gap:10px">
			<button
				onclick={() => goto(`/alunos/${student.id}`)}
				style="background:var(--bg-2);border:1px solid var(--ink-line-2);cursor:pointer;width:32px;height:32px;border-radius:8px;color:var(--ink-1)"
				>←</button
			>
			<div>
				<h1 style="margin:0;font:600 22px var(--font-sans);letter-spacing:-0.015em">
					Montar na mão
				</h1>
				<div style="font:var(--body-sm);color:var(--ink-2);margin-top:2px">
					Para {student.name}
				</div>
			</div>
		</div>
	</header>

	<div style="padding:32px;max-width:820px;margin:0 auto">
		<div class="card" style="padding:24px;margin-bottom:16px">
			<div style="display:flex;align-items:center;gap:14px">
				<Avatar name={student.name} size={56} />
				<div>
					<div style="font:500 18px var(--font-sans);color:var(--ink-0)">{student.name}</div>
					<div style="font:var(--body-sm);color:var(--ink-2);margin-top:3px">
						Você monta a estrutura aqui e escolhe os exercícios na tela seguinte.
					</div>
				</div>
			</div>
		</div>

		<form
			method="POST"
			action="?/criar"
			use:enhance={() => {
				salvando = true;
				return async ({ update, result }) => {
					salvando = false;
					if (result.type === 'error') {
						toast.error('Falha inesperada ao criar o plano. Tente de novo.');
						return;
					}
					await update();
				};
			}}
		>
			{#if form?.error}
				<div
					class="card"
					style="padding:14px 18px;margin-bottom:14px;background:var(--danger-dim);border:1px solid var(--danger);display:flex;align-items:flex-start;gap:10px"
				>
					<span style="color:var(--danger);font-size:18px;line-height:1">⚠</span>
					<div style="font:var(--body-sm);color:var(--ink-0);line-height:1.5">{form.error}</div>
				</div>
			{/if}

			<div class="card" style="padding:24px;margin-bottom:16px">
				<Eyebrow>Estrutura da semana</Eyebrow>
				<div style="font:var(--body-sm);color:var(--ink-2);margin-top:6px;line-height:1.5">
					Os dias da semana são distribuídos com descanso entre os treinos, igual à geração
					automática.
				</div>

				<div
					style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:18px"
				>
					<label style="display:block">
						<span
							style="display:block;font:var(--label-mono);color:var(--ink-2);margin-bottom:6px"
							>SESSÕES POR SEMANA</span
						>
						<input
							type="number"
							name="sessions"
							min="1"
							max="7"
							bind:value={sessions}
							style="width:100%;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2);padding:10px 14px;color:var(--ink-0);font:var(--body-sm)"
						/>
					</label>

					<label style="display:block">
						<span
							style="display:block;font:var(--label-mono);color:var(--ink-2);margin-bottom:6px"
							>MINUTOS POR SESSÃO</span
						>
						<input
							type="number"
							name="minutes"
							min="20"
							max="180"
							step="5"
							bind:value={minutes}
							style="width:100%;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2);padding:10px 14px;color:var(--ink-0);font:var(--body-sm)"
						/>
					</label>

					<label style="display:block">
						<span
							style="display:block;font:var(--label-mono);color:var(--ink-2);margin-bottom:6px"
							>DURAÇÃO DO PROGRAMA</span
						>
						<input
							type="number"
							name="weeks"
							min="1"
							max="104"
							bind:value={weeks}
							style="width:100%;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2);padding:10px 14px;color:var(--ink-0);font:var(--body-sm)"
						/>
						<span
							style="display:block;font:var(--body-sm);color:var(--ink-3);margin-top:5px"
							>em semanas</span
						>
					</label>
				</div>
			</div>

			<div class="card" style="padding:24px;margin-bottom:16px">
				<Eyebrow>Objetivo do programa</Eyebrow>
				<div style="font:var(--body-sm);color:var(--ink-2);margin-top:6px">
					Aparece na capa da prescrição. Pode deixar em branco e escrever depois.
				</div>
				<input
					name="objective"
					bind:value={objective}
					maxlength="800"
					placeholder="Ex: recuperar força de membros inferiores após artroplastia de joelho"
					style="width:100%;margin-top:12px;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2);padding:10px 14px;color:var(--ink-0);font:var(--body-sm)"
				/>
			</div>

			<div class="card" style="padding:24px;margin-bottom:16px">
				<Eyebrow>Foco de cada treino</Eyebrow>
				<div style="font:var(--body-sm);color:var(--ink-2);margin-top:6px">
					Vira o nome da sessão. Em branco, fica só "Treino A", "Treino B" e assim por diante.
				</div>
				<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
					{#each camposFoco as valor, i (i)}
						<div style="display:flex;align-items:center;gap:10px">
							<span
								style="flex-shrink:0;width:74px;font:var(--label-mono);color:var(--ink-2)"
								>TREINO {LETRAS[i] ?? i + 1}</span
							>
							<input
								name="focus"
								value={valor}
								oninput={(e) => (focos[i] = e.currentTarget.value)}
								maxlength="300"
								placeholder="Ex: membros inferiores e core"
								style="flex:1;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2);padding:10px 14px;color:var(--ink-0);font:var(--body-sm)"
							/>
						</div>
					{/each}
				</div>
			</div>

			<div
				class="card"
				style="padding:16px 18px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px"
			>
				<span style="color:var(--accent-2);font-size:16px;line-height:1.2">◆</span>
				<div style="font:var(--body-sm);color:var(--ink-1);line-height:1.5">
					Montar na mão não consome sua franquia de treinos por IA. A checagem clínica é a mesma:
					o plano passa pelas mesmas regras de segurança antes de ser publicado.
				</div>
			</div>

			<Button size="lg" type="submit" disabled={salvando} style="width:100%;justify-content:center">
				{salvando ? 'Criando…' : 'Criar e escolher exercícios →'}
			</Button>
		</form>
	</div>
</div>

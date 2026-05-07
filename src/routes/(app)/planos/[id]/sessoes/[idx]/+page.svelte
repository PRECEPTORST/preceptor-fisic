<script lang="ts">
	import { Button, Chip, Eyebrow } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const session = $derived(data.session);
	const planId = $derived(data.plan.id);
	const studentName = $derived(data.plan.studentName);
	const exercises = $derived(session.main ?? []);

	let activeEx = $state(0);
	const setLog: Record<number, number[]> = {
		1: [60, 60, 62, 62],
		2: [22, 22, 24],
		3: [14, 14, 14]
	};

	const ex = $derived(exercises[activeEx]);
	const log = $derived(setLog[activeEx + 1] ?? []);

	function intensityColorFromRPE(load: string | undefined) {
		if (!load) return 'var(--ink-2)';
		const m = load.match(/RPE\s*(\d+)/i);
		if (!m) return 'var(--info)';
		const v = Number(m[1]);
		return v >= 8 ? 'var(--danger)' : v >= 6 ? 'var(--warn)' : 'var(--success)';
	}
</script>

<div style="flex:1;display:flex;flex-direction:column;background:var(--bg-0);height:100vh;overflow:hidden">
	<div
		style="padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);display:flex;align-items:center;gap:16px;flex-shrink:0"
	>
		<button
			onclick={() => goto(`/planos/${planId}`)}
			style="background:var(--bg-3);border:1px solid var(--ink-line-2);cursor:pointer;width:36px;height:36px;border-radius:var(--r-1);color:var(--ink-1);font-size:18px"
		>←</button>
		<div style="flex:1">
			<div class="eyebrow" style="margin-bottom:4px">Sessão em andamento · {studentName}</div>
			<div style="font:500 18px var(--font-sans);color:var(--ink-0)">{session.label ?? `Sessão ${data.idx + 1}`}</div>
		</div>
		<div style="display:flex;align-items:center;gap:14px">
			<div style="text-align:right">
				<div class="eyebrow">Tempo</div>
				<div class="num" style="font:var(--num-md);color:var(--accent)">00:00</div>
			</div>
			<Button variant="secondary">⏸ Pausar</Button>
			<Button>✓ Finalizar</Button>
		</div>
	</div>

	{#if exercises.length === 0}
		<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink-2)">
			Sessão sem exercícios definidos.
		</div>
	{:else}
		<div style="display:grid;grid-template-columns:320px 1fr;flex:1;overflow:hidden">
			<!-- Sidebar lista de exercícios -->
			<div
				style="border-right:1px solid var(--ink-line);background:var(--bg-1);overflow-y:auto;padding:20px 0"
			>
				<div class="eyebrow" style="padding:0 20px 12px">Exercícios · {exercises.length} total</div>
				{#each exercises as exItem, i (exItem.name + i)}
					{@const done = i < activeEx}
					{@const active = i === activeEx}
					{@const completedSets = done ? (exItem.sets ?? 0) : active ? log.length : 0}
					<button
						type="button"
						onclick={() => (activeEx = i)}
						style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;padding:14px 20px;background:{active
							? 'var(--accent-wash)'
							: 'transparent'};border-left:3px solid {active
							? 'var(--accent)'
							: 'transparent'};display:grid;grid-template-columns:32px 1fr auto;gap:12px;align-items:center;transition:all 140ms var(--ease)"
					>
						<div
							style="width:28px;height:28px;border-radius:50%;background:{done
								? 'var(--success-dim)'
								: active
									? 'var(--accent)'
									: 'var(--bg-3)'};color:{done
								? 'var(--success)'
								: active
									? '#0a0a0a'
									: 'var(--ink-3)'};border:1px solid {done
								? 'var(--success)'
								: active
									? 'var(--accent)'
									: 'var(--ink-line-2)'};display:flex;align-items:center;justify-content:center;font:500 12px var(--font-mono)"
						>{done ? '✓' : i + 1}</div>
						<div style="min-width:0">
							<div
								style="font:500 13px var(--font-sans);color:{active
									? 'var(--ink-0)'
									: done
										? 'var(--ink-1)'
										: 'var(--ink-2)'};margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
							>{exItem.name}</div>
							<div style="font:var(--label-mono);color:var(--ink-3)">
								{exItem.sets ?? '—'}×{exItem.reps ?? '—'} · {exItem.rest_seconds ?? '—'}s
							</div>
						</div>
						<span class="num" style="font:var(--label-mono);color:var(--ink-2)">
							{completedSets}/{exItem.sets ?? '—'}
						</span>
					</button>
				{/each}
			</div>

			<!-- Detalhe do exercício ativo -->
			<div style="overflow-y:auto;padding:32px 40px 80px">
				{#if ex}
					<div style="max-width:720px;margin:0 auto">
						<div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:24px">
							<div
								style="width:72px;height:72px;border-radius:var(--r-2);background:var(--bg-2);border:1px solid var(--ink-line-2);display:flex;align-items:center;justify-content:center;color:var(--accent);font:300 28px var(--font-sans);flex-shrink:0"
							>{String(activeEx + 1).padStart(2, '0')}</div>
							<div style="flex:1">
								<div class="eyebrow" style="margin-bottom:6px">Exercício {activeEx + 1} de {exercises.length}</div>
								<h2 style="font:500 28px var(--font-sans);margin:0 0 8px;letter-spacing:-0.01em">{ex.name}</h2>
								<div style="display:flex;gap:14px;font:var(--body);color:var(--ink-2);flex-wrap:wrap">
									<span><span style="color:var(--ink-1)">{ex.sets ?? '—'}</span> séries</span>
									<span style="color:var(--ink-3)">·</span>
									<span><span style="color:var(--ink-1)">{ex.reps ?? '—'}</span> reps</span>
									<span style="color:var(--ink-3)">·</span>
									<span>↺ <span style="color:var(--ink-1)">{ex.rest_seconds ?? '—'}s</span> descanso</span>
									{#if ex.load_guidance}
										<span style="color:var(--ink-3)">·</span>
										<span style="color:{intensityColorFromRPE(ex.load_guidance)}">{ex.load_guidance}</span>
									{/if}
								</div>
								{#if ex.muscle_groups && ex.muscle_groups.length > 0}
									<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
										{#each ex.muscle_groups as g (g)}
											<Chip>{g}</Chip>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Vídeo placeholder -->
						<div
							style="height:240px;background:linear-gradient(135deg, var(--bg-2) 0%, var(--bg-1) 100%);border:1px solid var(--ink-line-2);border-radius:var(--r-3);display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:24px;overflow:hidden"
						>
							<div
								style="position:absolute;inset:0;background:radial-gradient(circle at 60% 40%, var(--accent-wash) 0%, transparent 60%)"
							></div>
							<div style="position:relative;text-align:center">
								<div
									style="width:64px;height:64px;border-radius:50%;background:var(--accent);box-shadow:var(--glow-accent);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#0a0a0a;font:400 24px var(--font-sans)"
								>▶</div>
								<div class="eyebrow">Vídeo · em breve</div>
							</div>
						</div>

						{#if ex.execution_notes}
							<div class="card" style="padding:20px;margin-bottom:16px">
								<div class="eyebrow" style="margin-bottom:8px">Forma de execução</div>
								<div style="font:var(--body);color:var(--ink-1);line-height:1.55">{ex.execution_notes}</div>
							</div>
						{/if}

						{#if ex.contraindications && ex.contraindications.length > 0}
							<div
								class="card"
								style="padding:18px;margin-bottom:16px;background:var(--warn-dim);border:1px solid var(--warn);border-left:4px solid var(--warn)"
							>
								<div class="eyebrow" style="color:var(--warn);margin-bottom:8px">⚠ Contraindicações</div>
								<ul style="margin:0;padding-left:20px;font:var(--body-sm);color:var(--ink-0);line-height:1.6">
									{#each ex.contraindications as c (c)}
										<li>{c}</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if ex.source_refs && ex.source_refs.length > 0}
							<div class="card" style="padding:18px;margin-bottom:24px">
								<div class="eyebrow" style="margin-bottom:8px">Evidência clínica</div>
								<div style="display:flex;flex-direction:column;gap:8px">
									{#each ex.source_refs as r, i (i)}
										<div style="font:var(--body-sm);color:var(--ink-1);line-height:1.5">
											<span style="font:var(--label-mono);color:var(--accent);text-transform:uppercase">▢ {r.type}</span>
											{#if r.note} · {r.note}{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Set logger -->
						<div class="card" style="padding:0;overflow:hidden">
							<div
								style="padding:14px 20px;background:var(--bg-1);border-bottom:1px solid var(--ink-line);display:flex;justify-content:space-between;align-items:center"
							>
								<div style="font:500 14px var(--font-sans);color:var(--ink-0)">Registro de séries</div>
								<span class="num" style="font:var(--label-mono);color:var(--ink-2)">
									{log.length}/{ex.sets ?? '—'} concluídas
								</span>
							</div>
							{#each Array(ex.sets ?? 0) as _, i (i)}
								{@const value = log[i]}
								{@const done = value != null}
								<div
									style="padding:14px 20px;{i ? 'border-top:1px solid var(--ink-line)' : ''};display:grid;grid-template-columns:40px 1fr 1fr 1fr 100px;gap:16px;align-items:center"
								>
									<div
										class="num"
										style="font:500 13px var(--font-mono);color:{done ? 'var(--success)' : 'var(--ink-3)'}"
									>{done ? '✓' : '○'} {i + 1}</div>
									<div>
										<div style="font:var(--label-mono);color:var(--ink-2);margin-bottom:4px">Carga</div>
										<div
											class="num"
											style="font:500 16px var(--font-mono);color:{done ? 'var(--ink-0)' : 'var(--ink-3)'}"
										>{done ? value : '—'} <span style="font:var(--label-mono);color:var(--ink-2)">kg</span></div>
									</div>
									<div>
										<div style="font:var(--label-mono);color:var(--ink-2);margin-bottom:4px">Reps</div>
										<div
											class="num"
											style="font:500 16px var(--font-mono);color:{done ? 'var(--ink-0)' : 'var(--ink-3)'}"
										>{done ? (i === 3 ? 8 : 10) : '—'}</div>
									</div>
									<div>
										<div style="font:var(--label-mono);color:var(--ink-2);margin-bottom:4px">RPE</div>
										<div
											class="num"
											style="font:500 16px var(--font-mono);color:{done ? 'var(--ink-0)' : 'var(--ink-3)'}"
										>{done ? 7 + i * 0.5 : '—'}</div>
									</div>
									<Button variant={done ? 'ghost' : 'primary'} size="sm">
										{done ? 'Editar' : 'Registrar'}
									</Button>
								</div>
							{/each}
						</div>

						<div style="display:flex;justify-content:space-between;margin-top:24px">
							<Button variant="secondary" onclick={() => (activeEx = Math.max(0, activeEx - 1))}>← Anterior</Button>
							<Button onclick={() => (activeEx = Math.min(exercises.length - 1, activeEx + 1))}
								>Próximo exercício →</Button
							>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

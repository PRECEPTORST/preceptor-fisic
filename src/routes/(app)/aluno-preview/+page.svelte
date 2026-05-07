<script lang="ts">
	import { Avatar, Chip, Sparkline, Eyebrow } from '$lib/components/ui';
	import IOSDevice from '$lib/components/aluno/ios-device.svelte';

	let tab = $state<'hoje' | 'plano' | 'historico' | 'perfil'>('hoje');

	const tabs = [
		{ id: 'hoje' as const, icon: '◉', label: 'Hoje' },
		{ id: 'plano' as const, icon: '▤', label: 'Plano' },
		{ id: 'historico' as const, icon: '◔', label: 'Histórico' },
		{ id: 'perfil' as const, icon: '⚇', label: 'Perfil' }
	];

	const treinos = [
		{ code: 'A', name: 'Push', focus: 'Peito · Ombro · Tríceps', done: 6, total: 12, today: true },
		{ code: 'B', name: 'Pull', focus: 'Costas · Bíceps', done: 6, total: 12, today: false },
		{ code: 'C', name: 'Legs', focus: 'Pernas · Glúteo · Core', done: 6, total: 12, today: false }
	];

	const sessions = [
		{ name: 'Treino C · Legs', date: '5 mai', dur: 70, rpe: 8.0, status: 'done' as const },
		{ name: 'Treino B · Pull', date: '3 mai', dur: 58, rpe: 7.5, status: 'done' as const },
		{ name: 'Treino A · Push', date: '1 mai', dur: 64, rpe: 7.0, status: 'done' as const },
		{ name: 'Treino C · Legs', date: '28 abr', dur: 0, rpe: 0, status: 'skip' as const },
		{ name: 'Treino B · Pull', date: '26 abr', dur: 60, rpe: 7.5, status: 'done' as const }
	];

	const perfilItems = [
		['Avaliações físicas', '3 registradas', '◔'],
		['Objetivos', 'Hipertrofia + manutenção', '◆'],
		['Limitações', 'Lombalgia leve', '⚠'],
		['Notificações', 'Treino · mensagens', '◑'],
		['Sair', '', '↗']
	] as [string, string, string][];
</script>

<div
	style="flex:1;background:radial-gradient(ellipse at top, #1a1530 0%, var(--bg-0) 60%);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:24px"
>
	<IOSDevice dark>
		<div
			style="width:100%;height:100%;overflow:hidden;background:var(--bg-0);color:var(--ink-0);font-family:var(--font-sans);display:flex;flex-direction:column"
		>
			<div style="flex:1;overflow-y:auto;padding-top:54px;padding-bottom:100px">
				{#if tab === 'hoje'}
					<!-- HOJE -->
					<div>
						<div style="padding:16px 20px 12px;position:relative;overflow:hidden">
							<div
								style="position:absolute;top:-80px;right:-40px;width:200px;height:200px;background:radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);pointer-events:none"
							></div>
							<div style="display:flex;justify-content:space-between;align-items:center;position:relative">
								<div>
									<div
										style="font:var(--label-mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:0.1em"
									>quarta · 06 mai</div>
									<div style="font:500 22px var(--font-sans);margin-top:4px;letter-spacing:-0.02em">Bom dia, Carla</div>
								</div>
								<Avatar name="Carla M" size={36} />
							</div>
						</div>

						<div style="padding:8px 16px 16px">
							<div
								style="position:relative;overflow:hidden;background:linear-gradient(180deg, var(--accent-wash) 0%, var(--bg-2) 100%);border:1px solid var(--accent-dim);border-radius:var(--r-3);padding:20px;box-shadow:var(--glow-accent)"
							>
								<div class="eyebrow" style="margin-bottom:8px;color:var(--accent-2)">● Treino de hoje</div>
								<div style="font:500 24px var(--font-sans);letter-spacing:-0.02em;margin-bottom:4px">Treino A · Push</div>
								<div style="font:var(--body-sm);color:var(--ink-2);margin-bottom:18px">Peito · Ombro · Tríceps</div>

								<div style="display:flex;gap:16px;margin-bottom:18px">
									{#each [['Exercícios', '7'], ['Tempo est.', '62m'], ['Volume', '24t']] as [l, v] (l)}
										<div style="flex:1">
											<div class="eyebrow" style="margin-bottom:4px">{l}</div>
											<div class="num" style="font:500 20px var(--font-mono);color:var(--ink-0)">{v}</div>
										</div>
									{/each}
								</div>

								<button
									style="width:100%;height:48px;background:var(--accent);color:#0a0a0a;border:0;border-radius:var(--r-2);cursor:pointer;font:500 15px var(--font-sans);letter-spacing:-0.01em;box-shadow:0 8px 24px rgba(167,139,250,0.3)"
								>Iniciar treino →</button>
							</div>
						</div>

						<div
							style="padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"
						>
							<div class="card" style="padding:16px">
								<div class="eyebrow" style="margin-bottom:8px">🔥 Sequência</div>
								<div style="display:flex;align-items:baseline;gap:4px">
									<span class="num" style="font:500 32px var(--font-mono);color:var(--accent)">18</span>
									<span style="font:var(--label-mono);color:var(--ink-2)">dias</span>
								</div>
							</div>
							<div class="card" style="padding:16px">
								<div class="eyebrow" style="margin-bottom:8px">Esta semana</div>
								<div style="display:flex;align-items:baseline;gap:4px">
									<span class="num" style="font:500 32px var(--font-mono);color:var(--ink-0)">4/5</span>
									<span style="font:var(--label-mono);color:var(--ink-2)">treinos</span>
								</div>
							</div>
						</div>

						<div style="padding:0 16px 16px">
							<div class="card" style="padding:16px;display:flex;gap:12px">
								<Avatar name="Matheus C" size={36} />
								<div style="flex:1">
									<div style="display:flex;justify-content:space-between;margin-bottom:4px">
										<span style="font:500 13px var(--font-sans);color:var(--ink-0)">Matheus</span>
										<span style="font:var(--label-mono);color:var(--ink-3)">2h</span>
									</div>
									<div style="font:var(--body-sm);color:var(--ink-1);line-height:1.5">
										Carla, hoje vamos progredir o supino para 62kg. Mantém o controle excêntrico que combinamos.
									</div>
								</div>
							</div>
						</div>
					</div>
				{:else if tab === 'plano'}
					<!-- PLANO -->
					<div>
						<div style="padding:16px 20px">
							<div class="eyebrow" style="margin-bottom:4px">Plano ativo</div>
							<h1 style="font:500 22px var(--font-sans);margin:0;letter-spacing:-0.02em">Hipertrofia · PPL Bloco 2</h1>
							<div style="font:var(--body-sm);color:var(--ink-2);margin-top:4px">12 semanas · 3 sessões/sem</div>
						</div>

						<div style="padding:0 16px 16px">
							<div class="card" style="padding:16px;margin-bottom:12px">
								<div style="display:flex;justify-content:space-between;margin-bottom:8px">
									<span class="eyebrow">Progresso</span>
									<span class="num" style="font:var(--label-mono);color:var(--ink-1)">18/36 sessões</span>
								</div>
								<div style="height:6px;background:var(--bg-4);border-radius:3px;overflow:hidden">
									<div
										style="width:50%;height:100%;background:var(--accent);box-shadow:0 0 12px var(--accent-glow)"
									></div>
								</div>
							</div>
						</div>

						<div style="padding:0 16px">
							{#each treinos as w (w.code)}
								<div
									class="card"
									style="padding:16px;margin-bottom:10px;border:1px solid {w.today
										? 'var(--accent-dim)'
										: 'var(--ink-line)'};background:{w.today
										? 'linear-gradient(180deg, var(--accent-wash) 0%, var(--bg-2) 100%)'
										: 'var(--bg-2)'}"
								>
									<div style="display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center">
										<div
											style="width:44px;height:44px;border-radius:var(--r-2);background:{w.today
												? 'var(--accent)'
												: 'var(--bg-3)'};color:{w.today
												? '#0a0a0a'
												: 'var(--ink-1)'};display:flex;align-items:center;justify-content:center;font:500 18px var(--font-sans)"
										>{w.code}</div>
										<div>
											<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
												<span style="font:500 16px var(--font-sans);color:var(--ink-0)">Treino {w.code}</span>
												{#if w.today}<Chip variant="active">● hoje</Chip>{/if}
											</div>
											<div style="font:var(--body-sm);color:var(--ink-2)">{w.focus}</div>
										</div>
										<span class="num" style="font:var(--label-mono);color:var(--ink-2)">{w.done}/{w.total}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else if tab === 'historico'}
					<!-- HISTÓRICO -->
					<div>
						<div style="padding:16px 20px">
							<h1 style="font:500 22px var(--font-sans);margin:0;letter-spacing:-0.02em">Histórico</h1>
						</div>

						<div style="padding:0 16px 16px">
							<div class="card" style="padding:16px">
								<div class="eyebrow" style="margin-bottom:14px">Peso · últimas 8 semanas</div>
								<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:12px">
									<span class="num" style="font:500 32px var(--font-mono);color:var(--ink-0)">62.4</span>
									<span style="font:var(--label-mono);color:var(--ink-2)">kg</span>
									<span style="margin-left:auto;font:var(--label-mono);color:var(--success)">↘ −1.7kg</span>
								</div>
								<Sparkline
									data={[64.1, 63.8, 63.5, 63.2, 62.9, 62.7, 62.5, 62.4]}
									width={300}
									height={48}
									color="var(--accent)"
								/>
							</div>
						</div>

						<div style="padding:0 20px 8px">
							<div class="eyebrow">Sessões recentes</div>
						</div>
						<div style="padding:0 16px">
							{#each sessions as s, i (i + s.date)}
								<div class="card" style="padding:14px;margin-bottom:8px">
									<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
										<div>
											<div style="font:500 14px var(--font-sans);color:var(--ink-0);margin-bottom:4px">{s.name}</div>
											<div style="font:var(--label-mono);color:var(--ink-2)">
												{s.date}
												{#if s.status === 'done'} · {s.dur}m · RPE {s.rpe}{/if}
											</div>
										</div>
										<Chip variant={s.status === 'done' ? 'success' : 'danger'}>
											{s.status === 'done' ? '● completo' : '○ faltou'}
										</Chip>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<!-- PERFIL -->
					<div>
						<div style="padding:24px 20px 16px;text-align:center">
							<div style="display:inline-block;margin-bottom:12px">
								<Avatar name="Carla Mendes" size={88} />
							</div>
							<div style="font:500 20px var(--font-sans);letter-spacing:-0.02em">Carla Mendes</div>
							<div style="font:var(--body-sm);color:var(--ink-2);margin-top:4px">32 anos · desde 14 jan 2026</div>
						</div>

						<div style="padding:0 16px 16px">
							<div class="card" style="padding:16px;display:flex;align-items:center;gap:12px">
								<Avatar name="Matheus C" size={40} />
								<div style="flex:1">
									<div class="eyebrow" style="margin-bottom:4px">Seu treinador</div>
									<div style="font:500 14px var(--font-sans)">Matheus Castro</div>
								</div>
							</div>
						</div>

						<div style="padding:0 16px">
							{#each perfilItems as [l, sub, ic] (l)}
								<button
									style="width:100%;padding:14px 14px;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2);margin-bottom:8px;cursor:pointer;text-align:left;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center"
								>
									<span style="color:var(--accent);font-size:16px;width:16px">{ic}</span>
									<div>
										<div style="font:500 14px var(--font-sans);color:var(--ink-0)">{l}</div>
										{#if sub}<div style="font:var(--label-mono);color:var(--ink-3)">{sub}</div>{/if}
									</div>
									<span style="color:var(--ink-2)">›</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Tab bar -->
			<div
				style="position:absolute;bottom:0;left:0;right:0;background:rgba(10,10,10,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid var(--ink-line);display:grid;grid-template-columns:repeat(4,1fr);padding-bottom:24px;padding-top:8px"
			>
				{#each tabs as t (t.id)}
					{@const on = tab === t.id}
					<button
						onclick={() => (tab = t.id)}
						style="background:transparent;border:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;color:{on
							? 'var(--accent)'
							: 'var(--ink-3)'}"
					>
						<span style="font-size:20px">{t.icon}</span>
						<span style="font:500 10px var(--font-sans);letter-spacing:-0.005em">{t.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</IOSDevice>
</div>

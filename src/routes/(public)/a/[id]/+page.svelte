<script lang="ts">
	import { Avatar, Chip, Sparkline, Eyebrow, toast } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const student = $derived(data.student);
	const pro = $derived(data.professional);
	const plan = $derived(data.plan);
	const sessions = $derived(plan?.planData.weekly_sessions ?? []);
	const streak = $derived(data.streakDays);
	const recent = $derived(data.recentSessions);

	// Preserva o magic-link token na navegação interna
	const tokenParam = $derived(page.url.searchParams.get('t'));
	const tq = $derived(tokenParam ? `?t=${tokenParam}` : '');

	onMount(() => {
		if (page.url.searchParams.get('just_completed') === '1') {
			toast.success('Treino registrado · 🔥 streak +1');
			const u = new URL(page.url);
			u.searchParams.delete('just_completed');
			history.replaceState(null, '', u.toString());
		}
	});

	const today = new Date();
	const weekday = today.toLocaleDateString('pt-BR', { weekday: 'long' });
	const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

	const todaySessionIdx = $derived.by(() => {
		// Heurística: pega a próxima sessão na ordem (mod 7)
		// Em produção: olharia day_of_week e calendário
		if (sessions.length === 0) return -1;
		const dow = today.getDay();
		return dow % sessions.length;
	});
	const todaySession = $derived(todaySessionIdx >= 0 ? sessions[todaySessionIdx] : null);
	const exerciseCount = $derived(todaySession ? (todaySession.main?.length ?? 0) : 0);

	const recentDone = $derived(recent.length);
	const weeklyTarget = 5; // tomar do prefs.weeklySessions futuramente
</script>

<svelte:head>
	<title>{student.name} · Preceptor Fisic</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="page">
	<!-- Header -->
	<header class="header">
		<div class="header-glow"></div>
		<div style="display:flex;justify-content:space-between;align-items:center;position:relative">
			<div>
				<div class="eyebrow" style="text-transform:uppercase">{weekday} · {dateStr}</div>
				<div style="font:500 22px var(--font-sans);margin-top:4px;letter-spacing:-0.02em">
					Olá, {student.name.split(' ')[0]}
				</div>
			</div>
			<Avatar name={student.name} size={40} />
		</div>
	</header>

	{#if !plan}
		<div class="empty">
			<div style="font:500 18px var(--font-sans);color:var(--ink-0);margin-bottom:6px">
				Sem plano ativo ainda
			</div>
			<div style="font:var(--body);color:var(--ink-2)">
				Seu treinador <span style="color:var(--ink-1)">{pro.name}</span> ainda não publicou um plano.
			</div>
		</div>
	{:else}
		<!-- Treino do dia · card hero -->
		{#if todaySession}
			<div class="hero-card-wrap">
				<div class="hero-card">
					<div class="eyebrow" style="margin-bottom:8px;color:var(--accent-2)">● Treino de hoje</div>
					<div style="font:500 24px var(--font-sans);letter-spacing:-0.02em;margin-bottom:4px">
						{todaySession.label ?? 'Sessão'}
					</div>
					<div style="font:var(--body-sm);color:var(--ink-2);margin-bottom:18px">
						{todaySession.focus ?? '—'}
					</div>

					<div style="display:flex;gap:16px;margin-bottom:18px">
						{#each [['Exercícios', String(exerciseCount)], ['Tempo est.', `${todaySession.duration_minutes ?? '—'}m`], ['Restrições', String((plan.planData.restrictions ?? []).length)]] as [l, v] (l)}
							<div style="flex:1">
								<div class="eyebrow" style="margin-bottom:4px">{l}</div>
								<div class="num" style="font:500 20px var(--font-mono);color:var(--ink-0)">{v}</div>
							</div>
						{/each}
					</div>

					<button class="cta" onclick={() => goto(`/a/${student.id}/treino/${todaySessionIdx}${tq}`)}>
						Iniciar treino →
					</button>
				</div>
			</div>
		{/if}

		<!-- Streak + frequência -->
		<div class="stats-row">
			<div class="card mini">
				<div class="eyebrow" style="margin-bottom:8px">🔥 Sequência</div>
				<div style="display:flex;align-items:baseline;gap:4px">
					<span class="num" style="font:500 32px var(--font-mono);color:var(--accent)">{streak}</span>
					<span style="font:var(--label-mono);color:var(--ink-2)">{streak === 1 ? 'dia' : 'dias'}</span>
				</div>
			</div>
			<div class="card mini">
				<div class="eyebrow" style="margin-bottom:8px">Esta semana</div>
				<div style="display:flex;align-items:baseline;gap:4px">
					<span class="num" style="font:500 32px var(--font-mono);color:var(--ink-0)">{recentDone}/{weeklyTarget}</span>
					<span style="font:var(--label-mono);color:var(--ink-2)">treinos</span>
				</div>
			</div>
		</div>

		<!-- Plano completo -->
		<div class="section">
			<div class="section-header">
				<Eyebrow>Plano completo</Eyebrow>
				<a href="/a/{student.id}/historico{tq}" style="font:var(--label-mono);color:var(--accent);text-decoration:none">
					HISTÓRICO →
				</a>
			</div>
			{#each sessions as s, i (i)}
				{@const isToday = i === todaySessionIdx}
				<button
					class="session-card"
					class:today={isToday}
					onclick={() => goto(`/a/${student.id}/treino/${i}${tq}`)}
				>
					<div class="session-letter" class:today={isToday}>{String.fromCharCode(65 + i)}</div>
					<div style="flex:1;min-width:0;text-align:left">
						<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
							<span style="font:500 16px var(--font-sans);color:var(--ink-0)">{s.label ?? `Treino ${String.fromCharCode(65 + i)}`}</span>
							{#if isToday}<Chip variant="active">● hoje</Chip>{/if}
						</div>
						<div style="font:var(--body-sm);color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
							{s.focus ?? `${s.main?.length ?? 0} exercícios · ${s.duration_minutes ?? '—'} min`}
						</div>
					</div>
					<span class="num" style="font:var(--label-mono);color:var(--ink-2)">{s.main?.length ?? 0} ex</span>
				</button>
			{/each}
		</div>

		<!-- Mensagem do treinador -->
		<div class="section">
			<div class="card msg-card">
				<Avatar name={pro.name} size={36} />
				<div style="flex:1">
					<div style="display:flex;justify-content:space-between;margin-bottom:4px">
						<span style="font:500 13px var(--font-sans);color:var(--ink-0)">{pro.name}</span>
						<span style="font:var(--label-mono);color:var(--ink-3)">treinador{pro.cref ? ' · ' + pro.cref : ''}</span>
					</div>
					<div style="font:var(--body-sm);color:var(--ink-1);line-height:1.5">
						Plano em vigor. Treine no seu ritmo, prestando atenção às restrições e ao monitoramento que combinamos.
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Bottom tab bar -->
	<nav class="tab-bar">
		{#each [{ id: 'hoje', icon: '◉', label: 'Hoje', href: `/a/${student.id}${tq}` }, { id: 'plano', icon: '▤', label: 'Plano', href: `/a/${student.id}${tq}` }, { id: 'historico', icon: '◔', label: 'Histórico', href: `/a/${student.id}/historico${tq}` }] as t (t.id)}
			<a href={t.href} class="tab-link" class:on={t.id === 'hoje'}>
				<span style="font-size:20px">{t.icon}</span>
				<span style="font:500 10px var(--font-sans)">{t.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.page {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding-bottom: 92px;
	}
	.header {
		padding: 18px 20px 14px;
		position: relative;
		overflow: hidden;
	}
	.header-glow {
		position: absolute;
		top: -80px;
		right: -40px;
		width: 200px;
		height: 200px;
		background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
		pointer-events: none;
	}
	.empty {
		text-align: center;
		padding: 40px 24px;
	}
	.hero-card-wrap {
		padding: 8px 16px 18px;
	}
	.hero-card {
		position: relative;
		background: linear-gradient(180deg, var(--accent-wash) 0%, var(--bg-2) 100%);
		border: 1px solid var(--accent-dim);
		border-radius: var(--r-3);
		padding: 22px 20px;
		box-shadow: var(--glow-accent);
	}
	.cta {
		width: 100%;
		height: 50px;
		background: var(--accent);
		color: #0a0a0a;
		border: 0;
		border-radius: var(--r-2);
		cursor: pointer;
		font: 500 16px var(--font-sans);
		letter-spacing: -0.01em;
		box-shadow: 0 8px 24px rgba(167, 139, 250, 0.3);
	}
	.stats-row {
		padding: 0 16px 16px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.card.mini {
		padding: 16px;
	}
	.section {
		padding: 8px 16px 16px;
	}
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}
	.session-card {
		all: unset;
		cursor: pointer;
		display: grid;
		grid-template-columns: 44px 1fr auto;
		gap: 14px;
		align-items: center;
		padding: 14px;
		background: var(--bg-2);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-2);
		margin-bottom: 8px;
		transition: background 140ms var(--ease);
	}
	.session-card.today {
		background: linear-gradient(180deg, var(--accent-wash) 0%, var(--bg-2) 100%);
		border-color: var(--accent-dim);
	}
	.session-letter {
		width: 44px;
		height: 44px;
		border-radius: var(--r-2);
		background: var(--bg-3);
		color: var(--ink-1);
		display: flex;
		align-items: center;
		justify-content: center;
		font: 500 18px var(--font-sans);
	}
	.session-letter.today {
		background: var(--accent);
		color: #0a0a0a;
	}
	.msg-card {
		display: flex;
		gap: 12px;
		padding: 16px;
	}
	.tab-bar {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 480px;
		background: rgba(10, 10, 10, 0.92);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-top: 1px solid var(--ink-line);
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		padding: 10px 0 max(env(safe-area-inset-bottom, 12px), 12px);
		z-index: 50;
	}
	.tab-link {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		color: var(--ink-3);
		text-decoration: none;
	}
	.tab-link.on {
		color: var(--accent);
	}
</style>

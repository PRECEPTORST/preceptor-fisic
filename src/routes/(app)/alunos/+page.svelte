<script lang="ts">
	import { Button, Chip, Avatar, StatusDot, ProgressBar, Eyebrow } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { StudentListItem } from '$lib/server/queries';

	let { data }: { data: PageData } = $props();
	const students = $derived(data.students);

	let filter = $state<'all' | 'active' | 'paused'>('all');
	let goal = $state<string>('all');
	let q = $state('');
	let hover = $state<string | null>(null);
	let inputFocused = $state(false);

	const filtered = $derived(
		students.filter(
			(s) =>
				(filter === 'all' || s.status === filter) &&
				(goal === 'all' || s.goal === goal) &&
				(!q || s.name.toLowerCase().includes(q.toLowerCase()))
		)
	);

	const goalsAvailable = $derived(
		Array.from(new Set(students.map((s) => s.goal).filter((x): x is string => !!x)))
	);

	function adherenceColor(a: number) {
		if (a >= 85) return 'var(--success)';
		if (a >= 70) return 'var(--warn)';
		return 'var(--danger)';
	}

	function openStudent(s: StudentListItem) {
		goto(`/alunos/${s.id}`);
	}
</script>

<div class="page-body">
	<header
		style="display:flex;align-items:center;justify-content:space-between;padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);position:sticky;top:0;z-index:10"
	>
		<div>
			<Eyebrow>{students.length} alunos · {students.filter((s) => s.status === 'active').length} ativos</Eyebrow>
			<h1 style="margin:6px 0 0;font:600 22px var(--font-sans);letter-spacing:-0.015em">Alunos</h1>
		</div>
		<div style="display:flex;align-items:center;gap:12px">
			<div
				style="display:flex;align-items:center;gap:8px;padding:0 14px;height:38px;background:var(--bg-2);border:1px solid {inputFocused
					? 'var(--accent)'
					: 'var(--ink-line)'};border-radius:var(--r-2);font:var(--body-sm);color:var(--ink-2);min-width:280px;transition:all 140ms var(--ease)"
			>
				<span>⌕</span>
				<input
					bind:value={q}
					onfocus={() => (inputFocused = true)}
					onblur={() => (inputFocused = false)}
					placeholder="Buscar aluno por nome…"
					style="flex:1;background:transparent;border:0;outline:none;color:var(--ink-0);font:var(--body-sm) var(--font-sans)"
				/>
			</div>
			<Button onclick={() => goto('/alunos/novo')}>+ Novo aluno</Button>
		</div>
	</header>

	<div style="padding:24px 32px 64px;display:flex;flex-direction:column;gap:20px;overflow-y:auto;flex:1">
		<!-- Filters -->
		<div
			style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:14px 16px;background:var(--bg-2);border:1px solid var(--ink-line);border-radius:var(--r-2)"
		>
			<span class="eyebrow" style="margin-right:4px">STATUS</span>
			{#each [['all', 'Todos'], ['active', 'Ativos'], ['paused', 'Pausados']] as [k, l] (k)}
				<Chip active={filter === k} onclick={() => (filter = k as typeof filter)}>{l}</Chip>
			{/each}
			{#if goalsAvailable.length > 0}
				<div style="width:1px;height:18px;background:var(--ink-line);margin:0 6px"></div>
				<span class="eyebrow" style="margin-right:4px">OBJETIVO</span>
				<Chip active={goal === 'all'} onclick={() => (goal = 'all')}>Todos</Chip>
				{#each goalsAvailable as g (g)}
					<Chip active={goal === g} onclick={() => (goal = g)}>{g}</Chip>
				{/each}
			{/if}
		</div>

		{#if students.length === 0}
			<div class="card" style="padding:48px;text-align:center">
				<div style="font:500 18px var(--font-sans);color:var(--ink-0);margin-bottom:6px">Nenhum aluno cadastrado</div>
				<div style="font:var(--body);color:var(--ink-2);max-width:420px;margin:0 auto 20px">
					Adicione seu primeiro aluno pra começar a prescrever planos.
				</div>
				<Button onclick={() => goto('/alunos/novo')}>+ Adicionar primeiro aluno</Button>
			</div>
		{:else}
			<div class="card" style="padding:0;overflow:hidden">
				<div
					style="display:grid;grid-template-columns:40px 2fr 1fr 1fr 100px 80px 60px 40px;gap:18px;align-items:center;padding:12px 18px;font:var(--label-mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:0.08em;background:var(--bg-1)"
				>
					<span></span><span>Aluno</span><span>Plano</span><span>Aderência</span><span>7d sessões</span><span>Última</span><span>Streak</span><span></span>
				</div>
				{#each filtered as s (s.id)}
					<button
						type="button"
						onmouseenter={() => (hover = s.id)}
						onmouseleave={() => (hover = null)}
						onclick={() => openStudent(s)}
						style="all:unset;cursor:pointer;display:grid;grid-template-columns:40px 2fr 1fr 1fr 100px 80px 60px 40px;gap:18px;align-items:center;padding:14px 18px;border-top:1px solid var(--ink-line);background:{hover === s.id
							? 'var(--bg-2)'
							: 'transparent'};transition:background 140ms var(--ease)"
					>
						<Avatar name={s.name} size={36} />
						<div>
							<div style="display:flex;align-items:center;gap:8px">
								<span style="font:500 14px var(--font-sans);color:var(--ink-0)">{s.name}</span>
								<StatusDot variant={s.status === 'active' ? 'success' : 'muted'} />
							</div>
							<div
								style="font:var(--label-mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:0.06em;margin-top:3px"
							>{s.age ? s.age + ' anos · ' : ''}{s.goal ?? 'sem objetivo'}</div>
						</div>
						<div style="font:var(--body-sm);color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
							{s.planTitle ?? '—'}
						</div>
						<div>
							<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
								<span class="num" style="font:500 13px var(--font-mono);color:{adherenceColor(s.adherence)}">{s.adherence}%</span>
								<span style="font:var(--label-mono);color:var(--ink-2)">aderência</span>
							</div>
							<ProgressBar value={s.adherence} color={adherenceColor(s.adherence)} height={3} />
						</div>
						<div style="display:flex;flex-direction:column">
							<span class="num" style="font:500 13px var(--font-mono);color:var(--ink-0)">{s.sessions7}/wk</span>
							<span style="font:var(--label-mono);color:var(--ink-2)">7d sessões</span>
						</div>
						<div class="num" style="font:500 13px var(--font-mono);color:var(--ink-1)">{s.last ?? '—'}</div>
						<div style="display:flex;align-items:center;gap:4px">
							<span style="color:var(--accent)">♦</span>
							<span class="num" style="font:500 13px var(--font-mono);color:var(--ink-0)">{s.streak}</span>
						</div>
						<span
							style="color:var(--ink-2);font-size:16px;transition:all 140ms;transform:{hover === s.id
								? 'translateX(4px)'
								: 'none'};opacity:{hover === s.id ? 1 : 0.4}"
						>→</span>
					</button>
				{/each}
				{#if filtered.length === 0}
					<div style="padding:32px;text-align:center;font:var(--body-sm);color:var(--ink-2);border-top:1px solid var(--ink-line)">
						Nenhum aluno com esses filtros.
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.page-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
</style>

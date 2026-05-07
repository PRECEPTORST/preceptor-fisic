<script lang="ts">
	import { Button, Chip, Sparkline, Eyebrow, toast } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const detail = $derived(data.detail);
	const student = $derived(detail.student);
	const hp = $derived(detail.healthProfile);
	const prefs = $derived(detail.preferences);
	const plans = $derived(detail.plans);
	const lastWeights = $derived(detail.lastWeights);
	const alunoUrl = $derived(data.alunoUrl);

	let tab = $state<'dados' | 'plan' | 'prog'>('dados');

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(alunoUrl);
			toast.success('Link do aluno copiado · cole no WhatsApp pra enviar.');
		} catch {
			toast.error('Não foi possível copiar. Use ⌘C: ' + alunoUrl);
		}
	}

	const HIGH_RISK_KEYS = ['cardiopatia', 'avc', 'dpoc', 'diabetes tipo 1', 'stent', 'insuficiência'];
	function isHighRisk(c: string) {
		return HIGH_RISK_KEYS.some((r) => c.toLowerCase().includes(r));
	}

	const age = $derived.by(() => {
		if (!student.birthDate) return null;
		const b = new Date(student.birthDate);
		const now = new Date();
		let a = now.getFullYear() - b.getFullYear();
		const m = now.getMonth() - b.getMonth();
		if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
		return a;
	});

	const weight = $derived(student.weightKg ?? 0);
	const height = $derived(student.heightCm ?? 0);
	const bmi = $derived(height > 0 ? (weight / Math.pow(height / 100, 2)).toFixed(1) : '—');
	const bmiCat = $derived(
		bmi === '—'
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
		bmi === '—' || (Number(bmi) < 18.5 || Number(bmi) >= 30)
			? 'var(--danger)'
			: Number(bmi) >= 25
				? 'var(--warn)'
				: 'var(--success)'
	);

	const initials = $derived(
		student.name
			.split(' ')
			.map((n) => n[0] ?? '')
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);

	const wDelta = $derived(
		lastWeights.length >= 2
			? (lastWeights[lastWeights.length - 1]! - lastWeights[0]!).toFixed(1) + 'kg'
			: '0kg'
	);
	const wTrend = $derived(
		lastWeights.length >= 2
			? lastWeights[lastWeights.length - 1]! < lastWeights[0]!
				? 'down'
				: lastWeights[lastWeights.length - 1]! > lastWeights[0]!
					? 'up'
					: 'flat'
			: 'flat'
	);

	const diagnoses = $derived((hp?.diagnoses as { label: string; severity?: string }[] | null) ?? []);
	const meds = $derived((hp?.medications as { name: string; dose?: string; frequency?: string }[] | null) ?? []);
	const limitations = $derived(
		(hp?.injuries as { region: string; notes?: string }[] | null)?.map((i) => i.region + (i.notes ? ' · ' + i.notes : '')) ??
			(hp?.contraindications as { exercise_pattern: string; reason: string }[] | null)?.map(
				(c) => c.exercise_pattern + ' · ' + c.reason
			) ??
			[]
	);

	const hasRisk = $derived(diagnoses.some((d) => isHighRisk(d.label)));

	const goalsList = $derived((prefs?.goals as string[] | null) ?? []);
	const GOAL_LABELS: Record<string, string> = {
		emagrecimento: 'Emagrecimento',
		hipertrofia: 'Hipertrofia',
		forca: 'Força',
		condicionamento_cardiovascular: 'Cardio',
		qualidade_de_vida: 'Saúde geral',
		reabilitacao: 'Reabilitação',
		performance: 'Performance'
	};
	const primaryGoal = $derived(goalsList[0] ? (GOAL_LABELS[goalsList[0]] ?? goalsList[0]) : 'sem objetivo');

	const heroStats = $derived([
		{
			lbl: 'Peso',
			val: weight ? weight.toFixed(1) : '—',
			unit: 'kg',
			spark: lastWeights.length > 1 ? lastWeights : undefined,
			delta: lastWeights.length > 1 ? wDelta : undefined,
			trend: wTrend,
			color: 'var(--ink-0)'
		},
		{ lbl: 'Altura', val: height || '—', unit: 'cm', color: 'var(--ink-0)', spark: undefined, delta: undefined, trend: undefined },
		{ lbl: 'IMC', val: bmi, unit: bmiCat, color: bmiColor, spark: undefined, delta: undefined, trend: undefined },
		{ lbl: 'Sexo', val: student.sex.charAt(0).toUpperCase() + student.sex.slice(1).replace('_', ' '), unit: '', color: 'var(--ink-0)', spark: undefined, delta: undefined, trend: undefined },
		{ lbl: 'Risco CV', val: hp?.cardiovascularRisk ?? '—', unit: '', color: hp?.cardiovascularRisk === 'alto' || hp?.cardiovascularRisk === 'muito_alto' ? 'var(--danger)' : 'var(--success)', spark: undefined, delta: undefined, trend: undefined }
	]);

	const trendIcon = (t: string | undefined) => (t === 'down' ? '↘' : t === 'up' ? '↗' : '→');
	const trendColor = (t: string | undefined) =>
		t === 'down' ? 'var(--success)' : t === 'up' ? 'var(--warn)' : 'var(--ink-2)';

	const since = $derived(
		new Date(student.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
	);
</script>

<div style="flex:1;overflow-y:auto;background:var(--bg-0)">
	<!-- Breadcrumb -->
	<div
		style="padding:20px 32px;border-bottom:1px solid var(--ink-line);display:flex;align-items:center;gap:16px;background:var(--bg-1)"
	>
		<button
			onclick={() => goto('/dashboard')}
			style="background:var(--bg-3);border:1px solid var(--ink-line-2);cursor:pointer;width:36px;height:36px;border-radius:var(--r-1);color:var(--ink-1);display:flex;align-items:center;justify-content:center;font:400 18px var(--font-sans)"
		>←</button>
		<span style="font:var(--body-sm);color:var(--ink-2)">Alunos</span>
		<span style="color:var(--ink-3)">/</span>
		<span style="font:var(--body-sm);color:var(--ink-1)">{student.name}</span>
	</div>

	<!-- Hero -->
	<div
		style="background:linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);border-bottom:1px solid var(--ink-line);padding:32px 32px 0;position:relative;overflow:hidden"
	>
		<div
			style="position:absolute;top:-120px;right:-60px;width:420px;height:420px;background:radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);pointer-events:none"
		></div>

		<div
			style="display:grid;grid-template-columns:auto 1fr auto;gap:28px;align-items:flex-start;position:relative"
		>
			<div
				style="width:96px;height:96px;border-radius:var(--r-3);background:linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%);display:flex;align-items:center;justify-content:center;font:500 36px var(--font-sans);color:#0a0a0a;box-shadow:var(--glow-accent);letter-spacing:-0.02em"
			>{initials}</div>

			<div style="padding-top:6px">
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
					<h1 style="margin:0;font:500 32px var(--font-sans);color:var(--ink-0);letter-spacing:-0.02em">{student.name}</h1>
					{#if hasRisk}
						<span
							style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--r-pill);background:var(--danger-dim);color:var(--danger);font:var(--label-mono);text-transform:uppercase;letter-spacing:0.08em;border:1px solid var(--danger)"
						>⚠ Atenção clínica</span>
					{/if}
				</div>
				<div style="display:flex;gap:24px;font:var(--body);color:var(--ink-2);flex-wrap:wrap">
					{#if age}
						<span><span style="color:var(--ink-1)">{age}</span> anos</span>
						<span style="color:var(--ink-line-2)">·</span>
					{/if}
					<span><span style="color:var(--accent)">{primaryGoal}</span></span>
					<span style="color:var(--ink-line-2)">·</span>
					<span>desde {since}</span>
					{#if plans.some((p) => p.isActive)}
						<span style="color:var(--ink-line-2)">·</span>
						<span>plano <span style="color:var(--success)">● ativo</span></span>
					{/if}
				</div>
			</div>

			<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
				<Button variant="secondary" size="md" onclick={copyLink} title={alunoUrl}>📋 Link do aluno</Button>
				<Button variant="secondary" size="md" onclick={() => goto(`/alunos/${student.id}/editar`)}>Editar</Button>
				<Button variant="secondary" size="md" onclick={() => goto('/mensagens')}>Mensagem</Button>
				<Button size="md" onclick={() => goto(`/alunos/${student.id}/gerar`)}>+ Gerar plano</Button>
			</div>
		</div>

		<!-- Quick stats strip -->
		<div
			style="margin-top:32px;display:grid;grid-template-columns:repeat(5,1fr);gap:0;border-top:1px solid var(--ink-line);position:relative"
		>
			{#each heroStats as s, i (s.lbl)}
				<div style="padding:20px 24px;{i < 4 ? 'border-right:1px solid var(--ink-line)' : ''}">
					<div class="eyebrow" style="margin-bottom:10px">{s.lbl}</div>
					<div style="display:flex;align-items:baseline;gap:6px">
						<span class="num" style="font:var(--num-lg);color:{s.color}">{s.val}</span>
						{#if s.unit}<span style="font:var(--label-mono);color:var(--ink-2)">{s.unit}</span>{/if}
					</div>
					{#if s.spark}
						<div style="margin-top:8px;display:flex;align-items:center;gap:8px">
							<Sparkline data={s.spark} width={80} height={20} color={trendColor(s.trend)} />
							<span style="font:var(--label-mono);color:{trendColor(s.trend)}">{trendIcon(s.trend)} {s.delta}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Tabs -->
	<div style="padding:0 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1)">
		<div style="display:flex;gap:32px">
			{#each [['dados', 'Dados clínicos', undefined], ['plan', 'Planos', plans.length], ['prog', 'Progresso', undefined]] as [key, label, count] (key)}
				{@const active = tab === key}
				<button
					onclick={() => (tab = key as typeof tab)}
					style="background:transparent;border:0;cursor:pointer;padding:14px 0;font:500 14px var(--font-sans);color:{active
						? 'var(--ink-0)'
						: 'var(--ink-2)'};position:relative;display:flex;align-items:center;gap:8px"
				>
					{label}
					{#if count != null}
						<span
							style="font:var(--label-mono);color:{active
								? 'var(--accent)'
								: 'var(--ink-3)'};padding:2px 7px;border-radius:99px;background:{active
								? 'var(--accent-wash)'
								: 'var(--bg-3)'}"
						>{count}</span>
					{/if}
					{#if active}
						<span
							style="position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--accent);border-radius:1px"
						></span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div style="padding:28px 32px 80px">
		{#if tab === 'dados'}
			<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px">
				<div style="display:flex;flex-direction:column;gap:16px">
					<!-- Histórico médico -->
					<div class="card" style="padding:24px">
						<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
							<div style="width:32px;height:32px;border-radius:var(--r-1);background:var(--danger-dim);display:flex;align-items:center;justify-content:center;color:var(--danger)">+</div>
							<div style="font:500 16px var(--font-sans);color:var(--ink-0)">Histórico médico</div>
						</div>
						{#if diagnoses.length === 0}
							<div style="font:var(--body-sm);color:var(--ink-2)">Nenhuma condição registrada</div>
						{:else}
							<div style="display:flex;flex-wrap:wrap;gap:8px">
								{#each diagnoses as d, i (d.label + i)}
									{@const risk = isHighRisk(d.label)}
									<span
										style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r-pill);font:500 12px var(--font-sans);background:{risk
											? 'var(--danger-dim)'
											: 'var(--bg-3)'};color:{risk
											? 'var(--danger)'
											: 'var(--ink-1)'};border:1px solid {risk ? 'var(--danger)' : 'var(--ink-line-2)'}"
									>
										{#if risk}<span>⚠</span>{/if}
										{d.label}{d.severity ? ' · ' + d.severity : ''}
									</span>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Medicações -->
					<div class="card" style="padding:24px">
						<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
							<div style="width:32px;height:32px;border-radius:var(--r-1);background:var(--accent-wash);display:flex;align-items:center;justify-content:center;color:var(--accent);font:500 16px var(--font-sans)">℞</div>
							<div style="font:500 16px var(--font-sans);color:var(--ink-0)">Medicações em uso</div>
						</div>
						{#if meds.length === 0}
							<div style="font:var(--body-sm);color:var(--ink-2)">Nenhuma medicação registrada</div>
						{:else}
							<div style="display:flex;flex-direction:column;gap:1px">
								{#each meds as m, i (m.name + i)}
									<div
										style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px 0;{i
											? 'border-top:1px solid var(--ink-line)'
											: ''}"
									>
										<span style="font:var(--body);color:var(--ink-0)">{m.name}{m.dose ? ' · ' + m.dose : ''}</span>
										<span style="font:var(--label-mono);color:var(--ink-2)">{m.frequency ?? 'contínuo'}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Limitações físicas -->
					<div class="card" style="padding:24px">
						<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
							<div style="width:32px;height:32px;border-radius:var(--r-1);background:var(--warn-dim);display:flex;align-items:center;justify-content:center;color:var(--warn)">⚠</div>
							<div style="font:500 16px var(--font-sans);color:var(--ink-0)">Limitações físicas</div>
						</div>
						{#if limitations.length === 0}
							<div style="font:var(--body-sm);color:var(--ink-2)">Sem limitações</div>
						{:else}
							<div style="display:flex;flex-direction:column;gap:10px">
								{#each limitations as l, i (l + i)}
									<div
										style="display:flex;gap:12px;padding:14px;background:var(--warn-dim);border-radius:var(--r-2);border:1px solid var(--warn);border-left-width:4px"
									>
										<span style="font:var(--body);color:var(--ink-0)">{l}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Direita — preferências -->
				<div style="display:flex;flex-direction:column;gap:16px">
					<div class="card" style="padding:24px">
						<div style="font:500 16px var(--font-sans);color:var(--ink-0);margin-bottom:16px">Preferências</div>

						<div class="eyebrow" style="margin-bottom:8px">Objetivos</div>
						<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
							{#if goalsList.length === 0}
								<span style="font:var(--body-sm);color:var(--ink-2)">Sem objetivos definidos</span>
							{/if}
							{#each goalsList as g (g)}
								<Chip variant="active">◆ {GOAL_LABELS[g] ?? g}</Chip>
							{/each}
						</div>

						<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
							<div>
								<div class="eyebrow" style="margin-bottom:6px">Sessão</div>
								<div class="num" style="font:var(--num-md);color:var(--ink-0)">{prefs?.minutesPerSession ?? '—'}</div>
								<div style="font:var(--label-mono);color:var(--ink-2)">minutos</div>
							</div>
							<div>
								<div class="eyebrow" style="margin-bottom:6px">Frequência</div>
								<div class="num" style="font:var(--num-md);color:var(--ink-0)">{prefs?.weeklySessions ?? '—'}</div>
								<div style="font:var(--label-mono);color:var(--ink-2)">por semana</div>
							</div>
						</div>

						{#if prefs?.experienceLevel}
							<div style="margin-top:20px">
								<div class="eyebrow" style="margin-bottom:6px">Nível</div>
								<Chip>{prefs.experienceLevel}</Chip>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else if tab === 'plan'}
			<div>
				<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
					<div class="eyebrow">{plans.length} {plans.length === 1 ? 'plano' : 'planos'} · {plans.filter((p) => p.isActive).length} ativos</div>
					<Button onclick={() => goto(`/alunos/${student.id}/gerar`)}>+ Gerar novo plano</Button>
				</div>
				{#if plans.length === 0}
					<div class="card" style="padding:48px;text-align:center">
						<div style="font:500 16px var(--font-sans);color:var(--ink-0);margin-bottom:8px">Nenhum plano ainda</div>
						<div style="font:var(--body);color:var(--ink-2);margin-bottom:20px">Gere o primeiro plano baseado nas preferências e perfil clínico.</div>
						<Button onclick={() => goto(`/alunos/${student.id}/gerar`)}>+ Gerar plano</Button>
					</div>
				{:else}
					<div style="display:flex;flex-direction:column;gap:12px">
						{#each plans as p (p.id)}
							<button
								type="button"
								onclick={() => goto(`/planos/${p.id}`)}
								class="card"
								style="all:unset;cursor:pointer;display:block;padding:22px;border:1px solid {p.isActive
									? 'var(--accent-dim)'
									: 'var(--ink-line)'};background:{p.isActive
									? 'linear-gradient(180deg, var(--accent-wash) 0%, var(--bg-2) 100%)'
									: 'var(--bg-2)'};border-radius:var(--r-3)"
							>
								<div
									style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:flex-start"
								>
									<div>
										<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
											<Chip variant={p.isActive ? 'active' : 'default'}>{p.isActive ? '● Ativo' : 'Encerrado'}</Chip>
											<span style="font:var(--label-mono);color:var(--ink-2)">{p.sessionsTotal} {p.sessionsTotal === 1 ? 'sessão' : 'sessões'}</span>
										</div>
										<div style="font:500 16px var(--font-sans);color:var(--ink-0);margin-bottom:6px;line-height:1.4">{p.title}</div>
										<div style="font:var(--body-sm);color:var(--ink-2)">
											Gerado {new Date(p.createdAt).toLocaleDateString('pt-BR')}
										</div>
									</div>
									<span style="color:var(--ink-2);font-size:22px">›</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div style="display:flex;flex-direction:column;gap:16px">
				{#if detail.assessments.length === 0 && lastWeights.length === 0}
					<div class="card" style="padding:48px;text-align:center">
						<div style="font:500 16px var(--font-sans);color:var(--ink-0);margin-bottom:8px">Sem dados de progresso</div>
						<div style="font:var(--body);color:var(--ink-2);margin-bottom:20px">Registre uma avaliação física pra começar a acompanhar.</div>
						<Button onclick={() => goto(`/alunos/${student.id}/avaliacao`)}>+ Nova avaliação</Button>
					</div>
				{:else}
					<div class="card" style="padding:24px">
						<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
							<div style="font:500 16px var(--font-sans);color:var(--ink-0)">Avaliações recentes</div>
							<Button variant="secondary" size="sm" onclick={() => goto(`/alunos/${student.id}/avaliacao`)}>+ Nova avaliação</Button>
						</div>
						{#each detail.assessments as a, i (a.id)}
							<div
								style="display:grid;grid-template-columns:1fr 140px 1fr 20px;gap:16px;align-items:center;padding:14px 0;{i
									? 'border-top:1px solid var(--ink-line)'
									: ''}"
							>
								<span style="font:500 14px var(--font-sans);color:var(--ink-0)">
									{a.bodyFatPct != null ? 'Bioimpedância' : 'Antropometria'}
								</span>
								<span class="num" style="font:var(--label-mono);color:var(--ink-2)">{new Date(a.assessedAt).toLocaleDateString('pt-BR')}</span>
								<span style="font:var(--body-sm);color:var(--ink-1)">{a.notes ?? '—'}</span>
								<span style="color:var(--ink-2)">›</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

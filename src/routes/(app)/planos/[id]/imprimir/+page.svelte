<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const plan = $derived(data.plan);
	const planData = $derived(plan.planData);
	const sessions = $derived(planData.weekly_sessions ?? []);
	const restrictions = $derived(planData.restrictions ?? []);
	const pro = $derived(data.professional);
	const studentDetail = $derived(data.studentDetail);
	const student = $derived(studentDetail?.student);
	const hp = $derived(studentDetail?.healthProfile);
	const prefs = $derived(studentDetail?.preferences);

	const diagnoses = $derived(((hp?.diagnoses as { label: string }[] | null) ?? []).map((d) => d.label));
	const meds = $derived(
		((hp?.medications as { name: string; dose?: string; frequency?: string }[] | null) ?? []).map(
			(m) => m.name + (m.dose ? ' ' + m.dose : '') + (m.frequency ? ' · ' + m.frequency : '')
		)
	);

	const age = $derived.by(() => {
		if (!student?.birthDate) return null;
		const b = new Date(student.birthDate);
		const now = new Date();
		let a = now.getFullYear() - b.getFullYear();
		const m = now.getMonth() - b.getMonth();
		if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
		return a;
	});
	const bmi = $derived.by(() => {
		const w = student?.weightKg;
		const h = student?.heightCm;
		if (!w || !h) return null;
		return (w / Math.pow(h / 100, 2)).toFixed(1);
	});

	function levelLabel(l: string) {
		return l === 'red' ? 'CRÍTICO' : l === 'yellow' ? 'CUIDADO' : 'OK';
	}
	function levelColor(l: string) {
		return l === 'red' ? 'var(--danger)' : l === 'yellow' ? 'var(--warn)' : 'var(--success)';
	}

	function doPrint() {
		window.print();
	}

	const today = new Date().toLocaleDateString('pt-BR');
</script>

<svelte:head>
	<title>Plano · {student?.name ?? '—'} · {today}</title>
</svelte:head>

<!-- Floating actions (não imprime) -->
<div class="no-print actions-bar">
	<button class="back" onclick={() => goto(`/planos/${plan.id}`)}>← Voltar</button>
	<button class="print-btn" onclick={doPrint}>⎙ Imprimir / Salvar PDF</button>
</div>

<article class="print-doc">
	<!-- HEADER -->
	<header class="doc-header">
		<div class="brand">
			<div class="brand-mark">P</div>
			<div>
				<div class="brand-name">Preceptor Fisic</div>
				<div class="brand-tagline">Prescrição clínica · diretrizes auditáveis</div>
			</div>
		</div>
		<div class="doc-meta">
			<div class="eyebrow">PRESCRIÇÃO · {today}</div>
			<div class="doc-id">№ {plan.id.slice(0, 8).toUpperCase()}</div>
		</div>
	</header>

	<hr class="dbl-rule" />

	<!-- PROFESSIONAL + STUDENT -->
	<section class="row-2col">
		<div>
			<div class="eyebrow">Profissional</div>
			<div class="big">{pro.name}</div>
			<div class="sub">{pro.cref ?? 'CREF —'}{pro.specialty ? ' · ' + pro.specialty.replace(/_/g, ' ') : ''}</div>
		</div>
		<div>
			<div class="eyebrow">Aluno</div>
			<div class="big">{student?.name ?? '—'}</div>
			<div class="sub">
				{age ? age + ' anos · ' : ''}{student?.sex ?? ''}
				{student?.weightKg ? ' · ' + student.weightKg + 'kg' : ''}
				{student?.heightCm ? ' · ' + student.heightCm + 'cm' : ''}
				{bmi ? ' · IMC ' + bmi : ''}
			</div>
		</div>
	</section>

	<!-- CLINICAL CONTEXT -->
	{#if diagnoses.length > 0 || meds.length > 0 || hp?.cardiovascularRisk}
		<section class="block">
			<div class="eyebrow">Contexto clínico</div>
			<div class="grid-2">
				{#if diagnoses.length > 0}
					<div>
						<div class="lbl">Diagnósticos</div>
						<div class="tags">
							{#each diagnoses as d (d)}<span class="tag tag-warn">{d}</span>{/each}
						</div>
					</div>
				{/if}
				{#if meds.length > 0}
					<div>
						<div class="lbl">Medicações</div>
						<div class="tags">
							{#each meds as m (m)}<span class="tag tag-info">{m}</span>{/each}
						</div>
					</div>
				{/if}
			</div>
			{#if hp?.cardiovascularRisk}
				<div class="lbl" style="margin-top:10px">Risco cardiovascular: <span class="num">{hp.cardiovascularRisk.replace('_', ' ')}</span></div>
			{/if}
		</section>
	{/if}

	<!-- SUMMARY -->
	<section class="block">
		<div class="eyebrow">Resumo do plano</div>
		<p class="prose">{planData.summary ?? '—'}</p>
		{#if planData.progression_strategy}
			<div class="lbl" style="margin-top:14px">Estratégia de progressão</div>
			<p class="prose">{planData.progression_strategy}</p>
		{/if}
	</section>

	<!-- RESTRICTIONS -->
	{#if restrictions.length > 0}
		<section class="block">
			<div class="eyebrow">Restrições e cuidados clínicos · {restrictions.length}</div>
			{#each restrictions as r, i (i)}
				<div class="restriction-{r.level}">
					<div class="restriction-head">
						<span class="badge" style="color:{levelColor(r.level)};border-color:{levelColor(r.level)}"
							>{levelLabel(r.level)}</span
						>
						<span class="restriction-title">{r.title}</span>
					</div>
					<p class="prose">{r.description}</p>
					{#if r.affected_exercises.length > 0}
						<div class="affected">
							<span class="lbl">Exercícios afetados:</span> {r.affected_exercises.join(' · ')}
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}

	<!-- SESSIONS -->
	{#each sessions as s, i (i)}
		<section class="session" class:break-before={i > 0}>
			<header class="session-head">
				<div>
					<div class="eyebrow">Sessão {i + 1}{s.duration_minutes ? ' · ' + s.duration_minutes + ' min' : ''}</div>
					<h2 class="session-title">{s.label ?? 'Sessão ' + (i + 1)}</h2>
					{#if s.focus}<div class="sub">Foco: {s.focus}</div>{/if}
				</div>
			</header>

			{#if s.warmup && s.warmup.length > 0}
				<div class="lbl" style="margin-top:12px">Aquecimento</div>
				<table class="ex-table">
					<tbody>
						{#each s.warmup as ex, j (j)}
							<tr>
								<td class="num idx">{String(j + 1).padStart(2, '0')}</td>
								<td class="ex-name">{ex.name}</td>
								<td class="num">{ex.sets ?? '—'}×{ex.reps ?? '—'}</td>
								<td class="num">{ex.rest_seconds ?? 0}s</td>
								<td>{ex.load_guidance ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if s.main && s.main.length > 0}
				<div class="lbl" style="margin-top:14px">Sessão principal</div>
				<table class="ex-table">
					<thead>
						<tr>
							<th class="idx">#</th>
							<th>Exercício</th>
							<th class="num-col">Sets×Reps</th>
							<th class="num-col">Descanso</th>
							<th>Intensidade</th>
						</tr>
					</thead>
					<tbody>
						{#each s.main as ex, j (j)}
							<tr>
								<td class="num idx">{String(j + 1).padStart(2, '0')}</td>
								<td>
									<div class="ex-name">{ex.name}</div>
									{#if ex.muscle_groups && ex.muscle_groups.length > 0}
										<div class="ex-muscles">{ex.muscle_groups.join(' · ')}</div>
									{/if}
									{#if ex.execution_notes}
										<div class="ex-notes">{ex.execution_notes}</div>
									{/if}
									{#if ex.contraindications && ex.contraindications.length > 0}
										<div class="ex-contra">⚠ Evitar: {ex.contraindications.join('; ')}</div>
									{/if}
								</td>
								<td class="num">{ex.sets ?? '—'}×{ex.reps ?? '—'}</td>
								<td class="num">{ex.rest_seconds ?? 0}s</td>
								<td class="intensity">{ex.load_guidance ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if s.cooldown && s.cooldown.length > 0}
				<div class="lbl" style="margin-top:14px">Volta à calma</div>
				<table class="ex-table">
					<tbody>
						{#each s.cooldown as ex, j (j)}
							<tr>
								<td class="num idx">{String(j + 1).padStart(2, '0')}</td>
								<td class="ex-name">{ex.name}</td>
								<td class="num">{ex.sets ?? '—'}×{ex.reps ?? '—'}</td>
								<td class="num">{ex.rest_seconds ?? 0}s</td>
								<td>{ex.load_guidance ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/each}

	<!-- FOOTER -->
	<footer class="doc-footer">
		<hr class="dbl-rule" />
		<div class="footer-grid">
			<div>
				<div class="eyebrow">Validade</div>
				<div class="sub">Reavaliar em 4-8 semanas conforme protocolo.</div>
			</div>
			<div>
				<div class="eyebrow">Assinatura profissional</div>
				<div class="signature-line"></div>
				<div class="sub">{pro.name} · {pro.cref ?? 'CREF —'}</div>
			</div>
		</div>
		<div class="footer-disc">
			Documento gerado por Preceptor Fisic · plano #{plan.id.slice(0, 8).toUpperCase()} · {today}.
			Recomendações fundamentadas em diretrizes ACSM, ESSA, OMS e literatura peer-reviewed indexada.
		</div>
	</footer>
</article>

<style>
	:global(body) {
		background: var(--bg-0);
	}

	.no-print {
	}
	.actions-bar {
		position: fixed;
		top: 16px;
		right: 16px;
		display: flex;
		gap: 8px;
		z-index: 100;
	}
	.actions-bar .back,
	.actions-bar .print-btn {
		height: 40px;
		padding: 0 18px;
		border-radius: var(--r-2);
		cursor: pointer;
		font: 500 14px var(--font-sans);
		border: 1px solid var(--ink-line-2);
		background: var(--bg-3);
		color: var(--ink-1);
	}
	.actions-bar .print-btn {
		background: var(--accent);
		color: #0a0a0a;
		border-color: var(--accent);
		box-shadow: var(--glow-accent);
	}

	.print-doc {
		max-width: 920px;
		margin: 0 auto;
		padding: 48px 56px 80px;
		background: var(--bg-0);
		color: var(--ink-0);
		font: 400 13px/1.5 var(--font-sans);
	}

	.doc-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 18px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.brand-mark {
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
	.brand-tagline {
		font: var(--label-mono);
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 2px;
	}
	.doc-meta {
		text-align: right;
	}
	.doc-id {
		font: 500 14px var(--font-mono);
		color: var(--ink-1);
		margin-top: 4px;
	}

	.dbl-rule {
		height: 0;
		border: none;
		border-top: 1px solid var(--accent);
		border-bottom: 1px solid var(--ink-line-2);
		margin: 12px 0 18px;
		padding-top: 2px;
	}

	.eyebrow {
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-2);
	}
	.lbl {
		font: var(--label-mono);
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.big {
		font: 600 22px var(--font-sans);
		letter-spacing: -0.015em;
		margin-top: 4px;
		color: var(--ink-0);
	}
	.sub {
		font: var(--body-sm);
		color: var(--ink-2);
		margin-top: 4px;
	}
	.prose {
		font: 400 13px/1.6 var(--font-sans);
		color: var(--ink-1);
		margin: 6px 0 0;
	}

	.row-2col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
		padding: 14px 0;
		border-bottom: 1px solid var(--ink-line);
	}
	.block {
		padding: 18px 0;
		border-bottom: 1px solid var(--ink-line);
	}
	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
		margin-top: 10px;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}
	.tag {
		display: inline-flex;
		padding: 4px 10px;
		font: 500 11px var(--font-sans);
		border-radius: var(--r-pill);
		border: 1px solid;
	}
	.tag-warn {
		color: var(--warn);
		border-color: var(--warn);
		background: var(--warn-dim);
	}
	.tag-info {
		color: var(--info);
		border-color: var(--info);
		background: var(--info-dim);
	}

	.restriction-red,
	.restriction-yellow,
	.restriction-green {
		padding: 14px 18px;
		border-left: 4px solid;
		margin: 10px 0;
		page-break-inside: avoid;
	}
	.restriction-red {
		border-color: var(--danger);
		background: var(--danger-dim);
	}
	.restriction-yellow {
		border-color: var(--warn);
		background: var(--warn-dim);
	}
	.restriction-green {
		border-color: var(--success);
		background: var(--success-dim);
	}
	.restriction-head {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 4px;
	}
	.badge {
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 2px 8px;
		border-radius: var(--r-pill);
		border: 1px solid;
		background: rgba(0, 0, 0, 0.3);
	}
	.restriction-title {
		font: 600 14px var(--font-sans);
		color: var(--ink-0);
	}
	.affected {
		margin-top: 8px;
		font: var(--body-sm);
		color: var(--ink-2);
	}

	.session {
		padding: 20px 0;
		border-bottom: 1px solid var(--ink-line);
		page-break-inside: avoid;
	}
	.session.break-before {
		page-break-before: always;
	}
	.session-head {
		display: flex;
		justify-content: space-between;
	}
	.session-title {
		font: 600 22px var(--font-sans);
		letter-spacing: -0.015em;
		margin: 4px 0 0;
		color: var(--ink-0);
	}

	.ex-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 6px;
		font: 400 12.5px var(--font-sans);
	}
	.ex-table thead th {
		font: var(--label-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-2);
		text-align: left;
		padding: 8px 8px;
		border-bottom: 1px solid var(--ink-line-2);
	}
	.ex-table thead th.num-col {
		text-align: right;
	}
	.ex-table tbody td {
		padding: 10px 8px;
		border-bottom: 1px solid var(--ink-line);
		vertical-align: top;
		color: var(--ink-1);
	}
	.ex-table .idx {
		width: 32px;
		color: var(--ink-3);
	}
	.ex-table .num {
		font: 500 12px var(--font-mono);
		color: var(--ink-0);
		font-variant-numeric: tabular-nums;
		text-align: right;
		white-space: nowrap;
	}
	.ex-name {
		font: 500 13px var(--font-sans);
		color: var(--ink-0);
	}
	.ex-muscles {
		font: var(--label-mono);
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-top: 2px;
	}
	.ex-notes {
		font: 400 12px/1.5 var(--font-sans);
		color: var(--ink-2);
		margin-top: 6px;
	}
	.ex-contra {
		font: 400 12px var(--font-sans);
		color: var(--warn);
		margin-top: 4px;
	}
	.intensity {
		font: 500 11px var(--font-mono);
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.doc-footer {
		margin-top: 32px;
	}
	.footer-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}
	.signature-line {
		height: 1px;
		background: var(--ink-line-2);
		margin: 26px 0 8px;
	}
	.footer-disc {
		font: var(--label-mono);
		color: var(--ink-3);
		margin-top: 24px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	@media print {
		:global(body) {
			background: white !important;
			color: black !important;
		}
		.no-print {
			display: none !important;
		}
		.print-doc {
			max-width: 100%;
			padding: 0;
			background: white !important;
			color: black !important;
		}
		.print-doc :global(*) {
			color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
		@page {
			size: A4;
			margin: 18mm 14mm;
		}
		.brand-mark {
			background: #6d5fa3 !important;
			color: white !important;
			box-shadow: none !important;
		}
		.brand-name,
		.big,
		.session-title,
		.ex-name,
		.restriction-title {
			color: #050505 !important;
		}
		.eyebrow,
		.brand-tagline,
		.lbl,
		.ex-muscles {
			color: #6d5fa3 !important;
		}
		.sub,
		.prose,
		.affected,
		.ex-notes,
		.footer-disc {
			color: #2a2a2a !important;
		}
		.ex-table thead th {
			color: #444 !important;
			border-color: #999 !important;
		}
		.ex-table tbody td {
			color: #050505 !important;
			border-color: #ddd !important;
		}
		.dbl-rule {
			border-top-color: #6d5fa3 !important;
			border-bottom-color: #888 !important;
		}
		.tag-warn {
			background: #fff8e1 !important;
			color: #855e00 !important;
			border-color: #855e00 !important;
		}
		.tag-info {
			background: #e3f0ff !important;
			color: #1f4d80 !important;
			border-color: #1f4d80 !important;
		}
		.restriction-red {
			background: #fde7e7 !important;
			border-left-color: #c0392b !important;
		}
		.restriction-yellow {
			background: #fff8d6 !important;
			border-left-color: #b88700 !important;
		}
		.restriction-green {
			background: #e6faec !important;
			border-left-color: #1d7a3e !important;
		}
		.restriction-red,
		.restriction-yellow,
		.restriction-green {
			color: #050505 !important;
		}
		.intensity {
			color: #6d5fa3 !important;
		}
	}
</style>

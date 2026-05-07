<script lang="ts">
	import { Button, Chip, Eyebrow } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const GOALS = [
		{ id: 'emagrecimento', label: 'Emagrecimento' },
		{ id: 'hipertrofia', label: 'Hipertrofia' },
		{ id: 'forca', label: 'Força' },
		{ id: 'condicionamento_cardiovascular', label: 'Cardio' },
		{ id: 'qualidade_de_vida', label: 'Saúde geral' },
		{ id: 'reabilitacao', label: 'Reabilitação' },
		{ id: 'performance', label: 'Performance' }
	];

	const EQUIPMENT_OPTIONS = ['Halteres', 'Barra', 'Rack', 'Polia', 'Esteira', 'Bike', 'Smith', 'TRX', 'Kettlebells'];

	const v = (form as any)?.values ?? {};
	let goals = $state<string[]>(v.goals ?? []);
	let equipment = $state<string[]>(v.equipment ? v.equipment.split(',').map((x: string) => x.trim()).filter(Boolean) : []);
	let submitting = $state(false);

	function toggleGoal(g: string) {
		goals = goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g];
	}
	function toggleEquip(e: string) {
		equipment = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
	}

	function field(label: string, name: string, type = 'text', placeholder = '', value: string | number | null = '') {
		return { label, name, type, placeholder, value };
	}
</script>

<div style="flex:1;overflow-y:auto;background:var(--bg-0)">
	<header
		style="display:flex;align-items:center;gap:16px;padding:20px 32px;border-bottom:1px solid var(--ink-line);background:var(--bg-1);position:sticky;top:0;z-index:10"
	>
		<button
			onclick={() => goto('/alunos')}
			style="background:var(--bg-3);border:1px solid var(--ink-line-2);cursor:pointer;width:36px;height:36px;border-radius:var(--r-1);color:var(--ink-1);font-size:18px"
		>←</button>
		<div style="flex:1">
			<Eyebrow>Cadastro</Eyebrow>
			<h1 style="margin:4px 0 0;font:600 22px var(--font-sans);letter-spacing:-0.015em">Novo aluno</h1>
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
		style="padding:32px;max-width:780px;margin:0 auto"
	>
		{#if form?.error}
			<div
				style="padding:12px 16px;margin-bottom:20px;border-radius:var(--r-2);background:var(--danger-dim);border:1px solid var(--danger);color:var(--danger);font:var(--body-sm)"
			>
				<div style="font-weight:600;margin-bottom:4px">{form.error}</div>
				{#if (form as any)?.issues}
					<ul style="margin:6px 0 0;padding-left:18px">
						{#each (form as any).issues as issue}
							<li>{issue}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<!-- Identidade -->
		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Identidade</Eyebrow>
			<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-top:14px">
				<div>
					<label class="lbl">Nome completo *</label>
					<input class="inp" name="name" required placeholder="Ana Beatriz Silva" value={v.name ?? ''} />
				</div>
				<div>
					<label class="lbl">Data nasc.</label>
					<input class="inp" name="birthDate" type="date" value={v.birthDate ?? ''} />
				</div>
				<div>
					<label class="lbl">Sexo *</label>
					<select class="inp" name="sex" required>
						<option value="nao_informado" selected={v.sex === 'nao_informado' || !v.sex}>Não informado</option>
						<option value="feminino" selected={v.sex === 'feminino'}>Feminino</option>
						<option value="masculino" selected={v.sex === 'masculino'}>Masculino</option>
						<option value="outro" selected={v.sex === 'outro'}>Outro</option>
					</select>
				</div>
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-top:14px">
				<div>
					<label class="lbl">Peso (kg)</label>
					<input class="inp" name="weightKg" type="number" step="0.1" placeholder="62.4" value={v.weightKg ?? ''} />
				</div>
				<div>
					<label class="lbl">Altura (cm)</label>
					<input class="inp" name="heightCm" type="number" placeholder="165" value={v.heightCm ?? ''} />
				</div>
				<div>
					<label class="lbl">Telefone</label>
					<input class="inp" name="phone" placeholder="+55 11 9..." value={v.phone ?? ''} />
				</div>
				<div>
					<label class="lbl">E-mail</label>
					<input class="inp" name="email" type="email" placeholder="ana@email.com" value={v.email ?? ''} />
				</div>
			</div>
		</div>

		<!-- Perfil clínico -->
		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Perfil clínico</Eyebrow>
			<div style="display:grid;grid-template-columns:1fr;gap:14px;margin-top:14px">
				<div>
					<label class="lbl">Diagnósticos (separe por vírgula)</label>
					<textarea
						class="inp"
						name="diagnoses"
						rows="2"
						placeholder="hipertensão estágio 2, asma leve, lombalgia crônica"
						style="resize:vertical">{v.diagnoses ?? ''}</textarea>
				</div>
				<div>
					<label class="lbl">Medicações em uso (separe por vírgula)</label>
					<textarea
						class="inp"
						name="medications"
						rows="2"
						placeholder="losartana 50mg/dia, metformina 850mg 2x/dia"
						style="resize:vertical">{v.medications ?? ''}</textarea>
				</div>
				<div>
					<label class="lbl">Risco cardiovascular *</label>
					<select class="inp" name="cardiovascularRisk" required>
						<option value="baixo" selected={!v.cardiovascularRisk || v.cardiovascularRisk === 'baixo'}>Baixo</option>
						<option value="moderado" selected={v.cardiovascularRisk === 'moderado'}>Moderado</option>
						<option value="alto" selected={v.cardiovascularRisk === 'alto'}>Alto</option>
						<option value="muito_alto" selected={v.cardiovascularRisk === 'muito_alto'}>Muito alto</option>
					</select>
				</div>
			</div>
		</div>

		<!-- Preferências de treino -->
		<div class="card" style="padding:24px;margin-bottom:16px">
			<Eyebrow>Preferências de treino</Eyebrow>

			<div style="margin-top:14px">
				<label class="lbl">Objetivos (selecione 1+)</label>
				<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
					{#each GOALS as g (g.id)}
						<button
							type="button"
							onclick={() => toggleGoal(g.id)}
							style="all:unset;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--r-pill);background:{goals.includes(g.id)
								? 'var(--accent-wash)'
								: 'var(--bg-3)'};border:1px solid {goals.includes(g.id)
								? 'var(--accent)'
								: 'var(--ink-line-2)'};color:{goals.includes(g.id)
								? 'var(--accent-2)'
								: 'var(--ink-1)'};font:500 12px var(--font-sans);cursor:pointer;transition:all 140ms var(--ease)"
						>
							{goals.includes(g.id) ? '✓' : '+'} {g.label}
						</button>
					{/each}
				</div>
				{#each goals as g (g)}<input type="hidden" name="goals" value={g} />{/each}
			</div>

			<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:18px">
				<div>
					<label class="lbl">Sessões / semana *</label>
					<input class="inp" name="weeklySessions" type="number" min="1" max="7" required value={v.weeklySessions ?? 3} />
				</div>
				<div>
					<label class="lbl">Min / sessão *</label>
					<input class="inp" name="minutesPerSession" type="number" min="15" max="180" required value={v.minutesPerSession ?? 60} />
				</div>
				<div>
					<label class="lbl">Experiência *</label>
					<select class="inp" name="experienceLevel" required>
						<option value="iniciante" selected={!v.experienceLevel || v.experienceLevel === 'iniciante'}>Iniciante</option>
						<option value="intermediario" selected={v.experienceLevel === 'intermediario'}>Intermediário</option>
						<option value="avancado" selected={v.experienceLevel === 'avancado'}>Avançado</option>
					</select>
				</div>
			</div>

			<div style="margin-top:18px">
				<label class="lbl">Equipamento disponível</label>
				<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
					{#each EQUIPMENT_OPTIONS as e (e)}
						<button
							type="button"
							onclick={() => toggleEquip(e)}
							style="all:unset;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:var(--r-pill);background:{equipment.includes(e)
								? 'var(--accent-wash)'
								: 'var(--bg-3)'};border:1px solid {equipment.includes(e)
								? 'var(--accent)'
								: 'var(--ink-line-2)'};color:{equipment.includes(e)
								? 'var(--accent-2)'
								: 'var(--ink-1)'};font:500 12px var(--font-sans);cursor:pointer"
						>
							{equipment.includes(e) ? '✓' : '+'} {e}
						</button>
					{/each}
				</div>
				<input type="hidden" name="equipment" value={equipment.join(',')} />
			</div>
		</div>

		<div style="display:flex;justify-content:space-between;gap:8px;padding-top:16px;border-top:1px solid var(--ink-line)">
			<Button variant="secondary" onclick={() => goto('/alunos')}>Cancelar</Button>
			<Button type="submit" disabled={submitting} size="lg">
				{submitting ? 'Salvando…' : 'Cadastrar aluno →'}
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
	textarea.inp {
		min-height: 60px;
		padding: 10px 12px;
		height: auto;
		line-height: 1.5;
	}
	.inp:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-wash);
	}
</style>

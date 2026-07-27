<script lang="ts">
	import { Eyebrow, BrandMark } from '$lib/components/ui';

	// Recuperação é feita pelo time: a pessoa fala no WhatsApp e um admin gera
	// o link novo no CRM. Não há envio automático de e-mail (Resend não está
	// configurado), então mandar pro WhatsApp é o caminho que funciona de fato.
	const WHATSAPP = '553591481514'; // número do time, DDD 35
	const MENSAGEM =
		'Olá! Esqueci minha senha do PreceptorFISIC e gostaria de gerar um novo link de acesso.';
	const waUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAGEM)}`;
</script>

<svelte:head>
	<title>Recuperar senha · PreceptorFISIC</title>
</svelte:head>

<div class="rec-shell">
	<div class="rec-glow"></div>
	<div class="rec-frame">
		<header class="brand">
			<BrandMark size={32} />
			<div>
				<div class="brand-name">PreceptorFISIC</div>
				<div class="brand-sub">PRO · v3.2</div>
			</div>
		</header>

		<Eyebrow>◆ Recuperação de senha</Eyebrow>
		<h1 class="rec-h1">Esqueceu a senha?</h1>
		<p class="rec-sub">
			A gente gera um link de acesso novo pra você na hora. Fale com o time no WhatsApp e diga o
			e-mail que você usa pra entrar.
		</p>

		<a class="wa-btn" href={waUrl} target="_blank" rel="noopener noreferrer">
			<svg viewBox="0 0 32 32" fill="currentColor" width="20" height="20" aria-hidden="true">
				<path
					d="M16 2C8.28 2 2 8.28 2 16c0 2.5.66 4.85 1.8 6.9L2 30l7.3-1.9A13.9 13.9 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5c-2.2 0-4.3-.6-6.15-1.7l-.44-.26-4.33 1.13 1.16-4.22-.29-.45A11.4 11.4 0 0 1 4.5 16C4.5 9.66 9.66 4.5 16 4.5S27.5 9.66 27.5 16 22.34 27.5 16 27.5zm6.3-8.6c-.34-.17-2.03-1-2.35-1.12-.32-.12-.55-.17-.78.17-.23.34-.9 1.12-1.1 1.35-.2.23-.4.26-.75.09-.34-.17-1.45-.53-2.76-1.7-1.02-.9-1.7-2.03-1.9-2.37-.2-.34-.02-.52.15-.69.15-.15.34-.4.5-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.68-.57-.59-.78-.6l-.66-.01c-.23 0-.6.09-.92.43-.32.34-1.2 1.18-1.2 2.87 0 1.7 1.23 3.34 1.4 3.57.17.23 2.42 3.7 5.87 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.03-.83 2.32-1.63.29-.8.29-1.48.2-1.63-.09-.15-.32-.23-.66-.4z"
				/>
			</svg>
			Falar com o time no WhatsApp
		</a>

		<p class="rec-hint">
			Assim que você mandar a mensagem, o time gera o link e devolve por ali mesmo. É só abrir e
			escolher a nova senha.
		</p>

		<a href="/login" class="btn-link">← Voltar pro login</a>
	</div>
</div>

<style>
	.rec-shell {
		min-height: 100vh;
		background: var(--bg-0);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		position: relative;
		overflow: hidden;
	}
	.rec-glow {
		position: absolute;
		top: -240px;
		left: 50%;
		transform: translateX(-50%);
		width: 760px;
		height: 760px;
		background: radial-gradient(circle, var(--accent-glow) 0%, transparent 65%);
		pointer-events: none;
	}
	.rec-frame {
		width: 100%;
		max-width: 460px;
		background: var(--bg-1);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-3);
		padding: 36px 32px;
		position: relative;
		box-shadow: var(--shadow-pop);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 28px;
	}
	.brand-name {
		font: 600 16px var(--font-sans);
		letter-spacing: -0.015em;
	}
	.brand-sub {
		font: 500 9.5px var(--font-mono);
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-top: 2px;
	}
	.rec-h1 {
		font: 500 28px var(--font-sans);
		margin: 8px 0 8px;
		letter-spacing: -0.022em;
		color: var(--ink-0);
	}
	.rec-sub {
		font: 400 14px/1.55 var(--font-sans);
		color: var(--ink-2);
		margin: 0;
		max-width: 380px;
	}
	.wa-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		box-sizing: border-box;
		height: 50px;
		margin-top: 24px;
		border-radius: var(--r-2);
		background: var(--accent);
		color: var(--on-accent, #0a0a0a);
		font: 600 15px var(--font-sans);
		text-decoration: none;
		box-shadow: var(--glow-accent);
		transition: filter 140ms var(--ease);
	}
	.wa-btn:hover {
		filter: brightness(1.06);
	}
	.wa-btn:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 2px;
	}
	.rec-hint {
		font: 400 12.5px/1.5 var(--font-sans);
		color: var(--ink-3);
		margin: 14px 0 0;
	}
	.btn-link {
		display: block;
		text-align: center;
		margin-top: 22px;
		color: var(--ink-2);
		font: 500 13px var(--font-sans);
		text-decoration: none;
	}
	.btn-link:hover {
		color: var(--ink-0);
	}
</style>

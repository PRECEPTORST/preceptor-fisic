/**
 * Smoke E2E — caminhos críticos que NÃO podem quebrar.
 *
 * Estes testes assumem que:
 *  - Dev server roda em http://localhost:5173
 *  - .env.local aponta pro Supabase BR com dados reais
 *  - Existe sessão ativa no browser (login feito)
 *
 * Em CI, precisaria de seed do banco + login programático.
 * Por ora, smoke local que valida estrutura básica.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke — rotas públicas (não logado)', () => {
	test('login page carrega com headline', async ({ page, context }) => {
		await context.clearCookies();
		await page.goto('/login');
		// Aceita ambos: já em /login (sem sessão) ou redirecionado pra /dashboard (com sessão)
		await page.waitForLoadState('networkidle');
		const url = page.url();
		if (url.includes('/login')) {
			await expect(page.getByText(/rigor cl[íi]nico/i)).toBeVisible();
		} else {
			// Já redirecionou pra dashboard — sessão ativa, tudo bem
			expect(url).toContain('/dashboard');
		}
	});

	test('rotas protegidas redirecionam pra login quando sem sessão', async ({ page, context }) => {
		await context.clearCookies();
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login$/);
	});

	test('manifest e sw são servidos', async ({ page }) => {
		const manifest = await page.request.get('/manifest.webmanifest');
		expect(manifest.ok()).toBe(true);
		const m = await manifest.json();
		expect(m.name).toBe('Preceptor Fisic');

		const sw = await page.request.get('/sw.js');
		expect(sw.ok()).toBe(true);
	});
});

test.describe('Smoke — app do aluno (público com magic-link)', () => {
	test('rota /a/[id] com token válido renderiza saudação', async ({ page }) => {
		const studentId = 'dc02543e-b69a-4a91-bed1-220698bf4b14';
		await page.goto(`/a/${studentId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Olá/i)).toBeVisible();
	});

	test('aluno vê tab bar (Hoje · Plano · Histórico)', async ({ page }) => {
		await page.goto('/a/dc02543e-b69a-4a91-bed1-220698bf4b14');
		await expect(page.getByText('Hoje', { exact: true })).toBeVisible();
		await expect(page.getByText('Plano', { exact: true })).toBeVisible();
		await expect(page.getByText('Histórico', { exact: true })).toBeVisible();
	});
});

test.describe('Smoke — PWA', () => {
	test('app.html tem link manifest, apple-touch-icon, e SW registration', async ({ page }) => {
		const r = await page.request.get('/login');
		const html = await r.text();
		expect(html).toContain('manifest.webmanifest');
		expect(html).toContain('apple-touch-icon');
		expect(html).toContain("serviceWorker.register('/sw.js')");
	});
});

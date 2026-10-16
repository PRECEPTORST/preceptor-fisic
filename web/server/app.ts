import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '$lib/server/logger';
import { auth } from './routes/auth';
import { sessao } from './routes/sessao';
import { dashboard } from './routes/dashboard';
import { alunos } from './routes/alunos';
import { treinos } from './routes/treinos';
import { rotina } from './routes/rotina';
import { conta } from './routes/conta';
import { crm } from './routes/crm';
import { publico } from './routes/publico';
import { receberWebhookAsaas } from '$lib/server/asaas-webhook';


/**
 * API do app React. Cada domínio é um router em ./routes, montado aqui.
 * Contrato de erro: { error: string } com o status HTTP certo
 * (401 sessão, 402 sem acesso, 403 permissão, 404, 409 onboarding, 422 validação).
 */
export const app = new Hono().basePath('/api');

app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	logger.error({ err: String(err).slice(0, 500), path: c.req.path }, 'api.error');
	return c.json({ error: 'Erro interno. Tente de novo em instantes.' }, 500);
});

app.get('/health', (c) => c.json({ ok: true }));
// Webhook do Asaas: mesma URL do app antigo (configurada no painel do Asaas).
app.post('/webhooks/asaas', (c) => receberWebhookAsaas(c.req.raw));
app.route('/auth', auth);
app.route('/sessao', sessao);
app.route('/dashboard', dashboard);
app.route('/', alunos);
app.route('/', treinos);
app.route('/', rotina);
app.route('/', conta);
app.route('/', crm);
app.route('/', publico);


export type App = typeof app;

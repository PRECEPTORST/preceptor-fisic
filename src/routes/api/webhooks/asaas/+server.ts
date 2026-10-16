import type { RequestHandler } from './$types';
import { receberWebhookAsaas } from '$lib/server/asaas-webhook';

export const POST: RequestHandler = ({ request }) => receberWebhookAsaas(request);

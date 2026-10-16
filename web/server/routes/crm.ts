import { Hono } from 'hono';
import type { Vars } from '../auth';

/** API do domínio "crm", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const crm = new Hono<{ Variables: Vars }>();

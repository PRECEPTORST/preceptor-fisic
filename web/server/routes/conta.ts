import { Hono } from 'hono';
import type { Vars } from '../auth';

/** API do domínio "conta", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const conta = new Hono<{ Variables: Vars }>();

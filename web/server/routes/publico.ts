import { Hono } from 'hono';
import type { Vars } from '../auth';

/** API do domínio "publico", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const publico = new Hono<{ Variables: Vars }>();

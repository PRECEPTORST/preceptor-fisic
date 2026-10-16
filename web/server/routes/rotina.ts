import { Hono } from 'hono';
import type { Vars } from '../auth';

/** API do domínio "rotina", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const rotina = new Hono<{ Variables: Vars }>();

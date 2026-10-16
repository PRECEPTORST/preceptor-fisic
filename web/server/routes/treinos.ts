import { Hono } from 'hono';
import type { Vars } from '../auth';

/** API do domínio "treinos", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const treinos = new Hono<{ Variables: Vars }>();

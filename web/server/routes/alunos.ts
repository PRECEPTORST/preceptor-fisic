import { Hono } from 'hono';
import type { Vars } from '../auth';

/** API do domínio "alunos", montada em /api (ver app.ts). Toda rota confere dono do recurso. */
export const alunos = new Hono<{ Variables: Vars }>();

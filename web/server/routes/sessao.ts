import { Hono } from 'hono';
import { requireProfessional, requireUser, type Vars } from '../auth';
import { carregarSessao } from '$lib/server/sessao';

export const sessao = new Hono<{ Variables: Vars }>().get('/', requireUser, requireProfessional, async (c) =>
	c.json(await carregarSessao(c.get('professional'), c.get('user')))
);

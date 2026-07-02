import { json, error } from '@sveltejs/kit';
import { getProfessionalByAuthId, searchExerciseCatalog } from '$lib/server/queries';
import type { RequestHandler } from './$types';

/**
 * Busca no catálogo de exercícios (ExerciseDB Pro) pra o seletor de "trocar /
 * adicionar exercício" na revisão do plano. Só profissional autenticado.
 * Retorna itens compactos (o vídeo/instruções completos vêm depois, do
 * catalogMap do plano, quando o exercício já está no plano com catalog_id).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401, 'não autenticado');
	const professional = await getProfessionalByAuthId(locals.user.id);
	if (!professional) error(401, 'professional não encontrado');

	const q = url.searchParams.get('q')?.trim() || undefined;
	const bodyPart = url.searchParams.get('bodyPart')?.trim() || undefined;
	const equipment = url.searchParams.get('equipment')?.trim() || undefined;

	const { items, total } = await searchExerciseCatalog({
		query: q,
		bodyPart,
		equipment,
		limit: 40
	});

	return json({
		total,
		items: items.map((c) => ({
			id: c.id,
			externalId: c.externalId,
			name: c.name,
			bodyPart: c.bodyPart,
			targetMuscle: c.targetMuscle,
			equipment: c.equipment,
			difficulty: c.difficulty,
			hasVideo: Boolean(c.videoUrl)
		}))
	});
};

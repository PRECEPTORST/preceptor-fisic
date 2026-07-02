import { error } from '@sveltejs/kit';
import { searchExerciseCatalog, getCatalogFacets } from '$lib/server/queries';
import { toIntInRange } from '$lib/server/validation';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 48;

export const load = (async ({ parent, url }) => {
	const { professional } = await parent();
	if (!professional) error(401, 'não autenticado');

	const query = url.searchParams.get('q') ?? undefined;
	const bodyPart = url.searchParams.get('bp') ?? undefined;
	const equipment = url.searchParams.get('eq') ?? undefined;
	const difficulty = url.searchParams.get('diff') ?? undefined;
	// ?page=abc → NaN → OFFSET NaN → erro de SQL (500). Saneia pra inteiro >= 1.
	let page = toIntInRange(url.searchParams.get('page') ?? '1', {
		min: 1,
		max: 100000,
		fallback: 1
	});

	let [{ items, total }, facets] = await Promise.all([
		searchExerciseCatalog({
			query,
			bodyPart,
			equipment,
			difficulty,
			limit: PAGE_SIZE,
			offset: (page - 1) * PAGE_SIZE
		}),
		getCatalogFacets()
	]);

	// URL antiga ou catálogo encolhido por filtro: clampa pra última página válida
	// em vez de cair no empty state com total > 0.
	const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
	if (page > maxPage && total > 0) {
		page = maxPage;
		({ items } = await searchExerciseCatalog({
			query,
			bodyPart,
			equipment,
			difficulty,
			limit: PAGE_SIZE,
			offset: (page - 1) * PAGE_SIZE
		}));
	}

	return {
		items,
		total,
		facets,
		page,
		pageSize: PAGE_SIZE,
		filters: {
			query: query ?? '',
			bodyPart: bodyPart ?? '',
			equipment: equipment ?? '',
			difficulty: difficulty ?? ''
		}
	};
}) satisfies PageServerLoad;

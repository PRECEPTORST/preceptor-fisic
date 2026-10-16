/**
 * Leituras do app do aluno (/a/[id]) que viviam dentro dos +page.server.ts.
 * Extraídas para cá sem mudar a lógica, para a API do app React usar as
 * mesmas consultas (regra 1 do web/README.md). O SvelteKit pode passar a usar
 * também; por ora as páginas dele seguem com a cópia local.
 *
 * Todas pressupõem que o chamador JÁ validou o token do aluno.
 */
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './db';
import { exerciseCatalog, students, trainingSessions } from './db/schema';
import { matchCatalogByName, type PlanData, type PlanSessionData } from './queries';

const CATALOG_ID = /^\d{4,5}$/;

function catalogIdOf(ex: unknown): string | undefined {
	const cid = (ex as { catalog_id?: string }).catalog_id;
	return typeof cid === 'string' && CATALOG_ID.test(cid) ? cid : undefined;
}

/** catalog_id → videoUrl de todos os exercícios do plano (1 consulta). Falha vira {}. */
export async function getAlunoVideoByCatalogId(
	planData: PlanData | null | undefined
): Promise<Record<string, string>> {
	const out: Record<string, string> = {};
	const ids = new Set<string>();
	for (const s of planData?.weekly_sessions ?? []) {
		for (const block of [s.warmup ?? [], s.main ?? [], s.cooldown ?? []]) {
			for (const ex of block) {
				const cid = catalogIdOf(ex);
				if (cid) ids.add(cid);
			}
		}
	}
	if (ids.size === 0) return out;
	try {
		const rows = await db
			.select({ externalId: exerciseCatalog.externalId, videoUrl: exerciseCatalog.videoUrl })
			.from(exerciseCatalog)
			.where(inArray(exerciseCatalog.externalId, [...ids]));
		for (const r of rows) if (r.videoUrl) out[r.externalId] = r.videoUrl;
	} catch (err) {
		console.error('home.video_lookup.failed', String(err).slice(0, 200));
	}
	return out;
}

export type AlunoVideoMap = Record<string, { videoUrl: string | null; instructions: string[] }>;

/**
 * Vídeo e instruções por NOME de exercício da sessão, em duas passadas:
 * catalog_id direto (1 consulta) e depois busca aproximada por nome.
 */
export async function getAlunoSessionVideoMap(session: PlanSessionData): Promise<AlunoVideoMap> {
	const all = [...(session.warmup ?? []), ...(session.main ?? []), ...(session.cooldown ?? [])];
	const videoMap: AlunoVideoMap = {};

	const catalogIds = [...new Set(all.map(catalogIdOf).filter((x): x is string => !!x))];
	if (catalogIds.length > 0) {
		const rows = await db
			.select({
				externalId: exerciseCatalog.externalId,
				videoUrl: exerciseCatalog.videoUrl,
				instructions: exerciseCatalog.instructions
			})
			.from(exerciseCatalog)
			.where(inArray(exerciseCatalog.externalId, catalogIds));
		const byExternal = new Map(rows.map((r) => [r.externalId, r]));
		for (const ex of all) {
			const cid = catalogIdOf(ex);
			const c = cid ? byExternal.get(cid) : undefined;
			if (c) videoMap[ex.name] = { videoUrl: c.videoUrl, instructions: c.instructions ?? [] };
		}
	}

	const missing = [...new Set(all.map((e) => e.name).filter((n) => n && !videoMap[n]))];
	await Promise.all(
		missing.map(async (name) => {
			const match = await matchCatalogByName(name);
			if (match) videoMap[name] = { videoUrl: match.videoUrl, instructions: match.instructions };
		})
	);
	return videoMap;
}

/** Histórico do aluno: as 50 sessões mais recentes e o total real. null se o aluno não existe. */
export async function getAlunoHistorico(studentId: string) {
	// isNull(deletedAt): aluno excluído não segue acessível pelo link antigo (LGPD).
	const [s] = await db
		.select({ id: students.id, name: students.name })
		.from(students)
		.where(and(eq(students.id, studentId), isNull(students.deletedAt)))
		.limit(1);
	if (!s) return null;

	const sessions = await db
		.select()
		.from(trainingSessions)
		.where(eq(trainingSessions.studentId, studentId))
		.orderBy(desc(trainingSessions.sessionDate))
		.limit(50);

	const [countRow] = await db
		.select({ total: count() })
		.from(trainingSessions)
		.where(eq(trainingSessions.studentId, studentId));

	return {
		student: s,
		total: countRow?.total ?? sessions.length,
		sessions: sessions.map((row) => ({
			id: row.id,
			sessionDate: row.sessionDate.toISOString(),
			sessionLabel: row.sessionLabel,
			perceivedEffort: row.perceivedEffort,
			observations: row.observations,
			exercisesDone: row.exercisesDone
		}))
	};
}

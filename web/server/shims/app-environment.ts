// Shim de `$app/environment` fora do SvelteKit.
// `dev` libera atalhos de desenvolvimento (ex.: ALUNO_LINK_DEV_BYPASS). Por isso
// nunca é true na Vercel, e o build da Function fixa NODE_ENV=production.
export const dev = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
export const building = false;
export const browser = false;
export const version = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev';

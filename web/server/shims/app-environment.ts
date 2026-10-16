// Shim de `$app/environment` fora do SvelteKit.
export const dev = process.env.NODE_ENV !== 'production';
export const building = false;
export const browser = false;
export const version = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev';

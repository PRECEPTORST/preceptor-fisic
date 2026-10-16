// Shim de `$env/dynamic/private` para o código de src/lib/server rodar fora do SvelteKit.
export const env = process.env as Record<string, string | undefined>;

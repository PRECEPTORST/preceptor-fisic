// Shim de `$env/dynamic/public`. No servidor, as PUBLIC_* também vêm de process.env.
export const env = process.env as Record<string, string | undefined>;

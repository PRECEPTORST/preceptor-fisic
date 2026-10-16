// Mesmo canal de src/lib/contato.ts (LGPD art. 18). PUBLIC_CONTATO_EMAIL sobrescreve no build.
export const CONTATO_EMAIL: string =
  (import.meta.env.PUBLIC_CONTATO_EMAIL as string | undefined) || "preceptorfisic@ospreceptores.com";

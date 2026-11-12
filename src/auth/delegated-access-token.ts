/**
 * Internal stdio delegated-auth plumbing for trusted subprocess MCP callers.
 * Not part of the public MCP tool contract.
 */
export const STDIO_DELEGATED_ACCESS_TOKEN_ARG = '_stdio_delegated_google_access_token';

/** Env flag: when true, honor runtime stdio delegated token on stdio tool calls. */
export const STDIO_DELEGATED_ACCESS_TOKEN_ENV = 'GCNV_STDIO_DELEGATED_ACCESS_TOKEN';

/** When true, honor runtime-injected delegated tokens from trusted stdio callers. */
export function isDelegatedAccessTokenEnabled(): boolean {
  const raw = process.env[STDIO_DELEGATED_ACCESS_TOKEN_ENV]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

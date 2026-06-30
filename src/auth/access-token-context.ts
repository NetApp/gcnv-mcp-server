import { AsyncLocalStorage } from 'node:async_hooks';

const requestTokenStorage = new AsyncLocalStorage<string | undefined>();

/**
 * Run `fn` with a per-request access token visible to {@link currentRequestAccessToken}.
 * Used by the HTTP/SSE transport when forwarding Authorization (or GCNV_AUTH_HEADER).
 */
export function runWithRequestAccessToken<T>(
  token: string | undefined,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return requestTokenStorage.run(token, fn);
}

/** Token extracted from the inbound MCP HTTP request, if any. */
export function currentRequestAccessToken(): string | undefined {
  return requestTokenStorage.getStore();
}

function parseBearerHeader(headerValue: string | undefined): string | undefined {
  if (!headerValue?.trim()) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match?.[1]?.trim() || undefined;
}

/**
 * Extract bearer token from an HTTP request using GCNV_AUTH_HEADER (default Authorization).
 */
export function accessTokenFromHttpHeaders(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const headerName = (process.env.GCNV_AUTH_HEADER || 'Authorization').trim().toLowerCase();
  const raw = headers[headerName];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parseBearerHeader(typeof value === 'string' ? value : undefined);
}

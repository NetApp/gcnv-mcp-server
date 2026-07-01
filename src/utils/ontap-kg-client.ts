import { logger } from '../logger.js';

const log = logger.child({ module: 'ontap-kg-client' });

type DiscoverKind = 'categories' | 'resource' | 'search';

export interface KgDiscoverRequest {
  schemaVersion: 'ontap-kg/1';
  kind: DiscoverKind;
  resource?: string;
  search?: string;
  max_results?: number;
  context?: {
    user_intent?: string;
    client?: {
      name: string;
      version: string;
    };
    session_id?: string;
  };
}

export interface KgDiscoverResponse {
  schemaVersion: 'ontap-kg/1';
  kind: DiscoverKind;
  categories?: Array<{ resource: string; count: number }>;
  endpoints?: Array<Record<string, unknown>>;
  suggestion?: string;
  note?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCategoryEntry(value: unknown): value is { resource: string; count: number } {
  return isObject(value) && typeof value.resource === 'string' && typeof value.count === 'number';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isKgEndpointEntry(value: unknown): value is Record<string, unknown> {
  return (
    isObject(value) &&
    (value.resource === undefined || typeof value.resource === 'string') &&
    typeof value.method === 'string' &&
    typeof value.path === 'string' &&
    isStringArray(value.pathParams) &&
    typeof value.description === 'string' &&
    (typeof value.hint === 'string' || value.hint === null) &&
    isStringArray(value.keywords) &&
    Object.prototype.hasOwnProperty.call(value, 'body')
  );
}

function validateKgResponse(value: unknown, requestKind: DiscoverKind): KgDiscoverResponse | null {
  if (!isObject(value)) return null;
  if (value.schemaVersion !== 'ontap-kg/1') return null;
  if (value.kind !== requestKind) return null;

  const response: KgDiscoverResponse = {
    schemaVersion: 'ontap-kg/1',
    kind: requestKind,
  };

  if (requestKind === 'categories') {
    const categories = value.categories;
    if (!Array.isArray(categories)) return null;
    if (!categories.every(isCategoryEntry)) return null;
    response.categories = categories;
  } else {
    const endpoints = value.endpoints;
    if (!Array.isArray(endpoints)) return null;
    if (!endpoints.every(isKgEndpointEntry)) return null;
    response.endpoints = endpoints;
  }

  if (typeof value.suggestion === 'string') response.suggestion = value.suggestion;
  if (typeof value.note === 'string') response.note = value.note;

  return response;
}

export async function discoverViaKg(
  request: KgDiscoverRequest
): Promise<KgDiscoverResponse | null> {
  const endpoint = process.env.ONTAP_KG_URL?.trim();
  if (!endpoint) return null;

  const timeoutMsRaw = Number.parseInt(process.env.ONTAP_KG_TIMEOUT_MS || '5000', 10);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 5000;
  const authToken = process.env.ONTAP_KG_AUTH_TOKEN?.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      log.warn({ status: response.status, endpoint }, 'KG discover request failed');
      return null;
    }

    const payload = (await response.json()) as unknown;
    return validateKgResponse(payload, request.kind);
  } catch (err) {
    log.warn({ err, endpoint }, 'KG discover request failed');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

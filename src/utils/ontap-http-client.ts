import { GoogleAuth } from 'google-auth-library';
import { sleep } from './sleep.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'ontap-http-client' });

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

/**
 * Node/undici transport-error codes that indicate the request failed before
 * any HTTP response was received. These are safe to retry on idempotent
 * methods (GET) because no server-side side effect could have taken hold.
 */
const RETRYABLE_TRANSPORT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

function isRetryableTransportError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: unknown; cause?: { code?: unknown }; message?: unknown };
  const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
  const causeCode = typeof anyErr.cause?.code === 'string' ? anyErr.cause.code : undefined;
  if (code && RETRYABLE_TRANSPORT_CODES.has(code)) return true;
  if (causeCode && RETRYABLE_TRANSPORT_CODES.has(causeCode)) return true;
  // Node's undici surfaces generic transport failures as `TypeError: fetch failed`
  // with the underlying socket error nested in `cause`. Treat any cause-bearing
  // fetch failure as transient on idempotent methods.
  if (typeof anyErr.message === 'string' && anyErr.message === 'fetch failed') return true;
  return false;
}

/**
 * Authenticated HTTP client for ONTAP Proxy API calls.
 *
 * Constructs the ONTAP proxy URL directly from GCP identifiers — no UUID
 * resolution needed. The proxy URL pattern (from Google Cloud docs) is:
 *   /v1beta1/projects/{project}/locations/{location}/storagePools/{pool}/ontap/{path}
 *
 * Features:
 *   - Adds Authorization: Bearer token via Google ADC
 *   - Wraps POST/PATCH bodies in { body: <payload> } envelope
 *   - Unwraps { rawResponse: <data> } from proxy responses
 *
 * Base URL resolution order:
 *   GCNV_API_ENDPOINT (if set, for a non-production API endpoint) → https://netapp.googleapis.com
 */
export class OntapHttpClient {
  private static clientCache: Record<string, OntapHttpClient> = {};
  private static sharedAuth: GoogleAuth | null = null;

  private readonly baseUrl: string;

  private constructor(projectId: string, locationId: string, storagePoolId: string) {
    if (!projectId || !locationId || !storagePoolId) {
      throw new Error(
        `Missing required ONTAP client parameters: projectId="${projectId}", locationId="${locationId}", storagePoolId="${storagePoolId}". ` +
          'All three are required. Use gcnv_storage_pool_list to find these values.'
      );
    }

    const rawEndpoint = (process.env.GCNV_API_ENDPOINT || 'https://netapp.googleapis.com').trim();
    const stripped = rawEndpoint.replace(/\/+$/, '');
    const endpoint =
      stripped.startsWith('https://') || stripped.startsWith('http://')
        ? stripped
        : `https://${stripped}`;

    this.baseUrl = `${endpoint}/v1beta1/projects/${projectId}/locations/${locationId}/storagePools/${storagePoolId}/ontap`;
    log.info({ baseUrl: this.baseUrl }, 'OntapHttpClient initialized');
  }

  private static getAuth(): GoogleAuth {
    if (!this.sharedAuth) {
      this.sharedAuth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }
    return this.sharedAuth;
  }

  /**
   * Returns an OntapHttpClient for the given pool.
   * Clients are cached by (projectId, locationId, storagePoolId).
   * The storagePoolId is the GCP resource name (e.g. "my-pool"), used
   * directly in the proxy URL — no UUID resolution required.
   */
  static create(projectId: string, locationId: string, storagePoolId: string): OntapHttpClient {
    const cacheKey = `${projectId}/${locationId}/${storagePoolId}`;
    if (this.clientCache[cacheKey]) {
      return this.clientCache[cacheKey];
    }
    const client = new OntapHttpClient(projectId, locationId, storagePoolId);
    this.clientCache[cacheKey] = client;
    return client;
  }

  static clearCache(): void {
    this.clientCache = {};
    this.sharedAuth = null;
  }

  private async getAccessToken(): Promise<string> {
    const token = await OntapHttpClient.getAuth().getAccessToken();
    if (!token) {
      throw new Error('Failed to obtain GCP access token for ONTAP proxy request.');
    }
    return token;
  }

  /**
   * Core request method with body envelope wrapping, rawResponse unwrapping,
   * and automatic retry for transient errors on idempotent GET requests only.
   */
  async request<T = unknown>(
    method: string,
    subPath: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const token = await this.getAccessToken();
    let url = `${this.baseUrl}${subPath}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      url = `${url}?${new URLSearchParams(queryParams).toString()}`;
    }

    const needsEnvelope = method === 'POST' || method === 'PATCH';
    const envelope = body !== undefined && needsEnvelope ? { body } : body;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      log.info({ method, path: subPath, url, attempt }, 'ONTAP proxy request');

      let response: Response;
      const startMs = Date.now();
      try {
        response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: envelope !== undefined ? JSON.stringify(envelope) : undefined,
        });
      } catch (fetchErr: any) {
        const transient = isRetryableTransportError(fetchErr);
        const canRetry = transient && method === 'GET' && attempt < MAX_ATTEMPTS;
        if (canRetry) {
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          log.warn(
            { method, url, attempt, delayMs, err: fetchErr?.message ?? String(fetchErr) },
            'Transient transport error, backing off'
          );
          await sleep(delayMs);
          continue;
        }

        log.error({ method, url, attempt, err: fetchErr }, 'fetch() failed');
        const detail = fetchErr?.message ?? String(fetchErr);
        const hint = transient
          ? 'Transient network error talking to the ONTAP proxy. Retry the request.'
          : 'Verify projectId, locationId, and storagePoolId are correct.';
        throw new Error(`ONTAP proxy fetch failed for ${method} ${url}: ${detail}. ${hint}`, {
          cause: fetchErr,
        });
      }

      const text = await response.text();
      const latencyMs = Date.now() - startMs;
      log.info(
        { method, path: subPath, status: response.status, latencyMs, attempt },
        'ONTAP proxy response'
      );

      if (response.ok) {
        if (!text) return {} as T;
        let data = JSON.parse(text);
        if (data && typeof data === 'object' && 'rawResponse' in data) {
          data = data.rawResponse;
        }
        if (data && typeof data === 'object' && 'body' in data) {
          data = data.body;
        }
        return data as T;
      }

      const mayRetry =
        method === 'GET' && RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS;
      if (mayRetry) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        log.warn(
          { method, path: subPath, status: response.status, latencyMs, attempt, delayMs },
          'Retryable error, backing off'
        );
        await sleep(delayMs);
        continue;
      }

      log.error(
        { method, path: subPath, status: response.status, latencyMs, attempt },
        'ONTAP proxy request failed'
      );
      throw new Error(`ONTAP proxy returned ${response.status}: ${text}`);
    }

    throw new Error('ONTAP proxy request failed after maximum retry attempts');
  }

  async get<T = unknown>(subPath: string, queryParams?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', subPath, undefined, queryParams);
  }

  async post<T = unknown>(
    subPath: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', subPath, body, queryParams);
  }

  async patch<T = unknown>(
    subPath: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('PATCH', subPath, body, queryParams);
  }
}

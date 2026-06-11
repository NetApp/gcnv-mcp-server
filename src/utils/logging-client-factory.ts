import { Logging } from '@google-cloud/logging';

/**
 * Factory for creating `@google-cloud/logging` clients used by the GCNV
 * logs / errors / events tools.
 *
 * Mirrors {@link NetAppClientFactory}: it centralizes client creation, caches
 * instances per project, and reuses the same Google Cloud Application Default
 * Credentials (ADC / GOOGLE_APPLICATION_CREDENTIALS) as the rest of the server.
 * No additional configuration or credentials are required beyond
 * `roles/logging.viewer` on the service account.
 */
export class LoggingClientFactory {
  private static clientCache: { [key: string]: Logging } = {};

  /**
   * Create (or return a cached) Logging client.
   *
   * @param projectId - GCP project whose logs will be read. Used both to scope
   *   queries and as the cache key.
   * @returns A configured Logging client.
   */
  public static createClient(projectId?: string): Logging {
    const cacheKey = projectId ?? '__default__';
    if (this.clientCache[cacheKey]) {
      return this.clientCache[cacheKey];
    }

    const client = projectId ? new Logging({ projectId }) : new Logging();
    this.clientCache[cacheKey] = client;
    return client;
  }

  /** Clear the client cache (useful for tests or credential rotation). */
  public static clearCache(): void {
    this.clientCache = {};
  }

  /** Reset the factory to its initial state. */
  public static reset(): void {
    this.clearCache();
  }
}

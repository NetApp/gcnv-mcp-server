import { NetAppClient } from '@google-cloud/netapp';
import { OAuth2Client } from 'google-auth-library';
import { currentRequestAccessToken } from '../auth/access-token-context.js';

type ClientOptions = NonNullable<ConstructorParameters<typeof NetAppClient>[0]>;

/**
 * Builds google-gax ClientOptions from a trimmed {@link process.env.GCNV_API_ENDPOINT}.
 *
 * Empty input leaves NetApp client defaults unchanged. HTTPS URLs and bare
 * hostnames are passed through as {@code apiEndpoint}. HTTP URLs set host, port,
 * and REST fallback for non-TLS API stand-ins used in development or tests.
 */
export function clientOptionsFromGcnvApiEndpoint(trimmed: string): ClientOptions {
  if (!trimmed) {
    return {};
  }
  if (trimmed.toLowerCase().startsWith('http://')) {
    const url = new URL(trimmed);
    const port = url.port ? Number.parseInt(url.port, 10) : 80;
    return {
      apiEndpoint: url.hostname,
      port,
      fallback: 'rest',
      protocol: 'http',
    };
  }
  return { apiEndpoint: trimmed };
}

/**
 * Factory class for creating NetAppClient instances
 * This centralizes client creation and allows for easier testing and configuration
 */
export class NetAppClientFactory {
  // Cache for storing client instances (singleton pattern)
  private static clientCache: { [key: string]: NetAppClient } = {};

  // Default configuration that will be used if no specific options are provided
  private static defaultConfig: ClientOptions = {
    timeout: 60000,
    retry: {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 5,
    },
  };

  /**
   * Create a new NetAppClient instance
   *
   * @param options - Options for the NetApp client, will override default config if both exist
   * @param cacheKey - Optional key for caching the client instance
   * @returns A configured NetAppClient instance
   */
  public static createClient(options?: ClientOptions, cacheKey?: string): NetAppClient {
    const requestAccessToken = currentRequestAccessToken();

    // If a cache key is provided and a client exists, return the cached client
    if (!requestAccessToken && cacheKey && this.clientCache[cacheKey]) {
      return this.clientCache[cacheKey];
    }

    // Apply GCNV_API_ENDPOINT when set (custom or sandbox API host).
    const envEndpoint = process.env.GCNV_API_ENDPOINT?.trim();
    const envOptions: ClientOptions = envEndpoint
      ? clientOptionsFromGcnvApiEndpoint(envEndpoint)
      : {};

    // Merge default config, env-based apiEndpoint (if set), and provided options; options take precedence
    let mergedOptions: ClientOptions | undefined;

    if (this.defaultConfig || Object.keys(envOptions).length > 0 || options) {
      mergedOptions = {
        ...(this.defaultConfig || {}),
        ...envOptions,
        ...(options || {}),
      };
    }

    const clientOptions: ClientOptions = {
      ...(mergedOptions || {}),
    };

    if (requestAccessToken) {
      const authClient = new OAuth2Client();
      authClient.setCredentials({ access_token: requestAccessToken });
      clientOptions.authClient = authClient;
    }

    const client = new NetAppClient(clientOptions);

    // If a cache key is provided, store the client for future use
    if (!requestAccessToken && cacheKey) {
      this.clientCache[cacheKey] = client;
    }

    return client;
  }

  /**
   * Clear the client cache
   * Useful for testing or when configuration changes
   */
  public static clearCache(): void {
    this.clientCache = {};
  }

  /**
   * Reset the factory to its initial state
   * Clears both the cache and default configuration
   */
  public static reset(): void {
    this.clearCache();
  }
}

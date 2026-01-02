import { NetAppClient } from '@google-cloud/netapp';
import { ClientOptions } from 'google-gax';

/**
 * Factory class for creating NetAppClient instances
 * This centralizes client creation and allows for easier testing and configuration
 */
export class NetAppClientFactory {
  // Cache for storing client instances (singleton pattern)
  private static clientCache: { [key: string]: NetAppClient } = {};

  // Default configuration that will be used if no specific options are provided
  private static defaultConfig: ClientOptions = {
    // Default API endpoint
    // apiEndpoint: 'autopush-netapp.sandbox.googleapis.com',

    // Default timeout in milliseconds
    timeout: 60000,

    // Default retry configuration
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
    // If a cache key is provided and a client exists, return the cached client
    if (cacheKey && this.clientCache[cacheKey]) {
      return this.clientCache[cacheKey];
    }

    // Merge default config with provided options, with options taking precedence
    let mergedOptions: ClientOptions | undefined;

    if (this.defaultConfig || options) {
      mergedOptions = {
        ...(this.defaultConfig || {}),
        ...(options || {}),
      };
    }

    // Create a new client with the merged options
    const client = mergedOptions ? new NetAppClient(mergedOptions) : new NetAppClient();

    // If a cache key is provided, store the client for future use
    if (cacheKey) {
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

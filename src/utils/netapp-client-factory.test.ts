import { describe, expect, it, beforeEach, vi } from 'vitest';

const NetAppClientCtor = vi.fn();

vi.mock('@google-cloud/netapp', () => {
  return {
    NetAppClient: function MockNetAppClient(this: any, opts?: any) {
      NetAppClientCtor(opts);
      this.__opts = opts;
    },
  };
});

describe('NetAppClientFactory', () => {
  beforeEach(async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');
    NetAppClientFactory.reset();
    NetAppClientCtor.mockClear();
  });

  it('creates a new client and caches it when cacheKey is provided', async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');

    const c1 = NetAppClientFactory.createClient(undefined, 'k1');
    const c2 = NetAppClientFactory.createClient(undefined, 'k1');

    expect(c1).toBe(c2);
    expect(NetAppClientCtor).toHaveBeenCalledTimes(1);
  });

  it('passes options to NetAppClient constructor', async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');

    const opts = { apiEndpoint: 'example.local', timeout: 1234 } as any;
    const client = NetAppClientFactory.createClient(opts);

    expect(NetAppClientCtor).toHaveBeenCalledTimes(1);
    expect((client as any).__opts).toMatchObject(opts);
  });

  it('uses default config when no options are provided', async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');

    const client = NetAppClientFactory.createClient();

    expect(NetAppClientCtor).toHaveBeenCalledTimes(1);
    // Default config is now always applied
    expect((client as any).__opts).toMatchObject({
      timeout: 60000,
      retry: expect.objectContaining({ maxRetries: 5 }),
    });
  });

  it('falls back to constructing NetAppClient without options when defaultConfig is unset', async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');

    // Force the else-path for mergedOptions/client construction for coverage
    (NetAppClientFactory as any).defaultConfig = undefined;

    const client = NetAppClientFactory.createClient();

    expect(NetAppClientCtor).toHaveBeenCalledTimes(1);
    expect((client as any).__opts).toBeUndefined();
  });

  it('merges options even when defaultConfig is unset (covers spread fallback branch)', async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');
    (NetAppClientFactory as any).defaultConfig = undefined;

    const client = NetAppClientFactory.createClient({ timeout: 123 } as any);

    expect(NetAppClientCtor).toHaveBeenCalledTimes(1);
    expect((client as any).__opts).toMatchObject({ timeout: 123 });
  });

  it('clearCache causes subsequent calls with same cacheKey to create a new client', async () => {
    const { NetAppClientFactory } = await import('./netapp-client-factory.js');

    const c1 = NetAppClientFactory.createClient(undefined, 'k2');
    NetAppClientFactory.clearCache();
    const c2 = NetAppClientFactory.createClient(undefined, 'k2');

    expect(c1).not.toBe(c2);
    expect(NetAppClientCtor).toHaveBeenCalledTimes(2);
  });
});

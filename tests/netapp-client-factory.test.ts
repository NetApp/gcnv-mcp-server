import { describe, expect, beforeEach, it, vi } from 'vitest';

const constructorSpy = vi.hoisted(() =>
  vi.fn(function (this: any, options?: Record<string, unknown>) {
    this.options = options;
  }),
);

vi.mock('@google-cloud/netapp', () => ({
  __esModule: true,
  NetAppClient: constructorSpy,
}));

import { NetAppClientFactory } from '../src/utils/netapp-client-factory.js';

describe('NetAppClientFactory', () => {
  beforeEach(() => {
    constructorSpy.mockClear();
    NetAppClientFactory.reset();
  });

  it('creates a new client when no cache key is provided', () => {
    const clientA = NetAppClientFactory.createClient();
    const clientB = NetAppClientFactory.createClient();

    expect(clientA).not.toBe(clientB);
    expect(constructorSpy).toHaveBeenCalledTimes(2);
  });

  it('returns the cached client when cache key matches', () => {
    const clientA = NetAppClientFactory.createClient(undefined, 'primary');
    const clientB = NetAppClientFactory.createClient(undefined, 'primary');

    expect(clientA).toBe(clientB);
    expect(constructorSpy).toHaveBeenCalledTimes(1);
  });

  it('passes merged options to the client constructor', () => {
    const options = { timeout: 1234 };
    NetAppClientFactory.createClient(options);

    expect(constructorSpy).toHaveBeenCalledWith(expect.objectContaining(options));
  });
});


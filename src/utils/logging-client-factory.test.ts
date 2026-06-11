import { describe, expect, it, beforeEach, vi } from 'vitest';

const LoggingCtor = vi.fn();

vi.mock('@google-cloud/logging', () => {
  return {
    Logging: function MockLogging(this: any, opts?: any) {
      LoggingCtor(opts);
      this.__opts = opts;
    },
  };
});

describe('LoggingClientFactory', () => {
  beforeEach(async () => {
    const { LoggingClientFactory } = await import('./logging-client-factory.js');
    LoggingClientFactory.reset();
    LoggingCtor.mockClear();
  });

  it('creates and caches a client per project id', async () => {
    const { LoggingClientFactory } = await import('./logging-client-factory.js');
    const c1 = LoggingClientFactory.createClient('proj-1');
    const c2 = LoggingClientFactory.createClient('proj-1');
    expect(c1).toBe(c2);
    expect(LoggingCtor).toHaveBeenCalledTimes(1);
    expect((c1 as any).__opts).toEqual({ projectId: 'proj-1' });
  });

  it('uses a separate cache entry per project id', async () => {
    const { LoggingClientFactory } = await import('./logging-client-factory.js');
    const c1 = LoggingClientFactory.createClient('proj-1');
    const c2 = LoggingClientFactory.createClient('proj-2');
    expect(c1).not.toBe(c2);
    expect(LoggingCtor).toHaveBeenCalledTimes(2);
  });

  it('constructs without options when no project id is given', async () => {
    const { LoggingClientFactory } = await import('./logging-client-factory.js');
    const client = LoggingClientFactory.createClient();
    expect((client as any).__opts).toBeUndefined();
  });

  it('clearCache forces a new client for the same project id', async () => {
    const { LoggingClientFactory } = await import('./logging-client-factory.js');
    const c1 = LoggingClientFactory.createClient('proj-1');
    LoggingClientFactory.clearCache();
    const c2 = LoggingClientFactory.createClient('proj-1');
    expect(c1).not.toBe(c2);
    expect(LoggingCtor).toHaveBeenCalledTimes(2);
  });
});

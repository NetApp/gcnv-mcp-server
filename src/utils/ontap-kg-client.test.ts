import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ontap-kg-client discoverViaKg', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.ONTAP_KG_URL;
    delete process.env.ONTAP_KG_TIMEOUT_MS;
    delete process.env.ONTAP_KG_AUTH_TOKEN;
  });

  it('returns null when ONTAP_KG_URL is unset', async () => {
    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const result = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'categories',
    });
    expect(result).toBeNull();
  });

  it('posts discover request and returns validated categories payload', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover';
    process.env.ONTAP_KG_AUTH_TOKEN = 'tok';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 'ontap-kg/1',
        kind: 'categories',
        categories: [{ resource: 'volume', count: 2 }],
        suggestion: 'next',
      }),
    } as any);

    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const result = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'categories',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://kg.example/discover',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
        }),
      })
    );
    expect(result).toEqual({
      schemaVersion: 'ontap-kg/1',
      kind: 'categories',
      categories: [{ resource: 'volume', count: 2 }],
      suggestion: 'next',
    });
  });

  it('returns null for non-ok responses or malformed payload', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover/';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ schemaVersion: 'wrong', kind: 'categories', categories: [] }),
      } as any);

    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const first = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'categories',
    });
    const second = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'categories',
    });

    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  it('supports non-categories kinds by validating endpoints array', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover/';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 'ontap-kg/1',
        kind: 'search',
        endpoints: [
          {
            resource: 'volume',
            method: 'GET',
            path: '/api/storage/volumes',
            pathParams: [],
            description: 'List volumes.',
            hint: null,
            keywords: ['volume'],
            body: null,
          },
        ],
        note: 'ok',
      }),
    } as any);

    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const result = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'search',
      search: 'volumes',
    });

    expect(result).toEqual({
      schemaVersion: 'ontap-kg/1',
      kind: 'search',
      endpoints: [
        {
          resource: 'volume',
          method: 'GET',
          path: '/api/storage/volumes',
          pathParams: [],
          description: 'List volumes.',
          hint: null,
          keywords: ['volume'],
          body: null,
        },
      ],
      note: 'ok',
    });
  });

  it('returns null when endpoint payload is invalid for non-categories kind', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover/';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 'ontap-kg/1',
          kind: 'search',
          endpoints: {},
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 'ontap-kg/1',
          kind: 'search',
          endpoints: ['not-an-object'],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 'ontap-kg/1',
          kind: 'search',
          endpoints: [{ path: '/api/storage/volumes' }],
        }),
      } as any)
      .mockRejectedValueOnce(new Error('network-fail'));

    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const first = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'search',
      search: 'volumes',
    });
    const second = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'search',
      search: 'volumes',
    });
    const third = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'search',
      search: 'volumes',
    });
    const fourth = await discoverViaKg({
      schemaVersion: 'ontap-kg/1',
      kind: 'search',
      search: 'volumes',
    });

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(third).toBeNull();
    expect(fourth).toBeNull();
  });

  it('returns null for non-object payload and kind mismatch payload', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover/';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => 'not-an-object',
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 'ontap-kg/1',
          kind: 'resource',
          endpoints: [],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 'ontap-kg/1',
          kind: 'categories',
          categories: {},
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 'ontap-kg/1',
          kind: 'categories',
          categories: ['volume'],
        }),
      } as any);

    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const r1 = await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });
    const r2 = await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'search', search: 'x' });
    const r3 = await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });
    const r4 = await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(r3).toBeNull();
    expect(r4).toBeNull();
  });

  it('uses default timeout when timeout env is not a positive integer', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover/';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 'ontap-kg/1',
        kind: 'categories',
        categories: [],
      }),
    } as any);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const { discoverViaKg } = await import('./ontap-kg-client.js');
    process.env.ONTAP_KG_TIMEOUT_MS = 'not-a-number';
    await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });
    process.env.ONTAP_KG_TIMEOUT_MS = '0';
    await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });
    process.env.ONTAP_KG_TIMEOUT_MS = '-1';
    await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });

    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 5000);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 5000);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 5000);
  });

  it('returns null when response.json throws', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example/discover/';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad-json');
      },
    } as any);

    const { discoverViaKg } = await import('./ontap-kg-client.js');
    const result = await discoverViaKg({ schemaVersion: 'ontap-kg/1', kind: 'categories' });
    expect(result).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OntapHttpClient } from './ontap-http-client.js';
import { runWithRequestAccessToken } from '../auth/access-token-context.js';

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getAccessToken() {
      return Promise.resolve('mock-token');
    }
  },
}));

vi.mock('../logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const mockSleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('./sleep.js', () => ({
  sleep: (...args: any[]) => mockSleep(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe('OntapHttpClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    OntapHttpClient.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs correct proxy URL with storagePools path', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { records: [] } }));
    const client = OntapHttpClient.create('my-project', 'us-east1', 'pool1');
    await client.get('/api/storage/volumes');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(
      '/v1beta1/projects/my-project/locations/us-east1/storagePools/pool1/ontap/api/storage/volumes'
    );
    expect(url).not.toContain('/pools/');
  });

  it('uses request token header when present', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { records: [] } }));
    const client = OntapHttpClient.create('my-project', 'us-east1', 'pool1');
    await runWithRequestAccessToken('request-token', async () => {
      await client.get('/api/storage/volumes');
    });

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer request-token');
  });

  it('returns cached client for same (project, location, pool)', () => {
    const a = OntapHttpClient.create('p1', 'loc1', 'pool1');
    const b = OntapHttpClient.create('p1', 'loc1', 'pool1');
    expect(a).toBe(b);
  });

  it('returns different clients for different pools', () => {
    const a = OntapHttpClient.create('p1', 'loc1', 'pool1');
    const b = OntapHttpClient.create('p1', 'loc1', 'pool2');
    expect(a).not.toBe(b);
  });

  it('clearCache resets cached clients', () => {
    const a = OntapHttpClient.create('p1', 'loc1', 'pool1');
    OntapHttpClient.clearCache();
    const b = OntapHttpClient.create('p1', 'loc1', 'pool1');
    expect(a).not.toBe(b);
  });

  it('wraps POST body in { body: payload } envelope', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { ok: true } }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    await client.post('/api/storage/volumes', { name: 'vol1' });

    const call = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody).toEqual({ body: { name: 'vol1' } });
  });

  it('wraps PATCH body in { body: payload } envelope', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { updated: true } }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    await client.patch('/api/storage/volumes/uuid1', { size: '5GB' });

    const call = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody).toEqual({ body: { size: '5GB' } });
  });

  it('does not wrap GET requests with body envelope', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { records: [] } }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    await client.get('/api/storage/volumes');

    const call = mockFetch.mock.calls[0];
    expect(call[1].body).toBeUndefined();
  });

  it('unwraps rawResponse from proxy response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { name: 'vol1', uuid: 'abc' } }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    const result = await client.get('/api/storage/volumes/abc');

    expect(result).toEqual({ name: 'vol1', uuid: 'abc' });
  });

  it('unwraps nested body inside rawResponse', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        rawResponse: { body: { records: [{ name: 'svm1', aggregates: [{ name: 'aggr1' }] }] } },
      })
    );
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    const result = await client.get<{ records: unknown[] }>('/api/svm/svms');

    expect(result).toEqual({ records: [{ name: 'svm1', aggregates: [{ name: 'aggr1' }] }] });
  });

  it('unwraps body envelope when rawResponse is not present', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ body: { records: [{ name: 'svm1' }] } }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    const result = await client.get<{ records: unknown[] }>('/api/svm/svms');

    expect(result).toEqual({ records: [{ name: 'svm1' }] });
  });

  it('returns parsed JSON when neither rawResponse nor body is present', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ records: [{ name: 'svm1' }] }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    const result = await client.get('/api/svm/svms');

    expect(result).toEqual({ records: [{ name: 'svm1' }] });
  });

  it('appends query params to URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: { records: [] } }));
    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    await client.get('/api/storage/volumes', { ontap_fields: 'name,uuid' });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('ontap_fields=name%2Cuuid');
  });

  it('respects GCNV_API_ENDPOINT env var with scheme', async () => {
    const original = process.env.GCNV_API_ENDPOINT;
    process.env.GCNV_API_ENDPOINT = 'https://staging-netapp.googleapis.com';
    OntapHttpClient.clearCache();
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: {} }));

    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    await client.get('/api/cluster');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/staging-netapp\.googleapis\.com\/v1beta1\//);

    if (original === undefined) {
      delete process.env.GCNV_API_ENDPOINT;
    } else {
      process.env.GCNV_API_ENDPOINT = original;
    }
  });

  it('auto-prepends https:// when GCNV_API_ENDPOINT is a bare hostname', async () => {
    const original = process.env.GCNV_API_ENDPOINT;
    process.env.GCNV_API_ENDPOINT = 'autopush-netapp.sandbox.googleapis.com';
    OntapHttpClient.clearCache();
    mockFetch.mockResolvedValue(jsonResponse({ rawResponse: {} }));

    const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
    await client.get('/api/cluster');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/autopush-netapp\.sandbox\.googleapis\.com\/v1beta1\//);

    if (original === undefined) {
      delete process.env.GCNV_API_ENDPOINT;
    } else {
      process.env.GCNV_API_ENDPOINT = original;
    }
  });

  describe('retry logic', () => {
    beforeEach(() => {
      mockSleep.mockClear();
    });

    it('retries on 429 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ error: 'rate limit' }, 429))
        .mockResolvedValueOnce(jsonResponse({ rawResponse: { ok: true } }));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      const result = await client.get('/api/storage/volumes');

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledWith(1000);
    });

    it('retries on 503 and succeeds on third attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({}, 502))
        .mockResolvedValueOnce(jsonResponse({ rawResponse: { ok: true } }));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      const result = await client.get('/api/storage/volumes');

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenNthCalledWith(1, 1000);
      expect(mockSleep).toHaveBeenNthCalledWith(2, 2000);
    });

    it('does not retry POST on 503 - throws after one attempt', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.post('/api/storage/volumes', { name: 'vol1' })).rejects.toThrow(
        'ONTAP proxy returned 503'
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('does not retry on 400 - throws immediately', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'bad request' }, 400));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.get('/api/storage/volumes')).rejects.toThrow('ONTAP proxy returned 400');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('does not retry on 404 - throws immediately', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'not found' }, 404));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.get('/api/storage/volumes/bad')).rejects.toThrow(
        'ONTAP proxy returned 404'
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('retries GET on transient fetch failure (cause.code=ECONNRESET) and succeeds', async () => {
      const transportErr: any = new TypeError('fetch failed');
      transportErr.cause = { code: 'ECONNRESET' };
      mockFetch
        .mockRejectedValueOnce(transportErr)
        .mockResolvedValueOnce(jsonResponse({ rawResponse: { ok: true } }));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      const result = await client.get('/api/storage/volumes');

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledWith(1000);
    });

    it('retries GET on generic "fetch failed" TypeError and succeeds', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(jsonResponse({ rawResponse: { ok: true } }));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      const result = await client.get('/api/storage/volumes');

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2);
    });

    it('does not retry POST on transport error - throws immediately', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.post('/api/storage/volumes', { name: 'vol1' })).rejects.toThrow(
        /ONTAP proxy fetch failed/
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('emits transient-retry hint instead of identifier-verification hint on transport failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.get('/api/storage/volumes')).rejects.toThrow(/Retry the request/);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('keeps identifier-verification hint for non-transient errors (e.g. DNS NXDOMAIN-like)', async () => {
      const err: any = new Error('getaddrinfo ENOTFOUND bogus');
      err.code = 'ENOTFOUND';
      mockFetch.mockRejectedValue(err);

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.get('/api/storage/volumes')).rejects.toThrow(
        /Verify projectId, locationId, and storagePoolId are correct/
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws after exhausting all retry attempts', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({}, 503));

      const client = OntapHttpClient.create('123', 'us-east1', 'pool1');
      await expect(client.get('/api/storage/volumes')).rejects.toThrow('ONTAP proxy returned 503');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2);
    });
  });
});

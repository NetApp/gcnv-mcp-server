import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ontapExecuteHandler, normalizeOntapQueryParams } from './ontap-execute-handler.js';
import { _resetIndexCache } from '../../utils/ontap-index-loader.js';

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

vi.mock('../../utils/ontap-http-client.js', () => ({
  OntapHttpClient: { create: vi.fn() },
}));

vi.mock('../../logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const baseArgs = {
  projectId: 'my-project',
  locationId: 'us-east1',
  storagePoolId: 'pool1',
};

describe('ontapExecuteHandler', () => {
  beforeEach(async () => {
    _resetIndexCache();
    mockClient.get.mockReset();
    mockClient.post.mockReset();
    mockClient.patch.mockReset();
    const { OntapHttpClient } = await import('../../utils/ontap-http-client.js');
    (OntapHttpClient.create as any).mockReturnValue(mockClient);
  });

  // Path validation
  it('rejects ontapApiPath that does not start with /api/', async () => {
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/storage/volumes',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("must start with '/api/'");
  });

  it('accepts ontapApiPath starting with /api/', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
    });
    expect(result.isError).toBeUndefined();
  });

  // DELETE is refused up-front by this server
  it('refuses DELETE requests up-front without calling the proxy', async () => {
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'DELETE',
      ontapApiPath: '/api/storage/volumes/uuid1',
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('scope_denied');
    expect(parsed.retryability).toBe(false);
    expect(parsed.source).toBe('preflight');
    expect(parsed.reason).toContain('DELETE operations are not supported by this server.');
    expect(mockClient.get).not.toHaveBeenCalled();
    expect(mockClient.post).not.toHaveBeenCalled();
    expect(mockClient.patch).not.toHaveBeenCalled();
  });

  // HTTP method dispatch (accepts body/queryParams as JSON strings or objects)
  it('GET calls client.get with path and query params (string)', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
      queryParams: JSON.stringify({ ontap_fields: 'name,uuid' }),
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/storage/volumes',
      expect.objectContaining({ ontap_fields: 'name,uuid' })
    );
  });

  it('GET calls client.get with query params as object (backward compat)', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
      queryParams: { ontap_fields: 'name,uuid' },
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/storage/volumes',
      expect.objectContaining({ ontap_fields: 'name,uuid' })
    );
  });

  it('GET renames fields to ontap_fields when ontap_fields is absent', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/network/ip/interfaces',
      queryParams: { fields: 'ip,services,scope' },
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/network/ip/interfaces',
      expect.objectContaining({
        ontap_fields: 'ip,services,scope',
        max_records: '20',
      })
    );
    expect(mockClient.get.mock.calls[0][1]).not.toHaveProperty('fields');
  });

  it('GET prefers ontap_fields when both fields and ontap_fields are sent', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
      queryParams: { fields: 'name', ontap_fields: 'uuid' },
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/storage/volumes',
      expect.objectContaining({ ontap_fields: 'uuid' })
    );
    expect(mockClient.get.mock.calls[0][1]).not.toHaveProperty('fields');
  });

  describe('normalizeOntapQueryParams', () => {
    it('returns undefined for undefined input', () => {
      expect(normalizeOntapQueryParams(undefined)).toBeUndefined();
    });

    it('passes through params without fields unchanged', () => {
      expect(normalizeOntapQueryParams({ max_records: '10' })).toEqual({ max_records: '10' });
    });
  });

  it('POST calls client.post with path and body (string)', async () => {
    mockClient.post.mockResolvedValue({ job: { uuid: 'j1' } });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'POST',
      ontapApiPath: '/api/storage/volumes',
      body: JSON.stringify({ name: 'vol1', svm: { name: 'vs0' }, size: '2GB' }),
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/api/storage/volumes',
      { name: 'vol1', svm: { name: 'vs0' }, size: '2GB' },
      undefined
    );
  });

  it('POST calls client.post with body as object (backward compat)', async () => {
    mockClient.post.mockResolvedValue({ job: { uuid: 'j1' } });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'POST',
      ontapApiPath: '/api/storage/volumes',
      body: { name: 'vol1', svm: { name: 'vs0' }, size: '2GB' },
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/api/storage/volumes',
      { name: 'vol1', svm: { name: 'vs0' }, size: '2GB' },
      undefined
    );
  });

  it('PATCH calls client.patch with path and body (string)', async () => {
    mockClient.patch.mockResolvedValue({});
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'PATCH',
      ontapApiPath: '/api/storage/volumes/uuid1',
      body: JSON.stringify({ size: '5GB' }),
    });
    expect(mockClient.patch).toHaveBeenCalledWith(
      '/api/storage/volumes/uuid1',
      { size: '5GB' },
      undefined
    );
  });

  it('returns error for invalid JSON in body', async () => {
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'POST',
      ontapApiPath: '/api/storage/volumes',
      body: '{invalid json',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to parse');
  });

  it.each([
    { label: 'number', value: '5' },
    { label: 'array', value: '[1,2,3]' },
    { label: 'null literal', value: 'null' },
  ])('returns error when body parses to a non-object ($label)', async ({ value }) => {
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'POST',
      ontapApiPath: '/api/storage/volumes',
      body: value,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('body must be a JSON object');
  });

  // Async job detection
  it('detects async job in POST response', async () => {
    mockClient.post.mockResolvedValue({ job: { uuid: 'job-123' } });
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'POST',
      ontapApiPath: '/api/storage/volumes',
      body: JSON.stringify({ name: 'vol1', svm: { name: 'vs0' }, size: '2GB' }),
    });
    const data = result.structuredContent as any;
    expect(data.result.asyncJobDetected).toBe(true);
    expect(data.result.pollingGuidance).toContain('job-123');
  });

  it('does not add polling guidance for non-job POST response', async () => {
    mockClient.post.mockResolvedValue({ records: [{ name: 'policy1' }] });
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'POST',
      ontapApiPath: '/api/storage/qos/policies',
      body: JSON.stringify({ name: 'policy1', svm: { name: 'vs0' } }),
    });
    const data = result.structuredContent as any;
    expect(data.result.asyncJobDetected).toBeUndefined();
  });

  // Pagination defaults
  it('auto-adds max_records=20 for GET without max_records', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/storage/volumes',
      expect.objectContaining({ max_records: '20' })
    );
  });

  it('uses user-provided max_records instead of default', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
      queryParams: JSON.stringify({ max_records: '50' }),
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/storage/volumes',
      expect.objectContaining({ max_records: '50' })
    );
  });

  it('does not add max_records for GET by UUID (instance endpoint)', async () => {
    const volumeUuid = '123e4567-e89b-12d3-a456-426614174000';
    mockClient.get.mockResolvedValue({ uuid: volumeUuid, name: 'vol1' });
    await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: `/api/storage/volumes/${volumeUuid}`,
    });
    expect(mockClient.get).toHaveBeenCalledWith(`/api/storage/volumes/${volumeUuid}`, undefined);
  });

  it('adds pagination note for default max_records', async () => {
    mockClient.get.mockResolvedValue({ records: [] });
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
    });
    expect(result.content[0].text).toContain('limited to 20 records');
    const data = result.structuredContent as any;
    expect(data.note).toContain('limited to 20 records');
    expect(data.result).toEqual({ records: [] });
  });

  // ONTAP error formatting
  it('formats ONTAP error response into structured error', async () => {
    mockClient.get.mockRejectedValue(
      new Error(
        'ONTAP proxy returned 409: {"error":{"code":"4","message":"Volume with name vol1 already exists.","target":"/api/storage/volumes"}}'
      )
    );
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe('4');
    expect(parsed.error.message).toContain('already exists');
    expect(parsed.suggestion).toBeDefined();
  });

  it('returns generic error for non-ONTAP failures', async () => {
    mockClient.get.mockRejectedValue(new Error('Network error'));
    const result = await ontapExecuteHandler({
      ...baseArgs,
      method: 'GET',
      ontapApiPath: '/api/storage/volumes',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network error');
  });

  // Pre-flight validation (uses real ontap-api-index.json)
  describe('pre-flight validation', () => {
    it('rejects POST without body when index says body is required', async () => {
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('requires a request body');
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it('rejects path with unresolved placeholders', async () => {
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/volumes/{uuid}',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('unresolved placeholders');
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('rejects GET requests to paths not in the index at preflight', async () => {
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/some/unknown/endpoint',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('scope_denied');
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('rejects POST requests to paths not in the index at preflight', async () => {
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/some/unknown/endpoint',
        body: '{"name":"x"}',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('scope_denied');
      expect(mockClient.post).not.toHaveBeenCalled();
    });
  });

  // Output schema sanitization
  describe('output sanitization', () => {
    it('structuredContent only contains declared keys', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/snapshot-policies',
      });
      const keys = Object.keys(result.structuredContent as any);
      expect(keys.every((k) => ['result', 'note'].includes(k))).toBe(true);
    });
  });

  // Retry hints
  describe('retry hints', () => {
    it('includes retryable: true for GET errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/volumes',
      });
      expect(result.content[0].text).toContain('retryable: true');
    });

    it('includes retryable: false for POST generic errors', async () => {
      mockClient.post.mockRejectedValue(new Error('Network error'));
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
        body: JSON.stringify({ name: 'vol1', svm: { name: 'vs0' }, size: '2GB' }),
      });
      expect(result.content[0].text).toContain('retryable: false');
    });

    it('includes retryable: false for ONTAP 429 errors on POST', async () => {
      mockClient.post.mockRejectedValue(
        new Error('ONTAP proxy returned 429: {"error":{"code":"429","message":"Rate limited"}}')
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
        body: JSON.stringify({ name: 'vol1', svm: { name: 'vs0' }, size: '2GB' }),
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(false);
    });

    it('includes retryable: false for ONTAP 500 errors on POST', async () => {
      mockClient.post.mockRejectedValue(
        new Error('ONTAP proxy returned 500: {"error":{"code":"500","message":"Internal error"}}')
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
        body: JSON.stringify({ name: 'vol1', svm: { name: 'vs0' }, size: '2GB' }),
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(false);
    });

    it('includes retryable: false for deterministic ONTAP 400 errors on GET', async () => {
      mockClient.get.mockRejectedValue(
        new Error('ONTAP proxy returned 400: {"error":{"code":"400","message":"Bad request"}}')
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/volumes',
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(false);
    });

    it('includes retryable: true for transient ONTAP 500 errors on GET', async () => {
      mockClient.get.mockRejectedValue(
        new Error('ONTAP proxy returned 500: {"error":{"code":"500","message":"Internal error"}}')
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/volumes',
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(true);
    });

    it('includes retryable: false for ONTAP 400 errors on POST', async () => {
      mockClient.post.mockRejectedValue(
        new Error('ONTAP proxy returned 400: {"error":{"code":"400","message":"Bad request"}}')
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
        body: JSON.stringify({ name: 'vol1', svm: { name: 'vs0' }, size: '2GB' }),
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(false);
    });

    it('validation errors include retryable: false', async () => {
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('retryable: false');
    });
  });

  // -------------------------------------------------------------------
  // Scope-boundary denials (canonical envelope)
  // -------------------------------------------------------------------

  describe('scope_denied envelope', () => {
    it('rejects Private-CLI paths at preflight with a scope_denied envelope', async () => {
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/private/cli/volume',
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('scope_denied');
      expect(parsed.retryability).toBe(false);
      expect(parsed.source).toBe('preflight');
      expect(parsed.reason).toContain('out of scope');
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('rejects Private-CLI POST without ever calling the proxy', async () => {
      await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/private/cli/storage/aggregate',
        body: JSON.stringify({ foo: 'bar' }),
      });
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it('normalizes ONTAP 403 errors into a scope_denied envelope (source=ontap)', async () => {
      mockClient.get.mockRejectedValue(
        new Error(
          'ONTAP proxy returned 403: {"error":{"code":"6","message":"User is not authorized to invoke this command.","target":"/api/storage/volumes"}}'
        )
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/volumes',
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('scope_denied');
      expect(parsed.retryability).toBe(false);
      expect(parsed.source).toBe('ontap');
      expect(parsed.reason).toContain('not authorized');
    });

    it('normalizes proxy rule-engine errors into a scope_denied envelope (source=proxy)', async () => {
      mockClient.patch.mockRejectedValue(
        new Error(
          'ONTAP proxy returned 400: blocked by proxy rule engine: PATCH /api/storage/volumes is not permitted'
        )
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'PATCH',
        ontapApiPath: '/api/storage/volumes/abc-123',
        body: JSON.stringify({ size: '5GB' }),
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('scope_denied');
      expect(parsed.retryability).toBe(false);
      expect(parsed.source).toBe('proxy');
      expect(parsed.reason).toContain('proxy rule engine');
    });

    it('normalizes 405 with empty body into a scope_denied envelope (source=proxy)', async () => {
      mockClient.get.mockRejectedValue(new Error('ONTAP proxy returned 405: '));
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'GET',
        ontapApiPath: '/api/storage/volumes',
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('scope_denied');
      expect(parsed.source).toBe('proxy');
    });

    it('rejects Private-CLI when index load fails', async () => {
      const loader = await import('../../utils/ontap-index-loader.js');
      const spy = vi.spyOn(loader, 'loadIndex').mockRejectedValue(new Error('index missing'));
      try {
        const result = await ontapExecuteHandler({
          ...baseArgs,
          method: 'GET',
          ontapApiPath: '/api/private/cli/volume',
        });
        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toBe('scope_denied');
        expect(parsed.source).toBe('preflight');
        expect(mockClient.get).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        _resetIndexCache();
      }
    });

    it('fails closed (no HTTP call) when index load fails for a public path', async () => {
      const loader = await import('../../utils/ontap-index-loader.js');
      const spy = vi.spyOn(loader, 'loadIndex').mockRejectedValue(new Error('index missing'));
      try {
        const result = await ontapExecuteHandler({
          ...baseArgs,
          method: 'GET',
          ontapApiPath: '/api/storage/volumes',
        });
        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toBe('scope_denied');
        expect(parsed.source).toBe('preflight');
        expect(parsed.retryability).toBe(false);
        expect(mockClient.get).not.toHaveBeenCalled();
        expect(mockClient.post).not.toHaveBeenCalled();
        expect(mockClient.patch).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        _resetIndexCache();
      }
    });

    it('keeps non-denial 4xx errors in the legacy formatted-error shape', async () => {
      mockClient.post.mockRejectedValue(
        new Error(
          'ONTAP proxy returned 400: {"error":{"code":"400","message":"Bad request: invalid field"}}'
        )
      );
      const result = await ontapExecuteHandler({
        ...baseArgs,
        method: 'POST',
        ontapApiPath: '/api/storage/volumes',
        body: JSON.stringify({ name: 'v', svm: { name: 'vs0' }, size: '2GB' }),
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).not.toBe('scope_denied');
      expect(parsed.error).toBeDefined();
      expect(parsed.retryable).toBe(false);
    });
  });
});

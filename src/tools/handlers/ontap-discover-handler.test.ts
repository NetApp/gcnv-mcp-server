import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ontapDiscoverHandler, _resetIndexCache } from './ontap-discover-handler.js';
import { PACKAGE_VERSION } from '../../package-metadata.js';

describe('ontapDiscoverHandler', () => {
  beforeEach(() => {
    _resetIndexCache();
    delete process.env.ONTAP_KG_URL;
    delete process.env.ONTAP_KG_TIMEOUT_MS;
    delete process.env.ONTAP_KG_AUTH_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // Mode 1: No params → categories listing
  // -------------------------------------------------------------------

  it('returns all categories when no params provided', async () => {
    const res = await ontapDiscoverHandler({});
    const data = (res.structuredContent as any).result;

    expect(data.categories).toBeDefined();
    expect(data.categories.length).toBeGreaterThan(100);
    expect(data.categories[0]).toHaveProperty('resource');
    expect(data.categories[0]).toHaveProperty('count');
    expect(data.categories[0]).not.toHaveProperty('keywords');
  });

  it('reflects expanded index scale across categories', async () => {
    const res = await ontapDiscoverHandler({});
    const data = (res.structuredContent as any).result;
    const totalEndpoints = data.categories.reduce(
      (sum: number, c: { count: number }) => sum + c.count,
      0
    );

    expect(data.categories.length).toBeGreaterThanOrEqual(175);
    expect(totalEndpoints).toBeGreaterThanOrEqual(1014);
  });

  it('resource mode returns the full endpoint set for high-cardinality categories', async () => {
    const res = await ontapDiscoverHandler({ resource: 'cluster' });
    const data = (res.structuredContent as any).result;

    expect(data.resource).toBe('cluster');
    expect(data.endpoints.length).toBeGreaterThanOrEqual(80);
  });

  // -------------------------------------------------------------------
  // Mode 2: Exact resource match
  // -------------------------------------------------------------------

  it('returns endpoints for exact resource match', async () => {
    const res = await ontapDiscoverHandler({ resource: 'volume' });
    const data = (res.structuredContent as any).result;

    expect(data.resource).toBe('volume');
    expect(data.endpoints.length).toBeGreaterThan(0);
    expect(data.endpoints[0]).toHaveProperty('method');
    expect(data.endpoints[0]).toHaveProperty('path');
    // keywords are included so the AI can understand what concepts each endpoint covers
    expect(data.endpoints[0]).toHaveProperty('keywords');
    expect(Array.isArray(data.endpoints[0].keywords)).toBe(true);
  });

  it('resource match is case-insensitive', async () => {
    const res = await ontapDiscoverHandler({ resource: 'VOLUME' });
    const data = (res.structuredContent as any).result;

    expect(data.resource).toBe('volume');
    expect(data.endpoints.length).toBeGreaterThan(0);
  });

  it('returns suggestion for unknown resource', async () => {
    const res = await ontapDiscoverHandler({ resource: 'nonexistent' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints).toEqual([]);
    expect(data.suggestion).toContain('No resource category');
  });

  it('resource takes precedence over search when both provided', async () => {
    const res = await ontapDiscoverHandler({ resource: 'job', search: 'volume' });
    const data = (res.structuredContent as any).result;

    expect(data.resource).toBe('job');
    expect(data.endpoints.every((e: any) => e.path.includes('/cluster/jobs'))).toBe(true);
  });

  it('pathParams are correctly populated', async () => {
    const res = await ontapDiscoverHandler({ resource: 'volume' });
    const data = (res.structuredContent as any).result;

    const getByUuid = data.endpoints.find(
      (e: any) => e.method === 'GET' && e.path === '/api/storage/volumes/{uuid}'
    );
    expect(getByUuid).toBeDefined();
    expect(getByUuid.pathParams).toEqual(['uuid']);
  });

  // -------------------------------------------------------------------
  // Mode 3: Keyword search basics
  // -------------------------------------------------------------------

  it('keyword search matches across keywords and descriptions', async () => {
    const res = await ontapDiscoverHandler({ search: 'legal hold' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = data.endpoints.map((e: any) => e.resource);
    expect(resources).toContain('litigation');
    // keywords are included in search results so the AI sees what concepts the endpoint covers
    expect(data.endpoints[0]).toHaveProperty('keywords');
    expect(Array.isArray(data.endpoints[0].keywords)).toBe(true);
  });

  it('keyword search matches across path', async () => {
    const res = await ontapDiscoverHandler({ search: 'qos' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(resources.has('qos_policy') || resources.has('storage_qos_qos_options')).toBe(true);
    expect(data.endpoints.some((e: any) => e.path.includes('/qos/'))).toBe(true);
  });

  it('returns suggestion for no-match search', async () => {
    const res = await ontapDiscoverHandler({ search: 'zzzznonexistent' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints).toEqual([]);
    expect(data.suggestion).toContain('No endpoints found');
  });

  it('search is case-insensitive', async () => {
    const res = await ontapDiscoverHandler({ search: 'LEGAL HOLD' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
  });

  it('multi-token search requires at least some tokens to match', async () => {
    const res = await ontapDiscoverHandler({ search: 'virtual machine' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = data.endpoints.map((e: any) => e.resource);
    expect(resources).toContain('svm');
  });

  // -------------------------------------------------------------------
  // Prefix matching
  // -------------------------------------------------------------------

  it('prefix match: "snap" finds snapshot, snapmirror, snaplock resources', async () => {
    const res = await ontapDiscoverHandler({ search: 'snap' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(
      resources.has('snapshot') || resources.has('snapmirror') || resources.has('snaplock')
    ).toBe(true);
  });

  it('prefix match: "rep" finds snapmirror (replication keyword)', async () => {
    const res = await ontapDiscoverHandler({ search: 'rep' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = data.endpoints.map((e: any) => e.resource);
    expect(resources).toContain('snapmirror');
  });

  // -------------------------------------------------------------------
  // Synonym expansion
  // -------------------------------------------------------------------

  it('synonym: "file share" finds CIFS and export policy endpoints', async () => {
    const res = await ontapDiscoverHandler({ search: 'file share' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(resources.has('cifs_share') || resources.has('export_policy')).toBe(true);
  });

  it('synonym: "protect" finds snapshot and snapmirror endpoints', async () => {
    const res = await ontapDiscoverHandler({ search: 'protect' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(resources.has('snapshot') || resources.has('snapmirror')).toBe(true);
  });

  it('synonym: "backup" finds snapshot endpoints', async () => {
    const res = await ontapDiscoverHandler({ search: 'backup' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(resources.has('snapshot') || resources.has('snapshot_policy')).toBe(true);
  });

  it('synonym: "dr" finds snapmirror endpoints', async () => {
    const res = await ontapDiscoverHandler({ search: 'dr' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(resources.has('snapmirror')).toBe(true);
  });

  it('synonym: "block" finds LUN and igroup endpoints', async () => {
    const res = await ontapDiscoverHandler({ search: 'block' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set(data.endpoints.map((e: any) => e.resource));
    expect(resources.has('lun') || resources.has('igroup')).toBe(true);
  });

  // -------------------------------------------------------------------
  // Weighted scoring: resource name matches rank highest
  // -------------------------------------------------------------------

  it('weighted scoring: exact resource name ranks highest', async () => {
    const res = await ontapDiscoverHandler({ search: 'volume' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = data.endpoints.map((e: any) => e.resource);
    expect(resources).toContain('volume');
    // Diversification promotes one endpoint per resource; volume should still
    // appear near the head even when longer resource names also substring-match.
    expect(resources.indexOf('volume')).toBeLessThan(5);
  });

  it('weighted scoring: keyword match ranks above description-only match', async () => {
    const res = await ontapDiscoverHandler({ search: 'throughput' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    expect(data.endpoints[0].resource).toBe('qos_policy');
  });

  it('BM25 scoring: final path noun can select a child endpoint over its parent resource', async () => {
    const res = await ontapDiscoverHandler({ search: 'create export policy rule', maxResults: 1 });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/api/protocols/nfs/export-policies/{policy.id}/rules',
      })
    );
  });

  // -------------------------------------------------------------------
  // Golden discover intents
  // -------------------------------------------------------------------

  it.each([
    {
      search: 'list my ontap volumes',
      method: 'GET',
      path: '/api/storage/volumes',
    },
    {
      search: 'resize a volume',
      method: 'PATCH',
      path: '/api/storage/volumes/{uuid}',
    },
    {
      search: 'create snapshot of a volume',
      method: 'POST',
      path: '/api/storage/volumes/{volume.uuid}/snapshots',
    },
    {
      search: 'create snapshot policy',
      method: 'POST',
      path: '/api/storage/snapshot-policies',
    },
    {
      search: 'create lun for linux host',
      method: 'POST',
      path: '/api/storage/luns',
    },
    {
      search: 'create qos policy for throughput',
      method: 'POST',
      path: '/api/storage/qos/policies',
    },
    {
      search: 'create qtree',
      method: 'POST',
      path: '/api/storage/qtrees',
    },
    {
      search: 'create quota rule',
      method: 'POST',
      path: '/api/storage/quota/rules',
    },
    {
      search: 'poll job uuid status',
      method: 'GET',
      path: '/api/cluster/jobs/{uuid}',
    },
    {
      search: 'create snapmirror relationship',
      method: 'POST',
      path: '/api/snapmirror/relationships',
    },
    {
      search: 'create snapmirror policy',
      method: 'POST',
      path: '/api/snapmirror/policies',
    },
    {
      search: 'create cluster peer',
      method: 'POST',
      path: '/api/cluster/peers',
    },
    {
      search: 'create svm peer permission',
      method: 'POST',
      path: '/api/svm/peer-permissions',
    },
    {
      search: 'accept svm peer request',
      method: 'PATCH',
      path: '/api/svm/peers/{uuid}',
    },
    {
      search: 'find intercluster lif addresses',
      method: 'GET',
      path: '/api/network/ip/interfaces',
    },
    {
      search: 'create destination volume for snapmirror',
      method: 'POST',
      path: '/api/storage/volumes',
    },
    {
      search: 'create cifs share',
      method: 'POST',
      path: '/api/protocols/cifs/shares',
    },
    {
      search: 'create smb cifs server',
      method: 'POST',
      path: '/api/protocols/cifs/services',
    },
    {
      search: 'create export policy rule',
      method: 'POST',
      path: '/api/protocols/nfs/export-policies/{policy.id}/rules',
    },
    {
      search: 'create igroup',
      method: 'POST',
      path: '/api/protocols/san/igroups',
    },
    {
      search: 'create dns configuration for svm',
      method: 'POST',
      path: '/api/name-services/dns',
    },
    {
      search: 'create flexcache volume',
      method: 'POST',
      path: '/api/storage/flexcache/flexcaches',
    },
    {
      search: 'create recurring schedule',
      method: 'POST',
      path: '/api/cluster/schedules',
    },
    {
      search: 'create event retention policy',
      method: 'POST',
      path: '/api/storage/snaplock/event-retention/policies',
    },
    {
      search: 'begin legal hold',
      method: 'POST',
      path: '/api/storage/snaplock/litigations',
    },
  ])('golden intent "$search" includes $method $path in default top-10', async (golden) => {
    const res = await ontapDiscoverHandler({ search: golden.search });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    expect(data.endpoints.length).toBeLessThanOrEqual(10);
    expect(data.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: golden.method,
          path: golden.path,
        }),
      ])
    );
  });

  // -------------------------------------------------------------------
  // maxResults capping
  // -------------------------------------------------------------------

  it('search results are capped to default maxResults (10)', async () => {
    const res = await ontapDiscoverHandler({ search: 'storage' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeLessThanOrEqual(10);
  });

  it('rejects non-positive maxResults', async () => {
    for (const maxResults of [0, -1]) {
      const res = await ontapDiscoverHandler({ search: 'storage', maxResults });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('positive integer');
    }
  });

  it('rejects non-positive maxResults before KG discover when ONTAP_KG_URL is set', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example.internal/discover';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schemaVersion: 'ontap-kg/1',
        kind: 'search',
        endpoints: [{ resource: 'volume', method: 'GET', path: '/api/storage/volumes' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ontapDiscoverHandler({ search: 'storage', maxResults: 0 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('positive integer');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maxResults overrides the default cap', async () => {
    const res = await ontapDiscoverHandler({ search: 'storage', maxResults: 3 });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeLessThanOrEqual(3);
  });

  it('includes note with matched categories when results are truncated', async () => {
    const res = await ontapDiscoverHandler({ search: 'storage', maxResults: 1 });
    const data = (res.structuredContent as any).result;

    expect(data.note).toContain('Showing top 1');
    expect(data.note).toContain('categories');
    expect(data.note).toContain('resource=');
  });

  it('no truncation note when all results fit within maxResults', async () => {
    const res = await ontapDiscoverHandler({ search: 'legal hold' });
    const data = (res.structuredContent as any).result;

    expect(data.note).toBeUndefined();
  });

  // -------------------------------------------------------------------
  // Result diversification
  // -------------------------------------------------------------------

  it('diversifies top-N results so multiple matching resources each get representation', async () => {
    const res = await ontapDiscoverHandler({ search: 'snap' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    const resources = new Set<string>(data.endpoints.map((e: any) => e.resource));
    // With many snap-prefixed resources in the expanded index, top-10 should span
    // at least 3 of them rather than being monopolized by one resource's
    // alphabetically-earliest paths.
    expect(resources.size).toBeGreaterThanOrEqual(3);
  });

  it('broad storage search spans many resource categories under default cap', async () => {
    const res = await ontapDiscoverHandler({ search: 'storage' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeLessThanOrEqual(10);
    const resources = new Set<string>(data.endpoints.map((e: any) => e.resource));
    expect(resources.size).toBeGreaterThanOrEqual(8);
  });

  // -------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------

  it('index is cached - second call does not re-read file', async () => {
    const result1 = await ontapDiscoverHandler({});
    const result2 = await ontapDiscoverHandler({});

    expect(result1.structuredContent).toEqual(result2.structuredContent);
  });

  // -------------------------------------------------------------------
  // Curated-allowlist contract: no decision metadata leaks to discover output
  // -------------------------------------------------------------------

  it('does not surface decision fields or scope-boundary notes in resource mode', async () => {
    const res = await ontapDiscoverHandler({ resource: 'volume' });
    const data = (res.structuredContent as any).result;
    expect(data).not.toHaveProperty('scopeBoundaryNote');
    for (const ep of data.endpoints as Array<Record<string, unknown>>) {
      expect(ep.decision).toBeUndefined();
      expect(ep.decisionReason).toBeUndefined();
      expect(ep.suggestedTool).toBeUndefined();
      expect(ep.decisionSource).toBeUndefined();
    }
  });

  it('does not surface decision fields or scope-boundary notes in search mode', async () => {
    const res = await ontapDiscoverHandler({ search: 'snap' });
    const data = (res.structuredContent as any).result;
    expect(data).not.toHaveProperty('scopeBoundaryNote');
    for (const ep of data.endpoints as Array<Record<string, unknown>>) {
      expect(ep.decision).toBeUndefined();
      expect(ep.decisionReason).toBeUndefined();
      expect(ep.suggestedTool).toBeUndefined();
      expect(ep.decisionSource).toBeUndefined();
    }
  });

  it('does not surface a scope-boundary note on no-match search', async () => {
    const res = await ontapDiscoverHandler({ search: 'zzzznonexistent' });
    const data = (res.structuredContent as any).result;
    expect(data).not.toHaveProperty('scopeBoundaryNote');
  });

  it('uses KG query endpoint when configured', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example.internal/discover';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schemaVersion: 'ontap-kg/1',
        kind: 'search',
        endpoints: [
          {
            resource: 'litigation',
            method: 'POST',
            path: '/api/storage/litigations',
            pathParams: [],
            description: 'Apply legal hold',
            hint: 'Need uuid',
            keywords: ['legal', 'hold'],
            body: { operation: 'begin' },
            requiredBody: [['operation']],
            operationId: 'litigation_create',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ontapDiscoverHandler({
      search: 'legal hold',
      userIntent: 'help me hold files',
    });
    const data = (res.structuredContent as any).result;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kg.example.internal/discover');
    expect(request.method).toBe('POST');
    const body = JSON.parse(request.body as string);
    expect(body.max_results).toBe(10);
    expect(body.context.client).toEqual({ name: 'gcnv-mcp', version: PACKAGE_VERSION });
    expect(data.search).toBe('legal hold');
    expect(data.endpoints[0].operationId).toBe('litigation_create');
  });

  it('does not send max_results to KG for categories requests', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example.internal/discover';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schemaVersion: 'ontap-kg/1',
        kind: 'categories',
        categories: [{ resource: 'volume', count: 42 }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await ontapDiscoverHandler({});
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.kind).toBe('categories');
    expect(body).not.toHaveProperty('max_results');
  });

  it('falls back to bundled index when KG query fails', async () => {
    process.env.ONTAP_KG_URL = 'https://kg.example.internal/discover';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const res = await ontapDiscoverHandler({ search: 'legal hold' });
    const data = (res.structuredContent as any).result;

    expect(data.endpoints.length).toBeGreaterThan(0);
    expect(data.endpoints.some((e: any) => e.resource === 'litigation')).toBe(true);
  });
});

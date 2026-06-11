import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/logging-client-factory.js', () => ({
  LoggingClientFactory: { createClient: createClientMock },
}));

/** Build a fake @google-cloud/logging Entry (metadata + data payload). */
function entry(opts: {
  timestamp?: any;
  severity?: string;
  methodName?: string;
  resourceName?: string;
  principal?: string;
  statusCode?: number;
  statusMessage?: string;
  operationId?: string;
  logName?: string;
}) {
  return {
    metadata: {
      timestamp: opts.timestamp,
      severity: opts.severity,
      logName: opts.logName,
      operation: opts.operationId ? { id: opts.operationId } : undefined,
    },
    data: {
      methodName: opts.methodName,
      resourceName: opts.resourceName,
      authenticationInfo: opts.principal ? { principalEmail: opts.principal } : undefined,
      status:
        opts.statusCode != null || opts.statusMessage
          ? { code: opts.statusCode, message: opts.statusMessage }
          : undefined,
    },
  };
}

describe('logs-handler', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('projectEntry maps metadata and payload into the compact shape', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const result = projectEntry(
      entry({
        timestamp: '2026-01-01T00:00:00Z',
        severity: 'ERROR',
        methodName: 'google.cloud.netapp.v1.NetApp.DeleteVolume',
        resourceName: 'projects/p/locations/us/volumes/v1',
        principal: 'user@example.com',
        statusCode: 7,
        statusMessage: 'permission denied',
        operationId: 'op-1',
        logName: 'projects/p/logs/cloudaudit.googleapis.com%2Factivity',
      })
    );
    expect(result).toMatchObject({
      timestamp: '2026-01-01T00:00:00Z',
      severity: 'ERROR',
      methodName: 'google.cloud.netapp.v1.NetApp.DeleteVolume',
      resourceName: 'projects/p/locations/us/volumes/v1',
      principal: 'user@example.com',
      statusCode: 7,
      statusMessage: 'permission denied',
      operationId: 'op-1',
    });
    expect(result.summary).toContain('DeleteVolume');
    expect(result.summary).toContain('FAILED');
  });

  it('projectEntry normalizes protobuf timestamp objects (with and without nanos)', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    // nanos present (non-zero) exercises the left side of `nanos ?? 0`.
    const withNanos = projectEntry(
      entry({ timestamp: { seconds: 1767225600, nanos: 500_000_000 } })
    );
    expect(withNanos.timestamp).toBe(new Date(1767225600 * 1000 + 500).toISOString());
    // nanos absent exercises the `?? 0` fallback.
    const noNanos = projectEntry(entry({ timestamp: { seconds: 1767225600 } as any }));
    expect(noNanos.timestamp).toBe(new Date(1767225600 * 1000).toISOString());
  });

  it('listGcnvLogsHandler requires projectId', async () => {
    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    const result = await listGcnvLogsHandler({});
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: expect.stringContaining('projectId') });
  });

  it('listGcnvLogsHandler builds a filter, calls getEntries, and returns projected entries', async () => {
    const getEntries = vi
      .fn()
      .mockResolvedValue([
        [entry({ severity: 'INFO', methodName: 'x.CreateVolume', resourceName: 'r1' })],
        {},
        { nextPageToken: 'tok-2' },
      ]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    const result = await listGcnvLogsHandler({
      projectId: 'p1',
      resourceType: 'volume',
      severity: 'INFO',
    });

    expect(createClientMock).toHaveBeenCalledWith('p1');
    const callArg = getEntries.mock.calls[0][0];
    expect(callArg.resourceNames).toEqual(['projects/p1']);
    expect(callArg.filter).toContain('protoPayload.serviceName="netapp.googleapis.com"');
    expect(callArg.filter).toContain('protoPayload.resourceName:"/volumes/"');
    expect(callArg.filter).toContain('severity>=INFO');
    expect(callArg.orderBy).toBe('timestamp desc');
    expect(callArg.autoPaginate).toBe(false);
    expect(result.structuredContent).toMatchObject({
      count: 1,
      nextPageToken: 'tok-2',
    });
  });

  it('listGcnvLogsHandler defaults to a last-24h time window', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    await listGcnvLogsHandler({ projectId: 'p1' });

    const filter = getEntries.mock.calls[0][0].filter as string;
    expect(filter).toContain('timestamp>=');
    expect(filter).toContain('timestamp<=');
  });

  it('listGcnvLogsHandler uses an explicit time window when provided', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    await listGcnvLogsHandler({
      projectId: 'p1',
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2026-01-02T00:00:00Z',
    });

    const filter = getEntries.mock.calls[0][0].filter as string;
    expect(filter).toContain('timestamp>="2026-01-01T00:00:00Z"');
    expect(filter).toContain('timestamp<="2026-01-02T00:00:00Z"');
  });

  it('listGcnvLogsHandler clamps pageSize to the max', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    await listGcnvLogsHandler({ projectId: 'p1', pageSize: 5000 });

    expect(getEntries.mock.calls[0][0].pageSize).toBe(200);
  });

  it('listGcnvLogsHandler returns a filter error for an invalid resourceType', async () => {
    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    const result = await listGcnvLogsHandler({ projectId: 'p1', resourceType: 'bogus' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: expect.stringContaining('resourceType'),
    });
  });

  it('listGcnvErrorsHandler forces the failures clause', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvErrorsHandler } = await import('./logs-handler.js');
    await listGcnvErrorsHandler({ projectId: 'p1' });

    expect(getEntries.mock.calls[0][0].filter).toContain(
      '(severity>=ERROR OR protoPayload.status.code!=0)'
    );
  });

  it('listGcnvEventsHandler maps eventType into a method-name regex', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvEventsHandler } = await import('./logs-handler.js');
    await listGcnvEventsHandler({ projectId: 'p1', eventType: 'delete' });

    expect(getEntries.mock.calls[0][0].filter).toContain('protoPayload.methodName=~"Delete"');
  });

  it('listGcnvLogsHandler surfaces getEntries failures as errors', async () => {
    const getEntries = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    const result = await listGcnvLogsHandler({ projectId: 'p1' });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: 'boom', count: 0 });
  });

  it('gcnvLogSummaryHandler aggregates entries across pages and respects maxEntries', async () => {
    const page1 = [
      [
        entry({ severity: 'INFO', methodName: 'x.CreateVolume', resourceName: 'r1' }),
        entry({
          severity: 'ERROR',
          methodName: 'x.DeleteVolume',
          resourceName: 'r1',
          statusCode: 7,
        }),
      ],
      {},
      { nextPageToken: 'p2' },
    ];
    const page2 = [
      [entry({ severity: 'INFO', methodName: 'x.CreateVolume', resourceName: 'r2' })],
      {},
      {},
    ];
    const getEntries = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    createClientMock.mockReturnValue({ getEntries });

    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1' });

    expect(result.structuredContent).toMatchObject({
      totalEntries: 3,
      failureCount: 1,
      bySeverity: { INFO: 2, ERROR: 1 },
      byMethod: { 'x.CreateVolume': 2, 'x.DeleteVolume': 1 },
      byResource: { r1: 2, r2: 1 },
      truncated: false,
    });
  });

  it('gcnvLogSummaryHandler requires projectId', async () => {
    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({});
    expect(result.isError).toBe(true);
  });

  it('gcnvLogSummaryHandler surfaces errors from getEntries', async () => {
    const getEntries = vi.fn().mockRejectedValue(new Error('nope'));
    createClientMock.mockReturnValue({ getEntries });

    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: 'nope' });
  });

  // ---- Additional branch coverage ----

  it('projectEntry handles a completely empty entry', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const result = projectEntry(undefined);
    expect(result.timestamp).toBeUndefined();
    expect(result.severity).toBeUndefined();
    expect(result.summary).toBe('(ok)');
  });

  it('projectEntry falls back to metadata.protoPayload when data is absent', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const result = projectEntry({
      metadata: { protoPayload: { methodName: 'x.CreateVolume', resourceName: 'r1' } },
    });
    expect(result.methodName).toBe('x.CreateVolume');
    expect(result.resourceName).toBe('r1');
  });

  it('projectEntry falls back to metadata.jsonPayload when data and protoPayload are absent', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const result = projectEntry({ metadata: { jsonPayload: { methodName: 'x.Foo' } } });
    expect(result.methodName).toBe('x.Foo');
  });

  it('projectEntry stringifies a numeric severity', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const result = projectEntry({ metadata: { severity: 500 }, data: {} });
    expect(result.severity).toBe('500');
  });

  it('projectEntry reports FAILED without a status message', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const result = projectEntry(entry({ statusCode: 13 }));
    expect(result.summary).toContain('FAILED: error');
  });

  it('projectEntry normalizes Date and epoch-number timestamps and bad objects', async () => {
    const { projectEntry } = await import('./logs-handler.js');
    const d = new Date('2026-02-02T02:02:02Z');
    expect(projectEntry(entry({ timestamp: d })).timestamp).toBe(d.toISOString());
    expect(projectEntry(entry({ timestamp: d.getTime() })).timestamp).toBe(d.toISOString());
    // An object without `seconds` falls through to `new Date(obj)` which is invalid.
    expect(projectEntry(entry({ timestamp: { foo: 1 } as any })).timestamp).toBeUndefined();
  });

  it('listGcnvLogsHandler clamps a zero pageSize up to 1', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    await listGcnvLogsHandler({ projectId: 'p1', pageSize: 0 });

    expect(getEntries.mock.calls[0][0].pageSize).toBe(1);
  });

  it('listGcnvLogsHandler honors ascending order and a page token', async () => {
    const getEntries = vi.fn().mockResolvedValue([[], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    await listGcnvLogsHandler({ projectId: 'p1', orderBy: 'timestamp asc', pageToken: 'tok-1' });

    const callArg = getEntries.mock.calls[0][0];
    expect(callArg.orderBy).toBe('timestamp asc');
    expect(callArg.pageToken).toBe('tok-1');
  });

  it('listGcnvLogsHandler tolerates a missing entries array and apiResponse', async () => {
    const getEntries = vi.fn().mockResolvedValue([undefined, {}, undefined]);
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    const result = await listGcnvLogsHandler({ projectId: 'p1' });

    expect(result.structuredContent).toMatchObject({ count: 0, nextPageToken: undefined });
  });

  it('listGcnvLogsHandler falls back to "Unknown error" when the error has no message', async () => {
    const getEntries = vi.fn().mockRejectedValue({});
    createClientMock.mockReturnValue({ getEntries });

    const { listGcnvLogsHandler } = await import('./logs-handler.js');
    const result = await listGcnvLogsHandler({ projectId: 'p1' });
    expect(result.structuredContent).toMatchObject({ error: 'Unknown error' });
  });

  it('gcnvLogSummaryHandler returns a filter error for an invalid resourceType', async () => {
    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1', resourceType: 'bogus' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: expect.stringContaining('resourceType'),
    });
  });

  it('gcnvLogSummaryHandler clamps maxEntries and counts entries with missing fields', async () => {
    // A single entry with no severity/method/resource exercises the default buckets.
    const getEntries = vi.fn().mockResolvedValue([[entry({})], {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1', maxEntries: 99999 });

    // pageSize is bounded by MAX_PAGE_SIZE (200) even though maxEntries clamps to 1000.
    expect(getEntries.mock.calls[0][0].pageSize).toBe(200);
    expect(result.structuredContent).toMatchObject({
      totalEntries: 1,
      bySeverity: { UNKNOWN: 1 },
      byMethod: {},
      byResource: {},
    });
  });

  it('gcnvLogSummaryHandler marks truncated when maxEntries is reached with more pages', async () => {
    const getEntries = vi
      .fn()
      .mockResolvedValue([
        [
          entry({ severity: 'INFO', methodName: 'x.A', resourceName: 'r1' }),
          entry({ severity: 'INFO', methodName: 'x.A', resourceName: 'r1' }),
        ],
        {},
        { nextPageToken: 'more' },
      ]);
    createClientMock.mockReturnValue({ getEntries });

    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1', maxEntries: 1 });

    expect(result.structuredContent).toMatchObject({ truncated: true });
    // The loop stops after the first page despite the next-page token.
    expect(getEntries).toHaveBeenCalledTimes(1);
  });

  it('gcnvLogSummaryHandler tolerates a missing entries array in a page', async () => {
    const getEntries = vi.fn().mockResolvedValue([undefined, {}, {}]);
    createClientMock.mockReturnValue({ getEntries });

    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1' });
    expect(result.structuredContent).toMatchObject({ totalEntries: 0 });
  });

  it('gcnvLogSummaryHandler falls back to "Unknown error" when the error has no message', async () => {
    const getEntries = vi.fn().mockRejectedValue({});
    createClientMock.mockReturnValue({ getEntries });

    const { gcnvLogSummaryHandler } = await import('./logs-handler.js');
    const result = await gcnvLogSummaryHandler({ projectId: 'p1' });
    expect(result.structuredContent).toMatchObject({ error: 'Unknown error' });
  });
});

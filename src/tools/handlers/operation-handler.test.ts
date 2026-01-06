import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const axiosRequestMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

vi.mock('axios', () => ({
  default: {
    request: axiosRequestMock,
  },
}));

describe('operation-handler', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    axiosRequestMock.mockReset();
  });

  it('getOperationHandler calls axios with bearer token and returns structuredContent', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { name: 'operations/op1', done: true, response: { ok: true } },
    });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(axiosRequestMock).toHaveBeenCalledWith({
      url: 'https://netapp.googleapis.com/v1/operations/op1',
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    });
    expect(result.structuredContent).toMatchObject({
      name: 'operations/op1',
      done: true,
      success: true,
      response: { ok: true },
    });
  });

  it('getOperationHandler handles operation without metadata/response/error fields (covers false branches)', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { name: 'operations/op1', done: false },
    });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({
      name: 'operations/op1',
      done: false,
      success: false,
    });
    expect((result.structuredContent as any).metadata).toBeUndefined();
    expect((result.structuredContent as any).response).toBeUndefined();
    expect((result.structuredContent as any).error).toBeUndefined();
  });

  it('cancelOperationHandler returns early when operation is already done', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValueOnce({ data: { done: true } });

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    // Only the GET should happen
    expect(axiosRequestMock).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toEqual({
      success: false,
      message: 'Operation already completed',
    });
  });

  it('cancelOperationHandler posts cancel when not done', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValueOnce({ data: { done: false } });
    axiosRequestMock.mockResolvedValueOnce({ data: {} });

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(axiosRequestMock).toHaveBeenNthCalledWith(1, {
      url: 'https://netapp.googleapis.com/v1/operations/op1',
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    });
    expect(axiosRequestMock).toHaveBeenNthCalledWith(2, {
      url: 'https://netapp.googleapis.com/v1/operations/op1:cancel',
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    });
    expect(result.structuredContent).toEqual({
      success: true,
      message: 'Cancellation request submitted successfully',
    });
  });

  it('listOperationsHandler calls list url and returns formatted operations', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: {
        operations: [
          {
            name: 'operations/op1',
            done: true,
            metadata: { target: 't1', verb: 'GET', statusMessage: 'ok', createTime: 'now' },
          },
          { name: 'operations/op2', done: false },
        ],
        nextPageToken: 'next',
      },
    });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(axiosRequestMock).toHaveBeenCalledWith({
      url: 'https://netapp.googleapis.com/v1/projects/p1/locations/us-central1/operations',
      method: 'GET',
      params: {},
      headers: { Authorization: 'Bearer tok' },
    });
    expect(result.structuredContent).toMatchObject({
      operations: [
        expect.objectContaining({
          name: 'operations/op1',
          done: true,
          success: true,
          target: 't1',
          verb: 'GET',
          statusMessage: 'ok',
          createTime: 'now',
        }),
        expect.objectContaining({ name: 'operations/op2', done: false, success: false }),
      ],
      nextPageToken: 'next',
    });
  });

  it('getOperationHandler returns error structuredContent on axios failure', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockRejectedValue(new Error('net'));

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ error: 'net' });
  });

  it('getOperationHandler includes parsed metadata fields and operation error when present', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: {
        name: 'operations/op1',
        done: true,
        metadata: {
          createTime: 'now',
          target: 't',
          verb: 'v',
          statusMessage: 's',
          apiVersion: '1',
          requestedCancellation: true,
        },
        error: { code: 3, message: 'bad' },
      },
    });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({
      createTime: 'now',
      target: 't',
      verb: 'v',
      statusMessage: 's',
      apiVersion: '1',
      cancelRequested: true,
      error: { code: 3, message: 'bad' },
    });
  });

  it('getOperationHandler handles exceptions while parsing operation.metadata', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });

    const badMetadata = {};
    Object.defineProperty(badMetadata, 'createTime', {
      get() {
        throw new Error('bad-metadata');
      },
    });

    axiosRequestMock.mockResolvedValue({
      data: {
        name: 'operations/op1',
        done: true,
        metadata: badMetadata,
      },
    });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    // Still returns, and includes the metadata field (set before parsing begins)
    expect(result.structuredContent).toMatchObject({
      name: 'operations/op1',
      done: true,
      success: true,
    });
  });

  it('cancelOperationHandler returns error structuredContent on axios failure', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockRejectedValue(new Error('net'));

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ success: false, message: 'net' });
  });

  it('cancelOperationHandler falls back to "Unknown error" when error.message is missing', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockRejectedValue({});

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toEqual({ success: false, message: 'Unknown error' });
    expect((result as any).content?.[0]?.text).toContain('Unknown error');
  });

  it('listOperationsHandler returns error structuredContent on axios failure', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockRejectedValue(new Error('net'));

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ operations: [], error: 'net' });
  });

  it('listOperationsHandler formats operations with no metadata (covers false branches)', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { operations: [{ name: 'operations/op1', done: true }], nextPageToken: 'n' },
    });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({
      operations: [expect.objectContaining({ name: 'operations/op1', done: true, success: true })],
      nextPageToken: 'n',
    });
    expect((result.structuredContent as any).operations[0].target).toBeUndefined();
  });

  it('listOperationsHandler passes filter/pageSize/pageToken params when provided', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { operations: [], nextPageToken: 'n' },
    });

    const { listOperationsHandler } = await import('./operation-handler.js');
    await listOperationsHandler({
      projectId: 'p1',
      location: 'us-central1',
      filter: 'done=true',
      pageSize: 10,
      pageToken: 'pt',
    });

    expect(axiosRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { filter: 'done=true', pageSize: 10, pageToken: 'pt' },
      })
    );
  });

  it('listOperationsHandler handles missing operations array (covers operations || [] branch)', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { nextPageToken: 'n' },
    });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ operations: [], nextPageToken: 'n' });
  });

  it('getOperationHandler covers done=false with error/response present (branches should not attach)', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { done: false, error: { code: 1, message: 'e' }, response: { ok: true } },
    });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ done: false, success: false });
    expect((result.structuredContent as any).error).toBeUndefined();
    expect((result.structuredContent as any).response).toBeUndefined();
  });

  it('getOperationHandler handles operation without name (covers operation.name || "" branch)', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { done: true, response: { ok: true } },
    });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ name: '' });
  });

  it('listOperationsHandler handles operations missing name and metadata fields (covers op.name || "" branch)', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockResolvedValue({
      data: { operations: [{ done: true, metadata: {} }], nextPageToken: 'n' },
    });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).operations[0]).toMatchObject({
      name: '',
      done: true,
      success: true,
    });
  });

  it('listOperationsHandler returns Unknown error when thrown error has no message', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockRejectedValue({});

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ error: 'Unknown error' });
  });

  it('getOperationHandler returns Unknown error when thrown error has no message', async () => {
    createClientMock.mockReturnValue({
      auth: { getAccessToken: vi.fn().mockResolvedValue('tok') },
    });
    axiosRequestMock.mockRejectedValue({});

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toEqual({ error: 'Unknown error' });
  });
});

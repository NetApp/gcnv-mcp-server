import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

/** Helper to create an async iterable from an array */
function asyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) {
        yield item;
      }
    },
  };
}

/** Helper to create an async iterable that fails on iteration */
function failingAsyncIterable(error: Error): AsyncIterable<never> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          throw error;
        },
      };
    },
  };
}

describe('operation-handler', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('getOperationHandler uses client.getOperation and returns structuredContent', async () => {
    const getOperation = vi
      .fn()
      .mockResolvedValue([{ name: 'operations/op1', done: true, response: { ok: true } }]);
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(getOperation).toHaveBeenCalledWith({ name: 'operations/op1' });
    expect(result.structuredContent).toMatchObject({
      name: 'operations/op1',
      done: true,
      success: true,
      response: { ok: true },
    });
  });

  it('getOperationHandler handles operation without metadata/response/error fields (covers false branches)', async () => {
    const getOperation = vi.fn().mockResolvedValue([{ name: 'operations/op1', done: false }]);
    createClientMock.mockReturnValue({ getOperation });

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
    const getOperation = vi.fn().mockResolvedValue([{ done: true }]);
    const cancelOperation = vi.fn();
    createClientMock.mockReturnValue({ getOperation, cancelOperation });

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(getOperation).toHaveBeenCalledWith({ name: 'operations/op1' });
    expect(cancelOperation).not.toHaveBeenCalled();
    expect(result.structuredContent).toEqual({
      success: false,
      message: 'Operation already completed',
    });
  });

  it('cancelOperationHandler calls cancelOperation when not done', async () => {
    const getOperation = vi.fn().mockResolvedValue([{ done: false }]);
    const cancelOperation = vi.fn().mockResolvedValue(undefined);
    createClientMock.mockReturnValue({ getOperation, cancelOperation });

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(getOperation).toHaveBeenCalledWith({ name: 'operations/op1' });
    expect(cancelOperation).toHaveBeenCalledWith({ name: 'operations/op1' });
    expect(result.structuredContent).toEqual({
      success: true,
      message: 'Cancellation request submitted successfully',
    });
  });

  it('listOperationsHandler uses listOperationsAsync and returns formatted operations', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(
      asyncIterable([
        {
          name: 'operations/op1',
          done: true,
          metadata: { target: 't1', verb: 'GET', statusMessage: 'ok', createTime: 'now' },
        },
        { name: 'operations/op2', done: false },
      ])
    );
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(listOperationsAsync).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/operations',
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
    });
    expect((result.structuredContent as any).nextPageToken).toBeUndefined();
  });

  it('getOperationHandler returns error structuredContent on getOperation failure', async () => {
    const getOperation = vi.fn().mockRejectedValue(new Error('net'));
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ error: 'net' });
  });

  it('getOperationHandler includes parsed metadata fields and operation error when present', async () => {
    const getOperation = vi.fn().mockResolvedValue([
      {
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
    ]);
    createClientMock.mockReturnValue({ getOperation });

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

  it('getOperationHandler converts metadata.createTime seconds object to ISO string', async () => {
    const getOperation = vi.fn().mockResolvedValue([
      {
        name: 'operations/op-seconds',
        done: true,
        metadata: {
          createTime: { seconds: 1 },
        },
      },
    ]);
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op-seconds' });
    expect((result.structuredContent as any).createTime).toBe('1970-01-01T00:00:01.000Z');
  });

  it('getOperationHandler handles exceptions while parsing operation.metadata', async () => {
    const badMetadata = {};
    Object.defineProperty(badMetadata, 'createTime', {
      get() {
        throw new Error('bad-metadata');
      },
    });

    const getOperation = vi
      .fn()
      .mockResolvedValue([{ name: 'operations/op1', done: true, metadata: badMetadata }]);
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({
      name: 'operations/op1',
      done: true,
      success: true,
    });
  });

  it('cancelOperationHandler returns error structuredContent on getOperation failure', async () => {
    const getOperation = vi.fn().mockRejectedValue(new Error('net'));
    createClientMock.mockReturnValue({ getOperation });

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ success: false, message: 'net' });
  });

  it('cancelOperationHandler falls back to "Unknown error" when error.message is missing', async () => {
    const getOperation = vi.fn().mockRejectedValue({});
    createClientMock.mockReturnValue({ getOperation });

    const { cancelOperationHandler } = await import('./operation-handler.js');
    const result = await cancelOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toEqual({ success: false, message: 'Unknown error' });
    expect((result as any).content?.[0]?.text).toContain('Unknown error');
  });

  it('listOperationsHandler returns error structuredContent on listOperationsAsync failure', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(failingAsyncIterable(new Error('net')));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ operations: [], error: 'net' });
  });

  it('listOperationsHandler formats operations with no metadata (covers false branches)', async () => {
    const listOperationsAsync = vi
      .fn()
      .mockReturnValue(asyncIterable([{ name: 'operations/op1', done: true }]));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({
      operations: [expect.objectContaining({ name: 'operations/op1', done: true, success: true })],
    });
    expect((result.structuredContent as any).operations[0].target).toBeUndefined();
  });

  it('listOperationsHandler passes filter/pageSize/pageToken in request when provided', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(asyncIterable([]));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    await listOperationsHandler({
      projectId: 'p1',
      location: 'us-central1',
      filter: 'done=true',
      pageSize: 10,
      pageToken: 'pt',
    });

    expect(listOperationsAsync).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/operations',
      filter: 'done=true',
      pageSize: 10,
      pageToken: 'pt',
    });
  });

  it('listOperationsHandler handles empty iterable', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(asyncIterable([]));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ operations: [] });
  });

  it('getOperationHandler covers done=false with error/response present (branches should not attach)', async () => {
    const getOperation = vi
      .fn()
      .mockResolvedValue([
        { done: false, error: { code: 1, message: 'e' }, response: { ok: true } },
      ]);
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ done: false, success: false });
    expect((result.structuredContent as any).error).toBeUndefined();
    expect((result.structuredContent as any).response).toBeUndefined();
  });

  it('getOperationHandler handles operation without name (covers operation.name || "" branch)', async () => {
    const getOperation = vi.fn().mockResolvedValue([{ done: true, response: { ok: true } }]);
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toMatchObject({ name: '' });
  });

  it('listOperationsHandler handles operations missing name and metadata fields (covers op.name || "" branch)', async () => {
    const listOperationsAsync = vi
      .fn()
      .mockReturnValue(asyncIterable([{ done: true, metadata: {} }]));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).operations[0]).toMatchObject({
      name: '',
      done: true,
      success: true,
    });
  });

  it('listOperationsHandler returns Unknown error when thrown error has no message', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(failingAsyncIterable(new Error('')));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ error: 'Unknown error' });
  });

  it('getOperationHandler returns Unknown error when thrown error has no message', async () => {
    const getOperation = vi.fn().mockRejectedValue(new Error());
    createClientMock.mockReturnValue({ getOperation });

    const { getOperationHandler } = await import('./operation-handler.js');
    const result = await getOperationHandler({ operationName: 'operations/op1' });

    expect(result.structuredContent).toEqual({ error: 'Unknown error' });
  });

  it('listOperationsHandler uses location "-" when location omitted', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(asyncIterable([]));
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    await listOperationsHandler({ projectId: 'p1' });

    expect(listOperationsAsync).toHaveBeenCalledWith({
      name: 'projects/p1/locations/-/operations',
    });
  });

  it('listOperationsHandler formats metadata.createTime seconds objects to ISO string', async () => {
    const listOperationsAsync = vi.fn().mockReturnValue(
      asyncIterable([
        {
          name: 'operations/op-seconds',
          done: true,
          metadata: { createTime: { seconds: 1 } },
        },
      ])
    );
    createClientMock.mockReturnValue({ listOperationsAsync });

    const { listOperationsHandler } = await import('./operation-handler.js');
    const result = await listOperationsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).operations[0].createTime).toBe(
      '1970-01-01T00:00:01.000Z'
    );
  });
});

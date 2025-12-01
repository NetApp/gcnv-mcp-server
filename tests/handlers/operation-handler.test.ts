import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosRequestMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    request: (...args: any[]) => axiosRequestMock(...args),
  },
}));

const clientRef = vi.hoisted(() => ({ current: {} as Record<string, any> | undefined }));
const createClientMock = vi.hoisted(() =>
  vi.fn(() => clientRef.current),
);

vi.mock('../../src/utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: {
    createClient: (...args: any[]) => createClientMock(...args),
    clearCache: vi.fn(),
    reset: vi.fn(),
  },
}));

let client: Record<string, any>;

import {
  cancelOperationHandler,
  getOperationHandler,
  listOperationsHandler,
} from '../../src/tools/handlers/operation-handler.js';

beforeEach(() => {
  client = {
    auth: {
      getAccessToken: vi.fn().mockResolvedValue('token'),
    },
  };
  clientRef.current = client;
  createClientMock.mockClear();
  axiosRequestMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('operation handlers', () => {
  it('retrieves and parses an operation', async () => {
    axiosRequestMock.mockResolvedValueOnce({
      data: {
        name: 'operations/1',
        done: true,
        metadata: {
          createTime: 'now',
          target: 'resource',
          verb: 'create',
          statusMessage: 'ok',
        },
        response: { result: 'success' },
      },
    });

    const result = await getOperationHandler({ operationName: 'operations/1' }, {});

    expect(axiosRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://netapp.googleapis.com/v1/operations/1',
      }),
    );
    expect(result.structuredContent).toMatchObject({
      name: 'operations/1',
      done: true,
      response: { result: 'success' },
      target: 'resource',
      verb: 'create',
    });
  });

  it('cancels an active operation', async () => {
    axiosRequestMock
      .mockResolvedValueOnce({ data: { done: false } }) // initial GET
      .mockResolvedValueOnce({ data: {} }); // cancel POST

    const result = await cancelOperationHandler({ operationName: 'operations/1' }, {});

    expect(axiosRequestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'GET',
        url: 'https://netapp.googleapis.com/v1/operations/1',
      }),
    );
    expect(axiosRequestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: 'https://netapp.googleapis.com/v1/operations/1:cancel',
      }),
    );
    expect(result.structuredContent).toEqual({
      success: true,
      message: 'Cancellation request submitted successfully',
    });
  });

  it('lists operations and returns structured content', async () => {
    axiosRequestMock.mockResolvedValueOnce({
      data: {
        operations: [
          {
            name: 'operations/1',
            done: false,
            metadata: { verb: 'create', target: 'resource' },
          },
        ],
        nextPageToken: 'next-1',
      },
    });

    const result = await listOperationsHandler(
      { projectId: 'proj', location: 'us-central1', pageSize: 10 },
      {},
    );

    expect(axiosRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { pageSize: 10 },
        method: 'GET',
      }),
    );
    expect(result.structuredContent).toEqual({
      operations: [
        {
          name: 'operations/1',
          done: false,
          target: 'resource',
          verb: 'create',
        },
      ],
      nextPageToken: 'next-1',
    });
  });
});


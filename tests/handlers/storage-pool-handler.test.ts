import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  createStoragePoolHandler,
  deleteStoragePoolHandler,
  getStoragePoolHandler,
  listStoragePoolsHandler,
  updateStoragePoolHandler,
} from '../../src/tools/handlers/storage-pool-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  storagePoolId: 'pool1',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('storage pool handlers', () => {
  it('creates a storage pool', async () => {
    client.createStoragePool = vi.fn().mockResolvedValue([{ name: 'operations/create' }]);

    const result = await createStoragePoolHandler(
      {
        ...baseArgs,
        capacityGib: 100,
        serviceLevel: 'PREMIUM',
        description: 'Pool',
        labels: { env: 'test' },
        networkConfig: { network: 'default' },
      },
      {},
    );

    expect(client.createStoragePool).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1',
      storagePoolId: 'pool1',
      storagePool: {
        capacityGib: 100,
        serviceLevel: 'PREMIUM',
        description: 'Pool',
        labels: { env: 'test' },
        networkConfig: { network: 'default' },
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/storagePools/pool1',
      operationId: 'operations/create',
    });
  });

  it('deletes a storage pool', async () => {
    client.deleteStoragePool = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);

    const result = await deleteStoragePoolHandler(
      { ...baseArgs, force: true },
      {},
    );

    expect(client.deleteStoragePool).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/storagePools/pool1',
      force: true,
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('retrieves a storage pool and maps structured content', async () => {
    client.getStoragePool = vi.fn().mockResolvedValue([
      {
        name: 'projects/proj/locations/us/storagePools/pool1',
        capacityGib: 200,
        volumeCapacityGib: 50,
        volumeCount: 2,
        serviceLevel: 'PREMIUM',
        state: 'READY',
        createTime: { seconds: 1700000000 },
        labels: { env: 'test' },
      },
    ]);

    const result = await getStoragePoolHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      storagePoolId: 'pool1',
      capacityGib: 200,
      volumeCapacityGib: 50,
      volumecount: 2,
      serviceLevel: 'PREMIUM',
      state: 'READY',
    });
  });

  it('lists storage pools with pagination token', async () => {
    client.listStoragePools = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/proj/locations/us/storagePools/pool1',
          capacityGib: 10,
          volumeCapacityGib: 5,
          volumeCount: 1,
          state: 'READY',
        },
      ],
      undefined,
      { nextPageToken: 'token-1' },
    ]);

    const result = await listStoragePoolsHandler(
      { ...baseArgs, filter: 'state=READY' },
      {},
    );

    expect(result.structuredContent).toEqual({
      storagePools: [
        expect.objectContaining({
          storagePoolId: 'pool1',
          state: 'READY',
        }),
      ],
      nextPageToken: 'token-1',
    });
  });

  it('updates a storage pool with update mask', async () => {
    client.updateStoragePool = vi.fn().mockResolvedValue([{ name: 'operations/update' }]);

    const result = await updateStoragePoolHandler(
      { ...baseArgs, capacityGib: 500, description: 'Updated', labels: { env: 'prod' } },
      {},
    );

    expect(client.updateStoragePool).toHaveBeenCalledWith({
      storagePool: {
        name: 'projects/proj/locations/us-central1/storagePools/pool1',
        capacityGib: 500,
        description: 'Updated',
        labels: { env: 'prod' },
      },
      updateMask: {
        paths: ['capacity_gib', 'description', 'labels'],
      },
    });
    expect(result.structuredContent).toEqual({
      name: expect.any(String),
      operationId: 'operations/update',
    });
  });
});


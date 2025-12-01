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
  createVolumeHandler,
  deleteVolumeHandler,
  getVolumeHandler,
  listVolumesHandler,
  updateVolumeHandler,
} from '../../src/tools/handlers/volume-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  volumeId: 'vol1',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('volume handlers', () => {
  it('creates a volume', async () => {
    client.createVolume = vi.fn().mockResolvedValue([{ name: 'operations/create' }]);

    const result = await createVolumeHandler(
      {
        ...baseArgs,
        storagePoolId: 'pool1',
        capacityGib: 100,
        protocols: ['NFS3'],
        description: 'Volume',
        labels: { env: 'test' },
        shareName: 'share1',
      },
      {},
    );

    expect(client.createVolume).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1',
      volumeId: 'vol1',
      volume: expect.objectContaining({
        storagePool: 'pool1',
        capacityGib: 100,
        shareName: 'share1',
      }),
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/volumes/vol1',
      operationId: 'operations/create',
    });
  });

  it('deletes a volume with force flag when true', async () => {
    client.deleteVolume = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);

    const result = await deleteVolumeHandler(
      { ...baseArgs, force: true },
      {},
    );

    expect(client.deleteVolume).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/volumes/vol1',
      force: true,
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('retrieves and formats a volume', async () => {
    client.getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/proj/locations/us/volumes/vol1',
        capacityGib: 200,
        usedGib: 50,
        state: 'READY',
        shareName: 'share',
        protocols: ['NFS3'],
        storagePool: 'projects/proj/locations/us/storagePools/pool1',
        mountOptions: [{ protocol: 'NFS3', ipAddress: '10.0.0.1' }],
      },
    ]);

    const result = await getVolumeHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      volumeId: 'vol1',
      capacityGib: 200,
      usedGib: 50,
      protocols: ['NFS3'],
    });
  });

  it('lists volumes and surfaces structured content', async () => {
    client.listVolumes = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/proj/locations/us/volumes/vol1',
          capacityGib: 10,
          state: 'READY',
        },
      ],
      undefined,
      'token-1',
    ]);

    const result = await listVolumesHandler(
      { ...baseArgs, projectId: 'proj', location: 'us' },
      {},
    );

    expect(result.structuredContent).toEqual({
      volumes: [
        expect.objectContaining({
          volumeId: 'vol1',
          capacityGib: 10,
        }),
      ],
      nextPageToken: '',
    });
  });

  it('updates a volume using update mask', async () => {
    client.updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/update' }]);

    const result = await updateVolumeHandler(
      {
        ...baseArgs,
        capacityGib: 400,
        description: 'New description',
        labels: { env: 'prod' },
      },
      {},
    );

    expect(client.updateVolume).toHaveBeenCalledWith({
      volume: {
        capacityGib: 400,
        description: 'New description',
        labels: { env: 'prod' },
      },
      name: 'projects/proj/locations/us-central1/volumes/vol1',
      updateMask: {
        paths: ['capacityGib', 'description', 'labels'],
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/volumes/vol1',
      operationId: 'operations/update',
    });
  });
});


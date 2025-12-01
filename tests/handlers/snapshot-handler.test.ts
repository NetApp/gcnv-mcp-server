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
  createSnapshotHandler,
  deleteSnapshotHandler,
  getSnapshotHandler,
  listSnapshotsHandler,
  revertVolumeToSnapshotHandler,
} from '../../src/tools/handlers/snapshot-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  volumeId: 'vol1',
  snapshotId: 'snap1',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('snapshot handlers', () => {
  it('creates a snapshot', async () => {
    client.createSnapshot = vi.fn().mockResolvedValue([{ name: 'operations/create' }]);

    const result = await createSnapshotHandler(
      { ...baseArgs, description: 'snapshot', labels: { env: 'test' } },
      {},
    );

    expect(client.createSnapshot).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1/volumes/vol1',
      snapshotId: 'snap1',
      snapshot: { description: 'snapshot', labels: { env: 'test' } },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/volumes/vol1/snapshots/snap1',
      operationId: 'operations/create',
    });
  });

  it('deletes a snapshot', async () => {
    client.deleteSnapshot = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);

    const result = await deleteSnapshotHandler(baseArgs, {});

    expect(client.deleteSnapshot).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/volumes/vol1/snapshots/snap1',
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('retrieves a snapshot and formats response', async () => {
    client.getSnapshot = vi.fn().mockResolvedValue([
      {
        name: 'projects/proj/locations/us/volumes/vol1/snapshots/snap1',
        state: 'READY',
        createTime: { seconds: 1700000000 },
      },
    ]);

    const result = await getSnapshotHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      snapshotId: 'snap1',
      volumeId: 'vol1',
      state: 'READY',
    });
  });

  it('lists snapshots and returns pagination tokens', async () => {
    client.listSnapshots = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/proj/locations/us/volumes/vol1/snapshots/snap1',
          state: 'READY',
        },
      ],
      undefined,
      'token-1',
    ]);

    const result = await listSnapshotsHandler(baseArgs, {});

    expect(result.structuredContent).toEqual({
      snapshots: [
        expect.objectContaining({
          snapshotId: 'snap1',
          state: 'READY',
        }),
      ],
      nextPageToken: 'token-1',
    });
  });

  it('reverts a volume to a snapshot', async () => {
    client.revertVolume = vi.fn().mockResolvedValue([{ name: 'operations/revert' }]);

    const result = await revertVolumeToSnapshotHandler(baseArgs, {});

    expect(client.revertVolume).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/volumes/vol1',
      snapshot: 'projects/proj/locations/us-central1/volumes/vol1/snapshots/snap1',
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/revert',
    });
  });
});


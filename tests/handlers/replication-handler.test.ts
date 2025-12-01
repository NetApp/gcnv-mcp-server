import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@google-cloud/netapp', () => ({
  __esModule: true,
  protos: {
    google: {
      cloud: {
        netapp: {
          v1: {
            Replication: {
              ReplicationSchedule: {
                HOURLY: 'HOURLY',
              },
            },
          },
        },
      },
    },
  },
}));

let client: Record<string, any>;

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

import {
  createReplicationHandler,
  deleteReplicationHandler,
  getReplicationHandler,
  listReplicationsHandler,
  updateReplicationHandler,
  resumeReplicationHandler,
  stopReplicationHandler,
  reverseReplicationDirectionHandler,
} from '../../src/tools/handlers/replication-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  replicationId: 'rep1',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('replication handlers', () => {
  it('creates a replication and returns operation info', async () => {
    client.createReplication = vi.fn().mockResolvedValue([{ name: 'operations/create' }]);

    const result = await createReplicationHandler(
      {
        ...baseArgs,
        sourceVolumeId: 'volA',
        destinationStoragePool: 'projects/proj/locations/us/storagePools/poolB',
        destinationVolumeId: 'volB',
      },
      {},
    );

    expect(client.createReplication).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1/volumes/volA',
      replicationId: 'rep1',
      replication: expect.objectContaining({
        destinationVolume:
          'projects/proj/locations/us-central1/volumes/volB',
        sourceVolume: 'projects/proj/locations/us-central1/volumes/volA',
        destinationVolumeParameters: {
          storagePool: 'projects/proj/locations/us/storagePools/poolB',
        },
      }),
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/replications/rep1',
      operationId: 'operations/create',
    });
  });

  it('deletes a replication', async () => {
    client.deleteReplication = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);

    const result = await deleteReplicationHandler(baseArgs, {});

    expect(client.deleteReplication).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/replications/rep1',
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('retrieves a replication and formats data', async () => {
    client.getReplication = vi.fn().mockResolvedValue([
      {
        name: 'projects/proj/locations/us/replications/rep1',
        sourceVolume: 'projects/proj/locations/us/volumes/volA',
        destinationVolume: 'projects/proj/locations/us/volumes/volB',
        state: 'READY',
        healthy: true,
        createTime: { seconds: 1700000000 },
        lastReplicationTime: { seconds: 1700000100 },
      },
    ]);

    const result = await getReplicationHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      replicationId: 'rep1',
      sourceVolume: expect.stringContaining('volA'),
      destinationVolume: expect.stringContaining('volB'),
      healthy: true,
    });
  });

  it('lists replications and returns structured entries', async () => {
    client.listReplications = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/proj/locations/us/replications/rep1',
          state: 'READY',
          sourceVolume: 'projects/proj/locations/us/volumes/volA',
          destinationVolume: 'projects/proj/locations/us/volumes/volB',
        },
      ],
      undefined,
      'token-1',
    ]);

    const result = await listReplicationsHandler(
      { ...baseArgs, volumeId: 'volA' },
      {},
    );

    expect(result.structuredContent).toEqual({
      replications: [
        expect.objectContaining({
          replicationId: 'rep1',
          state: 'READY',
        }),
      ],
      nextPageToken: 'token-1',
    });
  });

  it('updates a replication and builds update mask', async () => {
    client.updateReplication = vi.fn().mockResolvedValue([{ name: 'operations/update' }]);

    const result = await updateReplicationHandler(
      { ...baseArgs, description: 'new description', labels: { env: 'prod' } },
      {},
    );

    expect(client.updateReplication).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/replications/rep1',
      replication: {
        description: 'new description',
        labels: { env: 'prod' },
      },
      updateMask: {
        paths: ['description', 'labels'],
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/replications/rep1',
      operationId: 'operations/update',
    });
  });

  it('resumes a replication', async () => {
    client.resumeReplication = vi.fn().mockResolvedValue([{ name: 'operations/resume' }]);

    const result = await resumeReplicationHandler(baseArgs, {});

    expect(client.resumeReplication).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/replications/rep1',
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/replications/rep1',
      operationId: 'operations/resume',
    });
  });

  it('stops a replication', async () => {
    client.stopReplication = vi.fn().mockResolvedValue([{ name: 'operations/stop' }]);

    const result = await stopReplicationHandler(baseArgs, {});

    expect(client.stopReplication).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/replications/rep1',
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/replications/rep1',
      operationId: 'operations/stop',
    });
  });

  it('reverses replication direction', async () => {
    client.reverseReplicationDirection = vi.fn().mockResolvedValue([
      { name: 'operations/reverse' },
    ]);

    const result = await reverseReplicationDirectionHandler(baseArgs, {});

    expect(client.reverseReplicationDirection).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/replications/rep1',
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/replications/rep1',
      operationId: 'operations/reverse',
    });
  });
});


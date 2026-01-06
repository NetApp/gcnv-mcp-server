import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('replication-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createReplicationHandler calls createReplication and returns operationId', async () => {
    const createReplication = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createReplication });

    const { createReplicationHandler } = await import('./replication-handler.js');
    const result = await createReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      replicationId: 'r1',
      sourceVolumeId: 'vol1',
      destinationStoragePool: 'projects/p1/locations/us-central1/storagePools/sp2',
      replicationSchedule: 'DAILY',
    });

    expect(createReplication).toHaveBeenCalledTimes(1);
    const req = createReplication.mock.calls[0]?.[0];
    expect(req).toMatchObject({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      replicationId: 'r1',
      replication: {
        destinationVolumeParameters: {
          storagePool: 'projects/p1/locations/us-central1/storagePools/sp2',
        },
        sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
      },
    });
    expect(typeof req.replication.replicationSchedule).toBe('number');
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      operationId: 'op-create',
    });
  });

  it('createReplicationHandler falls back to operationId="Unknown" when operation.name is missing', async () => {
    const createReplication = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ createReplication });

    const { createReplicationHandler } = await import('./replication-handler.js');
    const result = await createReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      replicationId: 'r1',
      sourceVolumeId: 'vol1',
      destinationStoragePool: 'projects/p1/locations/us-central1/storagePools/sp2',
      replicationSchedule: 'DAILY',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      operationId: 'Unknown',
    });
  });

  it('createReplicationHandler defaults replicationSchedule when provided value is unknown', async () => {
    const createReplication = vi.fn().mockResolvedValue([{ name: 'op-create-x' }]);
    createClientMock.mockReturnValue({ createReplication });

    const { createReplicationHandler } = await import('./replication-handler.js');
    const result = await createReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      replicationId: 'r1',
      sourceVolumeId: 'vol1',
      destinationStoragePool: 'projects/p1/locations/us-central1/storagePools/sp2',
      replicationSchedule: 'NOT_A_REAL_SCHEDULE',
    });

    const req = createReplication.mock.calls[0]?.[0];
    expect(typeof req.replication.replicationSchedule).toBe('number');
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create-x' });
  });

  it('createReplicationHandler supports EVERY_10_MINUTES schedule', async () => {
    const createReplication = vi.fn().mockResolvedValue([{ name: 'op-10m' }]);
    createClientMock.mockReturnValue({ createReplication });

    const { createReplicationHandler } = await import('./replication-handler.js');
    const result = await createReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      replicationId: 'r1',
      sourceVolumeId: 'vol1',
      destinationStoragePool: 'projects/p1/locations/us-central1/storagePools/sp2',
      replicationSchedule: 'EVERY_10_MINUTES',
    });

    expect(createReplication).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({ operationId: 'op-10m' });
  });

  it('createReplicationHandler supports HOURLY schedule and includes description/labels when provided', async () => {
    const createReplication = vi.fn().mockResolvedValue([{ name: 'op-hourly' }]);
    createClientMock.mockReturnValue({ createReplication });

    const { createReplicationHandler } = await import('./replication-handler.js');
    const result = await createReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      replicationId: 'r1',
      sourceVolumeId: 'vol1',
      destinationStoragePool: 'projects/p1/locations/us-central1/storagePools/sp2',
      replicationSchedule: 'HOURLY',
      description: 'd',
      labels: { a: 'b' },
    });

    const req = createReplication.mock.calls[0]?.[0];
    expect(req.replication).toMatchObject({ description: 'd', labels: { a: 'b' } });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-hourly' });
  });

  it('createReplicationHandler covers error path', async () => {
    const createReplication = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ createReplication });

    const { createReplicationHandler } = await import('./replication-handler.js');
    const result = await createReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      replicationId: 'r1',
      sourceVolumeId: 'vol1',
      destinationStoragePool: 'projects/p1/locations/us-central1/storagePools/sp2',
      replicationSchedule: 'DAILY',
    });

    expect((result as any).isError).toBe(true);
  });

  it('deleteReplicationHandler calls deleteReplication', async () => {
    const deleteReplication = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteReplication });

    const { deleteReplicationHandler } = await import('./replication-handler.js');
    const result = await deleteReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(deleteReplication).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteReplicationHandler falls back to empty operationId when operation.name is missing', async () => {
    const deleteReplication = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteReplication });

    const { deleteReplicationHandler } = await import('./replication-handler.js');
    const result = await deleteReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('deleteReplicationHandler covers error path', async () => {
    const deleteReplication = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ deleteReplication });

    const { deleteReplicationHandler } = await import('./replication-handler.js');
    const result = await deleteReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect((result as any).isError).toBe(true);
    expect((result as any).structuredContent).toMatchObject({ success: false });
  });

  it('getReplicationHandler calls getReplication and returns formatted replication', async () => {
    const getReplication = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getReplication });

    const { getReplicationHandler } = await import('./replication-handler.js');
    const result = await getReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(getReplication).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      replicationId: 'r1',
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getReplicationHandler formats lastReplicationTime when present', async () => {
    const getReplication = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
        lastReplicationTime: { seconds: 2 },
      },
    ]);
    createClientMock.mockReturnValue({ getReplication });

    const { getReplicationHandler } = await import('./replication-handler.js');
    const result = await getReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect((result.structuredContent as any).lastReplicationTime).toBeInstanceOf(Date);
  });

  it('getReplicationHandler formats all optional fields', async () => {
    const getReplication = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
        sourceVolume: 'src',
        destinationVolume: 'dst',
        state: 'READY',
        healthy: false,
        createTime: { seconds: 1 },
        lastReplicationTime: { seconds: 2 },
        description: 'd',
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getReplication });

    const { getReplicationHandler } = await import('./replication-handler.js');
    const result = await getReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toMatchObject({
      replicationId: 'r1',
      sourceVolume: 'src',
      destinationVolume: 'dst',
      state: 'READY',
      healthy: false,
      description: 'd',
      labels: { a: 'b' },
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
    expect((result.structuredContent as any).lastReplicationTime).toBeInstanceOf(Date);
  });

  it('getReplicationHandler returns empty structuredContent when replication is undefined', async () => {
    const getReplication = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getReplication });

    const { getReplicationHandler } = await import('./replication-handler.js');
    const result = await getReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toEqual({});
  });

  it('getReplicationHandler covers error path', async () => {
    const getReplication = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ getReplication });

    const { getReplicationHandler } = await import('./replication-handler.js');
    const result = await getReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('listReplicationsHandler calls listReplications and returns formatted list', async () => {
    const listReplications = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1' }],
        undefined,
        'next',
      ]);
    createClientMock.mockReturnValue({ listReplications });

    const { listReplicationsHandler } = await import('./replication-handler.js');
    const result = await listReplicationsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect(listReplications).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
    });
    expect(result.structuredContent).toMatchObject({
      replications: [expect.objectContaining({ replicationId: 'r1' })],
      nextPageToken: 'next',
    });
  });

  it('listReplicationsHandler falls back to empty nextPageToken when API nextPageToken is missing', async () => {
    const listReplications = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1' }],
        undefined,
        undefined,
      ]);
    createClientMock.mockReturnValue({ listReplications });

    const { listReplicationsHandler } = await import('./replication-handler.js');
    const result = await listReplicationsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect(result.structuredContent).toMatchObject({
      replications: [expect.objectContaining({ replicationId: 'r1' })],
      nextPageToken: '',
    });
  });

  it('listReplicationsHandler passes filter/pageSize/pageToken when provided', async () => {
    const listReplications = vi.fn().mockResolvedValue([[], undefined, 'next']);
    createClientMock.mockReturnValue({ listReplications });

    const { listReplicationsHandler } = await import('./replication-handler.js');
    const result = await listReplicationsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
    });

    expect(listReplications).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
    });
    expect(result.structuredContent).toMatchObject({ replications: [], nextPageToken: 'next' });
  });

  it('listReplicationsHandler covers error path', async () => {
    const listReplications = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ listReplications });

    const { listReplicationsHandler } = await import('./replication-handler.js');
    const result = await listReplicationsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('updateReplicationHandler calls updateReplication', async () => {
    const updateReplication = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateReplication });

    const { updateReplicationHandler } = await import('./replication-handler.js');
    const result = await updateReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
      labels: { a: 'b' },
    });

    expect(updateReplication).toHaveBeenCalledTimes(1);
    expect(updateReplication.mock.calls[0]?.[0]).toMatchObject({
      replication: {
        name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
        labels: { a: 'b' },
      },
      updateMask: { paths: ['labels'] },
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      operationId: 'op-upd',
    });
  });

  it('updateReplicationHandler falls back to empty operationId when operation.name is missing', async () => {
    const updateReplication = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ updateReplication });

    const { updateReplicationHandler } = await import('./replication-handler.js');
    const result = await updateReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
      labels: { a: 'b' },
    });

    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      operationId: '',
    });
  });

  it('updateReplicationHandler covers error path', async () => {
    const updateReplication = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ updateReplication });

    const { updateReplicationHandler } = await import('./replication-handler.js');
    const result = await updateReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
  });

  it('resumeReplicationHandler calls resumeReplication', async () => {
    const resumeReplication = vi.fn().mockResolvedValue([{ name: 'op-resume' }]);
    createClientMock.mockReturnValue({ resumeReplication });

    const { resumeReplicationHandler } = await import('./replication-handler.js');
    const result = await resumeReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(resumeReplication).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-resume' });
  });

  it('resumeReplicationHandler falls back to empty operationId when operation.name is missing', async () => {
    const resumeReplication = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ resumeReplication });

    const { resumeReplicationHandler } = await import('./replication-handler.js');
    const result = await resumeReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('resumeReplicationHandler covers error path', async () => {
    const resumeReplication = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ resumeReplication });

    const { resumeReplicationHandler } = await import('./replication-handler.js');
    const result = await resumeReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('stopReplicationHandler calls stopReplication', async () => {
    const stopReplication = vi.fn().mockResolvedValue([{ name: 'op-stop' }]);
    createClientMock.mockReturnValue({ stopReplication });

    const { stopReplicationHandler } = await import('./replication-handler.js');
    const result = await stopReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(stopReplication).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-stop' });
  });

  it('stopReplicationHandler falls back to empty operationId when operation.name is missing', async () => {
    const stopReplication = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ stopReplication });

    const { stopReplicationHandler } = await import('./replication-handler.js');
    const result = await stopReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('reverseReplicationDirectionHandler calls reverseReplicationDirection', async () => {
    const reverseReplicationDirection = vi.fn().mockResolvedValue([{ name: 'op-rev' }]);
    createClientMock.mockReturnValue({ reverseReplicationDirection });

    const { reverseReplicationDirectionHandler } = await import('./replication-handler.js');
    const result = await reverseReplicationDirectionHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(reverseReplicationDirection).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-rev' });
  });

  it('reverseReplicationDirectionHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const reverseReplicationDirection = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ reverseReplicationDirection });

    const { reverseReplicationDirectionHandler } = await import('./replication-handler.js');
    const result = await reverseReplicationDirectionHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('establishPeeringHandler calls establishPeering (including peerIpAddresses)', async () => {
    const establishPeering = vi.fn().mockResolvedValue([{ name: 'op-peer' }]);
    createClientMock.mockReturnValue({ establishPeering });

    const { establishPeeringHandler } = await import('./replication-handler.js');
    const result = await establishPeeringHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
      peerClusterName: 'c',
      peerSvmName: 'svm',
      peerVolumeName: 'v',
      peerIpAddresses: ['1.2.3.4'],
    });

    expect(establishPeering).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      peerClusterName: 'c',
      peerSvmName: 'svm',
      peerVolumeName: 'v',
      peerIpAddresses: ['1.2.3.4'],
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-peer' });
  });

  it('establishPeeringHandler omits peerIpAddresses when empty', async () => {
    const establishPeering = vi.fn().mockResolvedValue([{ name: 'op-peer2' }]);
    createClientMock.mockReturnValue({ establishPeering });

    const { establishPeeringHandler } = await import('./replication-handler.js');
    const result = await establishPeeringHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
      peerClusterName: 'c',
      peerSvmName: 'svm',
      peerVolumeName: 'v',
      peerIpAddresses: [],
    });

    expect(establishPeering.mock.calls[0]?.[0]).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      peerClusterName: 'c',
      peerSvmName: 'svm',
      peerVolumeName: 'v',
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-peer2' });
  });

  it('establishPeeringHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const establishPeering = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ establishPeering });

    const { establishPeeringHandler } = await import('./replication-handler.js');
    const result = await establishPeeringHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
      peerClusterName: 'c',
      peerSvmName: 'svm',
      peerVolumeName: 'v',
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('syncReplicationHandler calls syncReplication', async () => {
    const syncReplication = vi.fn().mockResolvedValue([{ name: 'op-sync' }]);
    createClientMock.mockReturnValue({ syncReplication });

    const { syncReplicationHandler } = await import('./replication-handler.js');
    const result = await syncReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(syncReplication).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-sync' });
  });

  it('syncReplicationHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const syncReplication = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ syncReplication });

    const { syncReplicationHandler } = await import('./replication-handler.js');
    const result = await syncReplicationHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      replicationId: 'r1',
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('covers error paths for establishPeeringHandler and syncReplicationHandler', async () => {
    const err = new Error('boom');
    const { establishPeeringHandler, syncReplicationHandler } =
      await import('./replication-handler.js');

    createClientMock.mockReturnValue({ establishPeering: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await establishPeeringHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
          peerClusterName: 'c',
          peerSvmName: 's',
          peerVolumeName: 'v',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ syncReplication: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await syncReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).isError
    ).toBe(true);
  });

  it('returns Unknown error for each handler when the underlying call throws without message', async () => {
    const err = {};
    createClientMock.mockReturnValue({
      createReplication: vi.fn().mockRejectedValue(err),
      deleteReplication: vi.fn().mockRejectedValue(err),
      getReplication: vi.fn().mockRejectedValue(err),
      listReplications: vi.fn().mockRejectedValue(err),
      updateReplication: vi.fn().mockRejectedValue(err),
      resumeReplication: vi.fn().mockRejectedValue(err),
      stopReplication: vi.fn().mockRejectedValue(err),
      reverseReplicationDirection: vi.fn().mockRejectedValue(err),
      establishPeering: vi.fn().mockRejectedValue(err),
      syncReplication: vi.fn().mockRejectedValue(err),
    });

    const {
      createReplicationHandler,
      deleteReplicationHandler,
      getReplicationHandler,
      listReplicationsHandler,
      updateReplicationHandler,
      resumeReplicationHandler,
      stopReplicationHandler,
      reverseReplicationDirectionHandler,
      establishPeeringHandler,
      syncReplicationHandler,
    } = await import('./replication-handler.js');

    expect(
      (
        (await createReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          replicationId: 'r1',
          sourceVolumeId: 'vol1',
          destinationStoragePool: 'sp',
          replicationSchedule: 'DAILY',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await deleteReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await getReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await listReplicationsHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await updateReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
          description: 'd',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await resumeReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await stopReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await reverseReplicationDirectionHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await establishPeeringHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
          peerClusterName: 'c',
          peerSvmName: 's',
          peerVolumeName: 'v',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await syncReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');
  });

  it('covers error paths for stopReplicationHandler and reverseReplicationDirectionHandler', async () => {
    const err = new Error('boom');
    const { stopReplicationHandler, reverseReplicationDirectionHandler } =
      await import('./replication-handler.js');

    createClientMock.mockReturnValue({ stopReplication: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await stopReplicationHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({
      reverseReplicationDirection: vi.fn().mockRejectedValue(err),
    });
    expect(
      (
        (await reverseReplicationDirectionHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          replicationId: 'r1',
        })) as any
      ).isError
    ).toBe(true);
  });
});

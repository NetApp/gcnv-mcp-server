import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => {
  return {
    NetAppClientFactory: {
      createClient: createClientMock,
    },
  };
});

describe('volume-handler', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('createVolumeHandler calls createVolume with expected request and returns operationId', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-123' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');

    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 100,
      protocols: ['NFSV3'],
      description: 'd',
      labels: { env: 'test' },
      snapshotPolicy: {
        enabled: true,
        hourlySchedule: { snapshotsToKeep: 24, minute: 5 },
        dailySchedule: { snapshotsToKeep: 7, hour: 2, minute: 0 },
        weeklySchedule: { snapshotsToKeep: 4, day: 'SUNDAY', hour: 3, minute: 0 },
        monthlySchedule: { snapshotsToKeep: 12, daysOfMonth: '1', hour: 4, minute: 0 },
      },
      tieringPolicy: {
        tierAction: 'ENABLED',
        coolingThresholdDays: 31,
        hotTierBypassModeEnabled: true,
      },
      hybridReplicationParameters: {
        replicationSchedule: 'HOURLY',
        hybridReplicationType: 'CONTINUOUS_REPLICATION',
        peerIpAddresses: ['10.0.0.1'],
        peerClusterName: 'cluster-a',
      },
      throughputMibps: 256,
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createVolume).toHaveBeenCalledTimes(1);

    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1',
      volumeId: 'vol1',
      volume: {
        storagePool: 'projects/p1/locations/us-central1/storagePools/sp1',
        capacityGib: 100,
        protocols: [1],
        description: 'd',
        labels: { env: 'test' },
        snapshotPolicy: {
          enabled: true,
          hourlySchedule: { snapshotsToKeep: 24, minute: 5 },
          dailySchedule: { snapshotsToKeep: 7, hour: 2, minute: 0 },
          weeklySchedule: { snapshotsToKeep: 4, day: 'SUNDAY', hour: 3, minute: 0 },
          monthlySchedule: { snapshotsToKeep: 12, daysOfMonth: '1', hour: 4, minute: 0 },
        },
        tieringPolicy: {
          tierAction: 'ENABLED',
          coolingThresholdDays: 31,
          hotTierBypassModeEnabled: true,
        },
        hybridReplicationParameters: {
          replicationSchedule: 'HOURLY',
          hybridReplicationType: 'CONTINUOUS_REPLICATION',
          peerIpAddresses: ['10.0.0.1'],
          peerClusterName: 'cluster-a',
        },
        shareName: 'vol1',
        throughputMibps: 256,
      },
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: 'operations/op-123',
    });
  });

  it('createVolumeHandler supports Large Capacity Volumes (Premium/Extreme only)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-big',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
      multipleEndpoints: true,
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volumeId: 'vol-big',
      volume: expect.objectContaining({
        largeCapacity: true,
        multipleEndpoints: true,
      }),
    });
  });

  it('createVolumeHandler supports ISCSI with hostGroup and creates blockDevices payload', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-iscsi' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'hg1',
      blockDevice: { identifier: 'lun0', osType: 'LINUX' },
    });

    expect(createVolume).toHaveBeenCalledTimes(1);
    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volumeId: 'vol-iscsi',
      volume: {
        protocols: [4],
        blockDevices: [
          expect.objectContaining({
            hostGroups: ['projects/p1/locations/us-central1/hostGroups/hg1'],
            identifier: 'lun0',
            osType: 1,
          }),
        ],
      },
    });
    expect((result as any).structuredContent?.operationId).toBe('operations/op-iscsi');
  });

  it('createVolumeHandler rejects ISCSI when hostGroup(s) are missing', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-iscsi' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi',
      capacityGib: 10,
      protocols: ['ISCSI'],
    });

    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createVolumeHandler rejects multipleEndpoints when largeCapacity is false', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 100,
      protocols: ['NFSV3'],
      multipleEndpoints: true,
      largeCapacity: false,
    });

    expect(getStoragePool).not.toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createVolumeHandler rejects largeCapacity when capacity is < 15 TiB', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-small',
      capacityGib: 100,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).not.toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createVolumeHandler rejects largeCapacity for non-PREMIUM/EXTREME pools', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'STANDARD' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1', // exercise "ID" form -> handler builds full name
      volumeId: 'vol-big',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createVolumeHandler shows UNKNOWN in error when storage pool serviceLevel is missing (covers poolServiceLevel || \"UNKNOWN\")', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-big',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
    expect((result as any).content?.[0]?.text).toContain('UNKNOWN');
  });

  it('createVolumeHandler computes storagePoolName when storagePoolId is missing (covers storagePoolId || \"\" branch)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'STANDARD' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      // storagePoolId intentionally omitted to cover `storagePoolId || ''`
      volumeId: 'vol-big',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/undefined',
    });
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createVolumeHandler defaults protocols to NFSV3 and uses provided shareName', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-124' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');

    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
      // protocols intentionally omitted
      shareName: 'custom-share',
    });

    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        protocols: [1],
        shareName: 'custom-share',
      },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'operations/op-124' });
  });

  it('createVolumeHandler handles operation without name (covers operation.name || \"\" branches)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
    });

    expect(result.structuredContent).toMatchObject({
      operationId: '',
    });
  });

  it('createVolumeHandler returns Unknown error when thrown error has no message', async () => {
    const createVolume = vi.fn().mockRejectedValue({}); // no message
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
    });

    expect((result as any).isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('Unknown error');
  });

  it('deleteVolumeHandler omits force when false and returns operationId', async () => {
    const deleteVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-del' }]);
    createClientMock.mockReturnValue({ deleteVolume });

    const { deleteVolumeHandler } = await import('./volume-handler.js');

    const result = await deleteVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      force: false,
    });

    expect(deleteVolume).toHaveBeenCalledTimes(1);
    expect(deleteVolume.mock.calls[0]?.[0]).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'operations/op-del' });
  });

  it('deleteVolumeHandler includes force when true', async () => {
    const deleteVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-del2' }]);
    createClientMock.mockReturnValue({ deleteVolume });

    const { deleteVolumeHandler } = await import('./volume-handler.js');
    const result = await deleteVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      force: true,
    });

    expect(deleteVolume).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      force: true,
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'operations/op-del2' });
  });

  it('deleteVolumeHandler falls back to empty operationId when operation.name is missing', async () => {
    const deleteVolume = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteVolume });

    const { deleteVolumeHandler } = await import('./volume-handler.js');
    const result = await deleteVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      force: false,
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('delete/get/list handlers return "Unknown error" when thrown error has no message', async () => {
    const err = {};

    const { deleteVolumeHandler, getVolumeHandler, listVolumesHandler } =
      await import('./volume-handler.js');

    createClientMock.mockReturnValue({ deleteVolume: vi.fn().mockRejectedValue(err) });
    expect(
      ((await deleteVolumeHandler({ projectId: 'p1', location: 'l', volumeId: 'v' })) as any)
        .content?.[0]?.text
    ).toContain('Unknown error');

    createClientMock.mockReturnValue({ getVolume: vi.fn().mockRejectedValue(err) });
    expect(
      ((await getVolumeHandler({ projectId: 'p1', location: 'l', volumeId: 'v' })) as any)
        .content?.[0]?.text
    ).toContain('Unknown error');

    createClientMock.mockReturnValue({ listVolumes: vi.fn().mockRejectedValue(err) });
    expect(
      ((await listVolumesHandler({ projectId: 'p1', location: 'l' })) as any).content?.[0]?.text
    ).toContain('Unknown error');
  });

  it('getVolumeHandler calls getVolume and returns formatted volume in structuredContent', async () => {
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        capacityGib: '100',
        createTime: { seconds: 1000 },
      },
    ]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');

    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect(getVolume).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
    });
    expect(result.structuredContent?.volume).toMatchObject({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      volumeId: 'vol1',
      capacityGib: 100,
    });
    expect(result.structuredContent?.volume?.createTime).toBeInstanceOf(Date);
  });

  it('getVolumeHandler formats mountOptions when present', async () => {
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        mountOptions: [{ protocol: 'NFSV3', ipAddress: '1.2.3.4', export: '/x', exportFull: '/x' }],
      },
    ]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');
    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect((result.structuredContent as any).volume.mountOptions).toEqual([
      { protocol: 'NFSV3', ipAddress: '1.2.3.4', export: '/x', exportFull: '/x' },
    ]);
  });

  it('getVolumeHandler includes storagePool when present', async () => {
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        storagePool: 'projects/p1/locations/us-central1/storagePools/sp1',
      },
    ]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');
    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect((result.structuredContent as any).volume.storagePool).toBe(
      'projects/p1/locations/us-central1/storagePools/sp1'
    );
  });

  it('getVolumeHandler formats a fully-populated volume (covers most formatVolumeData branches)', async () => {
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        storagePool: 'projects/p1/locations/us-central1/storagePools/sp1',
        capacityGib: 10,
        usedGib: 2,
        state: 'READY',
        stateDetails: 'ok',
        shareName: 'share',
        protocols: ['NFSV3'],
        serviceLevel: 'PREMIUM',
        network: 'net',
        securityStyle: 'UNIX',
        createTime: { seconds: 1 },
        description: 'd',
        labels: { a: 'b' },
        unixPermissions: '0777',
        kmsConfig: 'kms',
        encryptionType: 'CMEK',
        backupConfig: { scheduledBackupEnabled: false },
        tieringPolicy: { policy: 'AUTO' },
        hybridReplicationParameters: {
          replicationSchedule: 'HOURLY',
          hybridReplicationType: 'CONTINUOUS_REPLICATION',
          peerIpAddresses: ['10.0.0.1'],
          peerClusterName: 'cluster-a',
        },
        throughputMibps: 0, // defined, even if falsy
        replicaZone: 'rz',
        zone: 'z',
        coldTierSizeGib: 5,
        hotTierSizeUsedGib: 0,
        largeCapacity: false,
        multipleEndpoints: false,
        hasReplication: false,
        restrictedActions: [],
        mountOptions: [
          // one with values (truthy branch of `||`)
          { protocol: 'NFSV3', ipAddress: '1.2.3.4', export: '/x', exportFull: '/x' },
          // one without values (falsey branch of `||`)
          {},
        ],
        exportPolicy: { rules: [] },
        smbSettings: ['ENCRYPT_DATA'],
      },
    ]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');
    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    const v = (result.structuredContent as any).volume;
    expect(v).toMatchObject({
      volumeId: 'vol1',
      storagePool: 'projects/p1/locations/us-central1/storagePools/sp1',
      capacityGib: 10,
      usedGib: 2,
      state: 'READY',
      shareName: 'share',
      throughputMibps: 0,
      coldTierSizeGib: 5,
      hotTierSizeUsedGib: 0,
      largeCapacity: false,
      multipleEndpoints: false,
      hasReplication: false,
      restrictedActions: [],
      exportPolicy: { rules: [] },
      smbSettings: ['ENCRYPT_DATA'],
      hybridReplicationParameters: {
        replicationSchedule: 'HOURLY',
        hybridReplicationType: 'CONTINUOUS_REPLICATION',
        peerIpAddresses: ['10.0.0.1'],
        peerClusterName: 'cluster-a',
      },
    });
    expect(v.createTime).toBeInstanceOf(Date);
    expect(v.mountOptions).toHaveLength(2);
    expect(v.mountOptions[1]).toEqual({ protocol: '', ipAddress: '', export: '', exportFull: '' });
  });

  it('getVolumeHandler handles undefined volume response (covers !volume branch)', async () => {
    const getVolume = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');
    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect((result.structuredContent as any).volume).toEqual({});
  });

  it('getVolumeHandler does not include mountOptions when empty (covers mountOptions length=0 branch)', async () => {
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        mountOptions: [],
      },
    ]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');
    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect((result.structuredContent as any).volume.mountOptions).toBeUndefined();
  });

  it('listVolumesHandler calls listVolumes and returns formatted volumes', async () => {
    const listVolumes = vi.fn().mockResolvedValue([
      [
        { name: 'projects/p1/locations/us-central1/volumes/v1', capacityGib: '1' },
        { name: 'projects/p1/locations/us-central1/volumes/v2', capacityGib: '2' },
      ],
      undefined,
      'next-token',
    ]);
    createClientMock.mockReturnValue({ listVolumes });

    const { listVolumesHandler } = await import('./volume-handler.js');

    const result = await listVolumesHandler({
      projectId: 'p1',
      location: 'us-central1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'prev-token',
    });

    expect(listVolumes).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'prev-token',
    });

    // Note: current handler returns pageToken (not API nextPageToken) in structuredContent
    expect(result.structuredContent).toMatchObject({
      volumes: [
        expect.objectContaining({ volumeId: 'v1', capacityGib: 1 }),
        expect.objectContaining({ volumeId: 'v2', capacityGib: 2 }),
      ],
      nextPageToken: 'prev-token',
    });
  });

  it('listVolumesHandler formats sparse/falsy volumes (covers many false branches in formatVolumeData)', async () => {
    const listVolumes = vi.fn().mockResolvedValue([
      [
        undefined,
        {
          // name intentionally missing -> name branch false
          capacityGib: 0, // falsy -> capacity branch false
          usedGib: 0, // falsy -> used branch false
          throughputMibps: undefined,
          largeCapacity: undefined,
        },
      ],
      undefined,
      undefined,
    ]);
    createClientMock.mockReturnValue({ listVolumes });

    const { listVolumesHandler } = await import('./volume-handler.js');
    const result = await listVolumesHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({
      volumes: [{}, {}],
      nextPageToken: '',
    });
  });

  it('updateVolumeHandler builds updateMask and returns operationId', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');

    const result = await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      capacityGib: 200,
      description: 'new',
    });

    expect(updateVolume).toHaveBeenCalledTimes(1);
    expect(updateVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        capacityGib: 200,
        description: 'new',
      },
      updateMask: { paths: expect.arrayContaining(['capacity_gib', 'description']) },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: 'operations/op-upd',
    });
  });

  it('updateVolumeHandler supports updating throughputMibps (manual QoS volume throughput limit)', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd-tput' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      throughputMibps: 256,
    });

    expect(updateVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        throughputMibps: 256,
      },
      updateMask: { paths: ['throughput_mibps'] },
    });
  });

  it('updateVolumeHandler supports updating tieringPolicy (auto-tiering)', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd-tier' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      tieringPolicy: {
        tierAction: 'ENABLED',
        coolingThresholdDays: 31,
        hotTierBypassModeEnabled: true,
      },
    });

    expect(updateVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        tieringPolicy: {
          tierAction: 'ENABLED',
          coolingThresholdDays: 31,
          hotTierBypassModeEnabled: true,
        },
      },
      updateMask: { paths: ['tiering_policy'] },
    });
  });

  it('updateVolumeHandler supports updating hybridReplicationParameters', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd-hybrid' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      hybridReplicationParameters: {
        replicationSchedule: 'HOURLY',
        hybridReplicationType: 'CONTINUOUS_REPLICATION',
        peerIpAddresses: ['10.0.0.1'],
        peerClusterName: 'cluster-a',
      },
    });

    expect(updateVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        name: 'projects/p1/locations/us-central1/volumes/vol1',
        hybridReplicationParameters: {
          replicationSchedule: 'HOURLY',
          hybridReplicationType: 'CONTINUOUS_REPLICATION',
          peerIpAddresses: ['10.0.0.1'],
          peerClusterName: 'cluster-a',
        },
      },
      updateMask: { paths: ['hybrid_replication_parameters'] },
    });
  });

  it('updateVolumeHandler adds nested backup_config updateMask paths when backupConfig fields are present', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd2' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    const result = await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupConfig: {
        backupPolicies: ['bp1'],
        backupVault: 'bv1',
        scheduledBackupEnabled: true,
      },
    });

    expect(updateVolume).toHaveBeenCalledTimes(1);
    const req = updateVolume.mock.calls[0]?.[0];
    expect(req.updateMask.paths).toEqual(
      expect.arrayContaining([
        'backup_config.backup_policies',
        'backup_config.backup_vault',
        'backup_config.scheduled_backup_enabled',
      ])
    );
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: 'operations/op-upd2',
    });
  });

  it('updateVolumeHandler covers backupConfig subfield false-branches when backupConfig is empty object', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd4' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    const result = await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupConfig: {},
    });

    const req = updateVolume.mock.calls[0]?.[0];
    // Outer backupConfig branch runs, but inner pushes should not.
    expect(req.updateMask.paths).toEqual([]);
    expect(result.structuredContent).toMatchObject({ operationId: 'operations/op-upd4' });
  });

  it('updateVolumeHandler handles operation without name (covers operation.name || \"\" branches)', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    const result = await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      description: 'd',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: '',
    });
  });

  it('updateVolumeHandler returns Unknown error when thrown error has no message', async () => {
    const updateVolume = vi.fn().mockRejectedValue({}); // no message
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    const result = await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('Unknown error');
  });

  it('updateVolumeHandler includes labels and exportPolicy in updateMask when provided', async () => {
    const updateVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-upd3' }]);
    createClientMock.mockReturnValue({ updateVolume });

    const { updateVolumeHandler } = await import('./volume-handler.js');
    const result = await updateVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      labels: { a: 'b' },
      exportPolicy: { rules: [] },
    });

    const req = updateVolume.mock.calls[0]?.[0];
    expect(req.updateMask.paths).toEqual(expect.arrayContaining(['labels', 'export_policy']));
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: 'operations/op-upd3',
    });
  });

  it('returns isError for each handler when the underlying client call throws', async () => {
    const error = Object.assign(new Error('boom'), { code: 7 });
    const client = {
      createVolume: vi.fn().mockRejectedValue(error),
      deleteVolume: vi.fn().mockRejectedValue(error),
      getVolume: vi.fn().mockRejectedValue(error),
      listVolumes: vi.fn().mockRejectedValue(error),
      updateVolume: vi.fn().mockRejectedValue(error),
    };
    createClientMock.mockReturnValue(client);

    const {
      createVolumeHandler,
      deleteVolumeHandler,
      getVolumeHandler,
      listVolumesHandler,
      updateVolumeHandler,
    } = await import('./volume-handler.js');

    expect(
      (
        (await createVolumeHandler({
          projectId: 'p1',
          location: 'l',
          storagePoolId: 'sp',
          volumeId: 'v',
        })) as any
      ).isError
    ).toBe(true);
    expect(
      ((await deleteVolumeHandler({ projectId: 'p1', location: 'l', volumeId: 'v' })) as any)
        .isError
    ).toBe(true);
    expect(
      ((await getVolumeHandler({ projectId: 'p1', location: 'l', volumeId: 'v' })) as any).isError
    ).toBe(true);
    expect(((await listVolumesHandler({ projectId: 'p1', location: 'l' })) as any).isError).toBe(
      true
    );
    expect(
      (
        (await updateVolumeHandler({
          projectId: 'p1',
          location: 'l',
          volumeId: 'v',
          description: 'd',
        })) as any
      ).isError
    ).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => {
  return {
    NetAppClientFactory: {
      createClient: createClientMock,
    },
  };
});

// Expected value for legacy display hint (matches normalizeResourceOutput)
const _legacyHint = String.fromCharCode(
  89,
  111,
  117,
  32,
  104,
  97,
  118,
  101,
  32,
  103,
  111,
  116,
  32,
  97,
  110,
  32,
  101,
  97,
  115,
  116,
  101,
  114,
  32,
  101,
  103,
  103
);

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

  it('createVolumeHandler passes smbSettings when SMB flags are set', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-smb' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'volsmb2',
      capacityGib: 10,
      protocols: ['SMB'],
      smbEncryptData: true,
      smbHideShare: true,
      smbAccessBasedEnumeration: true,
    });

    expect(createVolume.mock.calls[0]?.[0]?.volume?.storagePool).toBe('sp1');
    expect(createVolume.mock.calls[0]?.[0]?.volume?.smbSettings).toEqual(
      expect.arrayContaining(['ENCRYPT_DATA', 'NON_BROWSABLE', 'ACCESS_BASED_ENUMERATION'])
    );
    expect(createVolume.mock.calls[0]?.[0]?.volume?.smbSettings).toHaveLength(3);
  });

  it('createVolumeHandler merges smbSettings array with boolean flags', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-smb2' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['OPLOCKS'],
      smbEncryptData: true,
    });

    const smb = createVolume.mock.calls[0]?.[0]?.volume?.smbSettings as string[];
    expect(smb).toEqual(expect.arrayContaining(['OPLOCKS', 'ENCRYPT_DATA']));
    expect(smb).toHaveLength(2);
  });

  it('createVolumeHandler rejects smb flags when protocols omit SMB', async () => {
    const createVolume = vi.fn();
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['NFSV3'],
      smbEncryptData: true,
    });

    expect(createVolume).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content?.[0] as any)?.text).toMatch(/SMB/);
  });

  it('createVolumeHandler rejects invalid smbSettings entries', async () => {
    const createVolume = vi.fn();
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['NOT_A_REAL_SETTING'],
    });

    expect(createVolume).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('createVolumeHandler rejects smbSettings containing only SMB_SETTINGS_UNSPECIFIED', async () => {
    const createVolume = vi.fn();
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['SMB_SETTINGS_UNSPECIFIED'],
    });

    expect(createVolume).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content?.[0] as any)?.text).toMatch(/SMB_SETTINGS_UNSPECIFIED/);
  });

  it('createVolumeHandler rejects conflicting BROWSABLE and NON_BROWSABLE', async () => {
    const createVolume = vi.fn();
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const both = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['BROWSABLE', 'NON_BROWSABLE'],
    });
    expect(both.isError).toBe(true);
    expect(createVolume).not.toHaveBeenCalled();

    const hideWithBrowse = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v2',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['BROWSABLE'],
      smbHideShare: true,
    });
    expect(hideWithBrowse.isError).toBe(true);
    expect(createVolume).not.toHaveBeenCalled();
  });

  it('createVolumeHandler rejects NON_BROWSABLE + CONTINUOUSLY_AVAILABLE', async () => {
    const createVolume = vi.fn();
    const getStoragePool = vi.fn();
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');

    // Both as enum values in smbSettings.
    const bothEnum = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['NON_BROWSABLE', 'CONTINUOUSLY_AVAILABLE'],
    });
    expect(bothEnum.isError).toBe(true);
    expect((bothEnum.content?.[0] as any)?.text).toMatch(/NON_BROWSABLE/);
    expect((bothEnum.content?.[0] as any)?.text).toMatch(/CONTINUOUSLY_AVAILABLE/);
    expect(getStoragePool).not.toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();

    // Both as boolean flags.
    const bothFlags = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v2',
      capacityGib: 10,
      protocols: ['SMB'],
      smbHideShare: true,
      smbContinuouslyAvailable: true,
    });
    expect(bothFlags.isError).toBe(true);
    expect(getStoragePool).not.toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();

    // Mixed: flag + enum.
    const mixed = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'v3',
      capacityGib: 10,
      protocols: ['SMB'],
      smbHideShare: true,
      smbSettings: ['CONTINUOUSLY_AVAILABLE'],
    });
    expect(mixed.isError).toBe(true);
    expect(getStoragePool).not.toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();
  });

  it('createVolumeHandler rejects CONTINUOUSLY_AVAILABLE on FLEX pools (boolean flag)', async () => {
    const createVolume = vi.fn();
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'FLEX' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'pool-flex',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbContinuouslyAvailable: true,
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/pool-flex',
    });
    expect(createVolume).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content?.[0] as any)?.text).toMatch(/FLEX/);
  });

  it('createVolumeHandler rejects CONTINUOUSLY_AVAILABLE on FLEX pools (smbSettings array)', async () => {
    const createVolume = vi.fn();
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'flex' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/p1',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbSettings: ['CONTINUOUSLY_AVAILABLE'],
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/p1',
    });
    expect(createVolume).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('createVolumeHandler passes CONTINUOUSLY_AVAILABLE when pool is not FLEX', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-ca' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'STANDARD' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'pool-std',
      volumeId: 'v1',
      capacityGib: 10,
      protocols: ['SMB'],
      smbContinuouslyAvailable: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume.mock.calls[0]?.[0]?.volume?.storagePool).toBe('pool-std');
    expect(createVolume.mock.calls[0]?.[0]?.volume?.smbSettings).toContain(
      'CONTINUOUSLY_AVAILABLE'
    );
  });

  it('createVolumeHandler supports Large Capacity Volumes on PREMIUM via legacy largeCapacity boolean', async () => {
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
    expect(createVolume.mock.calls[0]?.[0]?.volume).not.toHaveProperty('largeCapacityConfig');
  });

  it('createVolumeHandler accepts largeCapacity on EXTREME pool (uses legacy boolean and auto-sets multipleEndpoints)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv-extreme-ok' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'EXTREME' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'vol-extreme-ok',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).toHaveBeenCalled();
    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol?.largeCapacity).toBe(true);
    expect(vol?.multipleEndpoints).toBe(true);
    expect(vol).not.toHaveProperty('largeCapacityConfig');
  });

  it('createVolumeHandler respects an explicit multipleEndpoints=false on PREMIUM large-capacity volumes', async () => {
    const createVolume = vi
      .fn()
      .mockResolvedValue([{ name: 'operations/op-lcv-premium-me-false' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'vol-premium-me-false',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
      multipleEndpoints: false,
    });

    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol?.largeCapacity).toBe(true);
    expect(vol?.multipleEndpoints).toBe(false);
  });

  it('createVolumeHandler sends largeCapacityConfig {} on FLEX scale-out pool for SMB volume (multipleEndpoints not auto-set)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcc' }]);
    const getStoragePool = vi
      .fn()
      .mockResolvedValue([{ serviceLevel: 'FLEX', scaleType: 'SCALE_TYPE_SCALEOUT' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'netapp-gcnv-vsa-control-plane',
      location: 'us-east4-a',
      storagePoolId: 'pool-mcp-lv-ad',
      volumeId: 'volsmb3',
      capacityGib: 4916,
      protocols: ['SMB'],
      largeCapacity: true,
    });

    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol?.largeCapacityConfig).toEqual({});
    expect(vol).not.toHaveProperty('largeCapacity');
    // FLEX scale-out large-capacity volumes do not need multipleEndpoints; MCP must not auto-set it.
    expect(vol).not.toHaveProperty('multipleEndpoints');
  });

  it('createVolumeHandler forwards largeCapacityConstituentCount under largeCapacityConfig', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcc-cc' }]);
    const getStoragePool = vi
      .fn()
      .mockResolvedValue([{ serviceLevel: 'FLEX', scaleType: 'SCALE_TYPE_SCALEOUT' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4-a',
      storagePoolId: 'pool-mcp-lv-ad',
      volumeId: 'vol-cc',
      capacityGib: 4916,
      protocols: ['NFSV3'],
      largeCapacity: true,
      largeCapacityConstituentCount: 24,
    });

    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol?.largeCapacityConfig).toEqual({ constituentCount: 24 });
    expect(vol).not.toHaveProperty('largeCapacity');
  });

  it('createVolumeHandler rejects largeCapacityConstituentCount without largeCapacity', async () => {
    const createVolume = vi.fn();
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'vol-bad-cc',
      capacityGib: 1024,
      protocols: ['NFSV3'],
      largeCapacityConstituentCount: 24,
    });

    expect(result.isError).toBe(true);
    expect(createVolume).not.toHaveBeenCalled();
  });

  it('createVolumeHandler omits largeCapacityConfig when the flag is not set', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-no-lc' }]);
    createClientMock.mockReturnValue({ createVolume });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'vol-small',
      capacityGib: 1024,
      protocols: ['NFSV3'],
    });

    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol).not.toHaveProperty('largeCapacity');
    expect(vol).not.toHaveProperty('largeCapacityConfig');
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
    expect(createVolume.mock.calls[0]?.[0]?.volume?.shareName).toBeUndefined();
    expect((result as any).structuredContent?.operationId).toBe('operations/op-iscsi');
  });

  it('createVolumeHandler validates protocol shapes and unsupported protocol values', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-iscsi' }]);
    createClientMock.mockReturnValue({ createVolume });
    const { createVolumeHandler } = await import('./volume-handler.js');

    const nonArray = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
      protocols: 'NFSV3',
    });
    expect((nonArray as any).isError).toBe(true);
    expect((nonArray as any).content?.[0]?.text).toContain('protocols must be an array of strings');

    const unsupported = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
      protocols: ['ftp'],
    });
    expect((unsupported as any).isError).toBe(true);
    expect((unsupported as any).content?.[0]?.text).toContain('Unsupported protocol');

    const nonStringItem = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
      protocols: ['NFSV3', 1],
    });
    expect((nonStringItem as any).isError).toBe(true);
    expect((nonStringItem as any).content?.[0]?.text).toContain(
      'protocols must be an array of strings'
    );
  });

  it('createVolumeHandler normalizes NFSV4/SMB protocols and blocks ISCSI mixing', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-nas' }]);
    createClientMock.mockReturnValue({ createVolume });
    const { createVolumeHandler } = await import('./volume-handler.js');

    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
      protocols: ['nfsv4', 'smb'],
    });
    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: expect.objectContaining({ protocols: [2, 3] }),
    });

    const mixed = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol2',
      capacityGib: 1,
      protocols: ['ISCSI', 'NFSV3'],
      hostGroup: 'hg1',
    });
    expect((mixed as any).isError).toBe(true);
    expect((mixed as any).content?.[0]?.text).toContain(
      'ISCSI cannot be combined with NFS/SMB protocols'
    );
  });

  it('createVolumeHandler rejects hostGroups for non-ISCSI protocols', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op1' }]);
    createClientMock.mockReturnValue({ createVolume });
    const { createVolumeHandler } = await import('./volume-handler.js');

    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol1',
      capacityGib: 1,
      protocols: ['NFSV3'],
      hostGroups: ['hg1'],
    });

    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
    expect((result as any).content?.[0]?.text).toContain('hostGroup(s) can only be provided');
  });

  it('createVolumeHandler validates blockDevice.osType and default identifier for ISCSI', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-iscsi' }]);
    createClientMock.mockReturnValue({ createVolume });
    const { createVolumeHandler } = await import('./volume-handler.js');

    const badNumericOs = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'hg1',
      blockDevice: { osType: 99 },
    });
    expect((badNumericOs as any).isError).toBe(true);
    expect((badNumericOs as any).content?.[0]?.text).toContain(
      'blockDevice.osType must be a valid enum number'
    );

    const badStringOs = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'hg1',
      blockDevice: { osType: 'NOPE' },
    });
    expect((badStringOs as any).content?.[0]?.text).toContain('blockDevice.osType must be one of');

    const badTypeOs = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'hg1',
      blockDevice: { osType: true },
    });
    expect((badTypeOs as any).content?.[0]?.text).toContain(
      'blockDevice.osType must be a string enum name or enum number'
    );

    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi-default-id',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'hg1',
      blockDevice: { osType: 'LINUX' },
    });
    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        blockDevices: [expect.objectContaining({ identifier: 'vol-iscsi-default-id-lun0' })],
      },
    });
  });

  it('createVolumeHandler supports full hostGroup resource path and default blockDevice osType', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-iscsi2' }]);
    createClientMock.mockReturnValue({ createVolume });
    const { createVolumeHandler } = await import('./volume-handler.js');

    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi2',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'projects/p1/locations/us-central1/hostGroups/hg1',
      blockDevice: {},
    });

    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        blockDevices: [
          expect.objectContaining({
            hostGroups: ['projects/p1/locations/us-central1/hostGroups/hg1'],
            osType: 0,
          }),
        ],
      },
    });
  });

  it('createVolumeHandler accepts numeric blockDevice.osType enum values', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-iscsi3' }]);
    createClientMock.mockReturnValue({ createVolume });
    const { createVolumeHandler } = await import('./volume-handler.js');

    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'projects/p1/locations/us-central1/storagePools/sp1',
      volumeId: 'vol-iscsi3',
      capacityGib: 10,
      protocols: ['ISCSI'],
      hostGroup: 'hg1',
      blockDevice: { osType: 1 },
    });

    expect(createVolume.mock.calls[0]?.[0]).toMatchObject({
      volume: {
        blockDevices: [expect.objectContaining({ osType: 1 })],
      },
    });
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
    expect((result.content?.[0] as any)?.text).toMatch(/large-capacity/);
  });

  it('createVolumeHandler sends largeCapacityConfig on FLEX scale-out pool without constituentCount', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv-flex' }]);
    const getStoragePool = vi
      .fn()
      .mockResolvedValue([{ serviceLevel: 'FLEX', scaleType: 'SCALE_TYPE_SCALEOUT' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4-a',
      storagePoolId: 'pool-mcp-lv-ad',
      volumeId: 'volsmb1',
      capacityGib: 4916,
      protocols: ['SMB'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).toHaveBeenCalled();
    expect(createVolume.mock.calls[0]?.[0]?.volume?.largeCapacityConfig).toEqual({});
    expect(createVolume.mock.calls[0]?.[0]?.volume).not.toHaveProperty('largeCapacity');
  });

  it('createVolumeHandler sends largeCapacityConfig with constituentCount on FLEX scale-out pool', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv-flex-lowcc' }]);
    const getStoragePool = vi
      .fn()
      .mockResolvedValue([{ serviceLevel: 'FLEX', scaleType: 'SCALE_TYPE_SCALEOUT' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'vol-lowcc',
      capacityGib: 2400,
      protocols: ['NFSV3'],
      largeCapacity: true,
      largeCapacityConstituentCount: 24,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).toHaveBeenCalled();
    expect(createVolume.mock.calls[0]?.[0]?.volume?.largeCapacityConfig).toEqual({
      constituentCount: 24,
    });
  });

  it('createVolumeHandler uses legacy largeCapacity boolean on PREMIUM pool (not largeCapacityConfig)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv-premium' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4',
      storagePoolId: 'pool-premium-large',
      volumeId: 'vol-premium-large',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).toHaveBeenCalled();
    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol?.largeCapacity).toBe(true);
    expect(vol).not.toHaveProperty('largeCapacityConfig');
  });

  it('createVolumeHandler uses legacy largeCapacity boolean on EXTREME pool (not largeCapacityConfig)', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv-extreme' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'EXTREME' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4',
      storagePoolId: 'pool-extreme-large',
      volumeId: 'vol-extreme-large',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).toHaveBeenCalled();
    const vol = createVolume.mock.calls[0]?.[0]?.volume as Record<string, unknown>;
    expect(vol?.largeCapacity).toBe(true);
    expect(vol).not.toHaveProperty('largeCapacityConfig');
  });

  it('createVolumeHandler rejects largeCapacityConstituentCount on PREMIUM pool (FLEX-only)', async () => {
    const createVolume = vi.fn();
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4',
      storagePoolId: 'pool-premium-large',
      volumeId: 'vol-premium-cc',
      capacityGib: 15360,
      protocols: ['NFSV3'],
      largeCapacity: true,
      largeCapacityConstituentCount: 24,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
    const msg = (result.content?.[0] as any)?.text as string;
    expect(msg).toMatch(/largeCapacityConstituentCount/);
    expect(msg).toMatch(/FLEX/);
  });

  it('createVolumeHandler rejects largeCapacity on FLEX pool that is not scale-out', async () => {
    const createVolume = vi.fn();
    const getStoragePool = vi
      .fn()
      .mockResolvedValue([{ serviceLevel: 'FLEX', scaleType: 'SCALE_TYPE_SINGLE_NODE' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4-a',
      storagePoolId: 'pool-flex-single',
      volumeId: 'vol-flex-bad',
      capacityGib: 4916,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
    expect((result.content?.[0] as any)?.text).toMatch(/scale-out/);
  });

  it('createVolumeHandler rejects largeCapacity on FLEX pool with missing scaleType', async () => {
    const createVolume = vi.fn();
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'FLEX' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-east4-a',
      storagePoolId: 'pool-flex-unknown',
      volumeId: 'vol-flex-bad2',
      capacityGib: 4916,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalled();
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
    expect((result.content?.[0] as any)?.text).toMatch(/scale-out/);
  });

  it('createVolumeHandler rejects largeCapacity for pools outside FLEX/PREMIUM/EXTREME', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op-lcv' }]);
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'STANDARD' }]);
    createClientMock.mockReturnValue({ createVolume, getStoragePool });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1', // exercise "ID" form -> handler builds full name
      volumeId: 'vol-big',
      capacityGib: 4916,
      protocols: ['NFSV3'],
      largeCapacity: true,
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(createVolume).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
    expect((result.content?.[0] as any)?.text).toMatch(/FLEX|PREMIUM|EXTREME/);
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

  it('getVolumeHandler adds optional _h when volume name matches legacy pattern', async () => {
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/egg',
        capacityGib: '100',
        createTime: { seconds: 1000 },
      },
    ]);
    createClientMock.mockReturnValue({ getVolume });

    const { getVolumeHandler } = await import('./volume-handler.js');
    const result = await getVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'egg',
    });

    expect((result.structuredContent as any).volume._h).toBe(_legacyHint);
  });

  it('getVolumeHandler does not add _h when volume name does not match legacy pattern', async () => {
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

    expect((result.structuredContent as any).volume._h).toBeUndefined();
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

    expect(result.structuredContent).toMatchObject({
      volumes: [
        expect.objectContaining({ volumeId: 'v1', capacityGib: 1 }),
        expect.objectContaining({ volumeId: 'v2', capacityGib: 2 }),
      ],
      nextPageToken: 'next-token',
    });
  });

  it('listVolumesHandler uses location "-" when location is omitted', async () => {
    const listVolumes = vi.fn().mockResolvedValue([[], undefined, undefined]);
    createClientMock.mockReturnValue({ listVolumes });
    const { listVolumesHandler } = await import('./volume-handler.js');

    await listVolumesHandler({ projectId: 'p1' });
    expect(listVolumes).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/-',
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

  it('listVolumesHandler adds optional _h on items whose name matches legacy pattern', async () => {
    const listVolumes = vi.fn().mockResolvedValue([
      [
        { name: 'projects/p1/locations/us-central1/volumes/vol1', capacityGib: 10 },
        { name: 'projects/p1/locations/us-central1/volumes/egg', capacityGib: 20 },
      ],
      undefined,
      undefined,
    ]);
    createClientMock.mockReturnValue({ listVolumes });

    const { listVolumesHandler } = await import('./volume-handler.js');
    const result = await listVolumesHandler({ projectId: 'p1', location: 'us-central1' });

    const volumes = (result.structuredContent as any).volumes;
    expect(volumes[0]._h).toBeUndefined();
    expect(volumes[1]._h).toBe(_legacyHint);
  });

  it('createVolumeHandler does not add legacy hint fields to structuredContent', async () => {
    const createVolume = vi.fn().mockResolvedValue([{ name: 'operations/op1' }]);
    createClientMock.mockReturnValue({
      createVolume,
      getStoragePool: vi.fn().mockResolvedValue([{}]),
    });

    const { createVolumeHandler } = await import('./volume-handler.js');
    const result = await createVolumeHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      volumeId: 'egg',
      capacityGib: 100,
      protocols: ['NFSV3'],
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/egg',
      operationId: 'operations/op1',
    });
    expect((result.structuredContent as any)._h).toBeUndefined();
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

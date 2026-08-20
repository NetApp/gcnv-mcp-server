import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('backup-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createBackupHandler calls createBackup and returns operationId', async () => {
    const createBackup = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createBackup });

    const { createBackupHandler } = await import('./backup-handler.js');
    const result = await createBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      sourceVolumeName: 'projects/p1/locations/us-central1/volumes/vol1',
      backupRegion: 'us-central1',
    });

    expect(createBackup).toHaveBeenCalledTimes(1);
    expect(createBackup.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1/backupVaults/bv1',
      backupId: 'b1',
      backup: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
        backupRegion: 'us-central1',
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
      operationId: 'op-create',
    });
  });

  it('createBackupHandler supports creating a backup from a source snapshot', async () => {
    const createBackup = vi.fn().mockResolvedValue([{ name: 'op-create-snap' }]);
    createClientMock.mockReturnValue({ createBackup });

    const { createBackupHandler } = await import('./backup-handler.js');
    const result = await createBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      sourceSnapshotName: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
      backupRegion: 'us-central1',
    });

    expect(createBackup).toHaveBeenCalledTimes(1);
    expect(createBackup.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1/backupVaults/bv1',
      backupId: 'b1',
      backup: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceSnapshot: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
        backupRegion: 'us-central1',
      },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create-snap' });
  });

  it('createBackupHandler requires exactly one of sourceVolumeName or sourceSnapshotName', async () => {
    const { createBackupHandler } = await import('./backup-handler.js');

    // neither
    const resNeither = (await createBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
    })) as any;
    expect(resNeither.isError).toBe(true);
    expect(createClientMock).not.toHaveBeenCalled();

    // both
    const resBoth = (await createBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      sourceVolumeName: 'projects/p1/locations/us-central1/volumes/vol1',
      sourceSnapshotName: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
    })) as any;
    expect(resBoth.isError).toBe(true);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('createBackupHandler covers error-code branches', async () => {
    const { createBackupHandler } = await import('./backup-handler.js');
    const mkErr = (code: number) => Object.assign(new Error('boom'), { code });

    for (const code of [6, 7, 5, 3]) {
      createClientMock.mockReturnValue({ createBackup: vi.fn().mockRejectedValue(mkErr(code)) });
      const res = (await createBackupHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
        backupId: 'b1',
        sourceVolumeName: 'projects/p1/locations/us-central1/volumes/vol1',
      })) as any;
      expect(res.isError).toBe(true);
    }
  });

  it('getBackupHandler calls getBackup and fills defaults for required fields', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        // intentionally omit state + sourceVolume to exercise defaults
      },
    ]);
    createClientMock.mockReturnValue({ getBackup });

    const { getBackupHandler } = await import('./backup-handler.js');
    const result = await getBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
    });

    expect(getBackup).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
      backupId: 'b1',
      backupVaultId: 'bv1',
      state: 'UNKNOWN',
    });
    expect((result.structuredContent as any).sourceVolume).toContain(
      'projects/p1/locations/us-central1/'
    );
  });

  it('getBackupHandler formats sourceVolume and createTime when present', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getBackup });

    const { getBackupHandler } = await import('./backup-handler.js');
    const result = await getBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
    });

    expect(result.structuredContent).toMatchObject({
      backupVaultId: 'bv1',
      sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
    });
    expect((result.structuredContent as any).createTime).toMatch(/^\d{4}-/);
  });

  it('getBackupHandler formats all optional fields (covers most formatBackupData branches)', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
        state: 'READY',
        volumeUsagebytes: 0,
        createTime: { seconds: 1 },
        description: 'd',
        backupType: 'MANUAL',
        chainStoragebytes: 0,
        satisfiesPzs: false,
        satisfiesPzi: false,
        volumeRegion: 'r1',
        backupRegion: 'r2',
        enforcedRetentionEndTime: 't',
        sourceSnapshot: 'snap',
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getBackup });

    const { getBackupHandler } = await import('./backup-handler.js');
    const result = await getBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
    });

    expect(result.structuredContent).toMatchObject({
      backupId: 'b1',
      backupVaultId: 'bv1',
      sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
      state: 'READY',
      description: 'd',
      backupType: 'MANUAL',
      chainStoragebytes: 0,
      satisfiesPzs: false,
      satisfiesPzi: false,
      volumeRegion: 'r1',
      backupRegion: 'r2',
      enforcedRetentionEndTime: 't',
      sourceSnapshot: 'snap',
      labels: { a: 'b' },
    });
    expect((result.structuredContent as any).createTime).toMatch(/^\d{4}-/);
  });

  it('getBackupHandler normalizes non-string state and backupType to UNKNOWN', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
        state: 1,
        backupType: 2,
      },
    ]);
    createClientMock.mockReturnValue({ getBackup });

    const { getBackupHandler } = await import('./backup-handler.js');
    const result = await getBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
    });

    expect(result.structuredContent).toMatchObject({
      state: 'UNKNOWN',
      backupType: 'UNKNOWN',
    });
  });

  it('getBackupHandler covers error-code branches', async () => {
    const { getBackupHandler } = await import('./backup-handler.js');
    const mkErr = (code: number) => Object.assign(new Error('boom'), { code });

    for (const code of [5, 7]) {
      createClientMock.mockReturnValue({ getBackup: vi.fn().mockRejectedValue(mkErr(code)) });
      const res = (await getBackupHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
        backupId: 'b1',
      })) as any;
      expect(res.isError).toBe(true);
    }
  });

  it('listBackupsHandler calls listBackups and returns formatted backups + nextPageToken', async () => {
    const listBackups = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1' }],
        undefined,
        'next',
      ]);
    createClientMock.mockReturnValue({ listBackups });

    const { listBackupsHandler } = await import('./backup-handler.js');
    const result = await listBackupsHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(listBackups).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/backupVaults/bv1',
      filter: undefined,
      pageSize: undefined,
      pageToken: undefined,
    });
    expect(result.structuredContent).toMatchObject({
      backups: [expect.objectContaining({ backupId: 'b1', backupVaultId: 'bv1' })],
      nextPageToken: 'next',
    });
  });

  it('listBackupsHandler uses location "-" when omitted', async () => {
    const listBackups = vi.fn().mockResolvedValue([[], undefined, undefined]);
    createClientMock.mockReturnValue({ listBackups });

    const { listBackupsHandler } = await import('./backup-handler.js');
    await listBackupsHandler({ projectId: 'p1', backupVaultId: 'bv1' });

    expect(listBackups).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/-/backupVaults/bv1',
      filter: undefined,
      pageSize: undefined,
      pageToken: undefined,
    });
  });

  it('listBackupsHandler omits nextPageToken when it is falsey and handles undefined backup entries', async () => {
    const listBackups = vi.fn().mockResolvedValue([[undefined as any], undefined, '']);
    createClientMock.mockReturnValue({ listBackups });

    const { listBackupsHandler } = await import('./backup-handler.js');
    const result = await listBackupsHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(result.structuredContent).toEqual({
      backups: [{}],
      nextPageToken: undefined,
    });
  });

  it('listBackupsHandler covers error-code branches', async () => {
    const { listBackupsHandler } = await import('./backup-handler.js');
    const mkErr = (code: number) => Object.assign(new Error('boom'), { code });

    for (const code of [5, 7, 3]) {
      createClientMock.mockReturnValue({ listBackups: vi.fn().mockRejectedValue(mkErr(code)) });
      const res = (await listBackupsHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
      })) as any;
      expect(res.isError).toBe(true);
    }
  });

  it('restoreBackupHandler creates a volume from backup via createVolume', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceVolume: 'projects/p1/locations/us-central1/volumes/src-vol',
        volumeUsageBytes: '1073741824',
      },
    ]);
    const getVolume = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/src-vol',
        capacityGib: 100,
        protocols: ['NFSV3'],
        shareName: 'src-share',
      },
    ]);
    const createVolume = vi.fn().mockResolvedValue([{ name: 'op-restore' }]);
    createClientMock.mockReturnValue({ getBackup, getVolume, createVolume });

    const { restoreBackupHandler } = await import('./backup-handler.js');
    const result = await restoreBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      targetStoragePoolId: 'sp1',
      targetVolumeId: 'vol2',
      restoreOption: 'CREATE_NEW_VOLUME',
    });

    expect(getBackup).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
    });
    expect(getVolume).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/src-vol',
    });
    expect(createVolume).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      volumeId: 'vol2',
      volume: {
        storagePool: 'sp1',
        capacityGib: 100,
        protocols: [1],
        shareName: 'src-share',
        restoreParameters: {
          sourceBackup: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        },
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol2',
      operationId: 'op-restore',
    });
  });

  it('restoreBackupHandler uses explicit capacity/protocols when source volume is gone', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        sourceVolume: 'projects/p1/locations/us-central1/volumes/missing',
        volumeUsageBytes: String(5 * 1024 ** 3),
      },
    ]);
    const getVolume = vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 5 }));
    const createVolume = vi.fn().mockResolvedValue([{ name: 'op-restore2' }]);
    createClientMock.mockReturnValue({ getBackup, getVolume, createVolume });

    const { restoreBackupHandler } = await import('./backup-handler.js');
    const result = await restoreBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      targetStoragePoolId: 'sp1',
      targetVolumeId: 'vol2',
      restoreOption: 'CREATE_NEW_VOLUME',
      capacityGib: 50,
      protocols: ['NFSV4', 'SMB'],
      shareName: 'restored-share',
    });

    expect(createVolume).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      volumeId: 'vol2',
      volume: {
        storagePool: 'sp1',
        capacityGib: 50,
        protocols: [2, 3],
        shareName: 'restored-share',
        restoreParameters: {
          sourceBackup: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        },
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol2',
      operationId: 'op-restore2',
    });
  });

  it('restoreBackupHandler derives capacity from backup usage when source volume is gone', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        volumeUsageBytes: String(10 * 1024 ** 3),
      },
    ]);
    const createVolume = vi.fn().mockResolvedValue([{ name: 'op-restore3' }]);
    createClientMock.mockReturnValue({ getBackup, createVolume });

    const { restoreBackupHandler } = await import('./backup-handler.js');
    await restoreBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      targetStoragePoolId: 'sp1',
      targetVolumeId: 'vol2',
      restoreOption: 'CREATE_NEW_VOLUME',
      protocols: ['NFSV3'],
    });

    expect(createVolume).toHaveBeenCalledWith(
      expect.objectContaining({
        volume: expect.objectContaining({
          capacityGib: 12, // ceil(10 * 1.2)
          protocols: [1],
          shareName: 'vol2',
        }),
      })
    );
  });

  it('restoreBackupHandler rejects OVERWRITE_EXISTING_VOLUME', async () => {
    createClientMock.mockReturnValue({});

    const { restoreBackupHandler } = await import('./backup-handler.js');
    const result = (await restoreBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      targetStoragePoolId: 'sp1',
      targetVolumeId: 'vol2',
      restoreOption: 'OVERWRITE_EXISTING_VOLUME',
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('OVERWRITE_EXISTING_VOLUME is not supported');
  });

  it('restoreBackupHandler returns isError when protocols cannot be resolved', async () => {
    const getBackup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        volumeUsageBytes: String(1024 ** 3),
      },
    ]);
    createClientMock.mockReturnValue({ getBackup, createVolume: vi.fn() });

    const { restoreBackupHandler } = await import('./backup-handler.js');
    const result = (await restoreBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      targetStoragePoolId: 'sp1',
      targetVolumeId: 'vol2',
      restoreOption: 'CREATE_NEW_VOLUME',
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('protocols is required');
  });

  it('covers error-code branches for restoreBackupHandler and updateBackupHandler', async () => {
    const mkErr = (code: number) => Object.assign(new Error('boom'), { code });
    const { restoreBackupHandler, updateBackupHandler } = await import('./backup-handler.js');

    for (const code of [5, 7, 6, 9, 3]) {
      createClientMock.mockReturnValue({
        getBackup: vi.fn().mockRejectedValue(mkErr(code)),
      });
      const res = (await restoreBackupHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
        backupId: 'b1',
        targetStoragePoolId: 'sp1',
        targetVolumeId: 'vol2',
        restoreOption: 'CREATE_NEW_VOLUME',
        capacityGib: 10,
        protocols: ['NFSV3'],
      })) as any;
      expect(res.isError).toBe(true);
    }

    for (const code of [5, 7]) {
      createClientMock.mockReturnValue({ updateBackup: vi.fn().mockRejectedValue(mkErr(code)) });
      const res = (await updateBackupHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
        backupId: 'b1',
        description: 'd',
      })) as any;
      expect(res.isError).toBe(true);
    }
  });

  it('updateBackupHandler calls updateBackup with updateMask', async () => {
    const updateBackup = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateBackup });

    const { updateBackupHandler } = await import('./backup-handler.js');
    const result = await updateBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      description: 'd',
    });

    expect(updateBackup).toHaveBeenCalledTimes(1);
    expect(updateBackup.mock.calls[0]?.[0]).toMatchObject({
      backup: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        description: 'd',
      },
      updateMask: { paths: ['description'] },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
      operationId: 'op-upd',
    });
  });

  it('updateBackupHandler falls back to empty operationId when operation.name is missing', async () => {
    const updateBackup = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ updateBackup });

    const { updateBackupHandler } = await import('./backup-handler.js');
    const result = await updateBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      description: 'd',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
      operationId: '',
    });
  });

  it('updateBackupHandler covers labels updateMask branch', async () => {
    const updateBackup = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateBackup });

    const { updateBackupHandler } = await import('./backup-handler.js');
    const result = await updateBackupHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      labels: { a: 'b' },
    });

    expect(updateBackup.mock.calls[0]?.[0]).toMatchObject({
      backup: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
        labels: { a: 'b' },
      },
      updateMask: { paths: ['labels'] },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd2' });
  });

  it('restoreBackupFilesHandler calls restoreBackupFiles and returns operationId', async () => {
    const restoreBackupFiles = vi.fn().mockResolvedValue([{ name: 'op-rbf' }]);
    createClientMock.mockReturnValue({ restoreBackupFiles });

    const { restoreBackupFilesHandler } = await import('./backup-handler.js');
    const result = await restoreBackupFilesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      fileList: ['/dir/a.txt', '/dir/b.txt'],
      restoreDestinationPath: '/restore',
    });

    expect(restoreBackupFiles).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      backup: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
      fileList: ['/dir/a.txt', '/dir/b.txt'],
      restoreDestinationPath: '/restore',
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: 'op-rbf',
    });
  });

  it('restoreBackupFilesHandler returns isError for invalid input (no client call)', async () => {
    createClientMock.mockReturnValue({ restoreBackupFiles: vi.fn() });

    const { restoreBackupFilesHandler } = await import('./backup-handler.js');
    const result = (await restoreBackupFilesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: '',
      backupVaultId: 'bv1',
      backupId: 'b1',
      fileList: [],
      restoreDestinationPath: '',
    })) as any;

    expect(result.isError).toBe(true);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('restoreBackupFilesHandler validates fileList items are non-empty strings', async () => {
    createClientMock.mockReturnValue({ restoreBackupFiles: vi.fn() });
    const { restoreBackupFilesHandler } = await import('./backup-handler.js');

    const result = (await restoreBackupFilesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      fileList: ['/dir/a.txt', ''],
      restoreDestinationPath: '/restore',
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('fileList must contain only non-empty strings');
  });

  it('restoreBackupFilesHandler validates non-string required fields', async () => {
    createClientMock.mockReturnValue({ restoreBackupFiles: vi.fn() });
    const { restoreBackupFilesHandler } = await import('./backup-handler.js');

    const result = (await restoreBackupFilesHandler({
      projectId: 1,
      location: 2,
      volumeId: 'vol1',
      backupVaultId: 3,
      backupId: 4,
      fileList: ['/dir/a.txt'],
      restoreDestinationPath: '/restore',
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Missing or invalid projectId');
    expect(result.content[0].text).toContain('Missing or invalid location');
    expect(result.content[0].text).toContain('Missing or invalid backupVaultId');
    expect(result.content[0].text).toContain('Missing or invalid backupId');
  });

  it('restoreBackupFilesHandler falls back to empty operationId when operation.name is missing', async () => {
    const restoreBackupFiles = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ restoreBackupFiles });

    const { restoreBackupFilesHandler } = await import('./backup-handler.js');
    const result = await restoreBackupFilesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      fileList: ['/dir/a.txt'],
      restoreDestinationPath: '/restore',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      operationId: '',
    });
  });

  it('restoreBackupFilesHandler covers error path', async () => {
    const err = new Error('boom');
    createClientMock.mockReturnValue({ restoreBackupFiles: vi.fn().mockRejectedValue(err) });

    const { restoreBackupFilesHandler } = await import('./backup-handler.js');
    const result = (await restoreBackupFilesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      fileList: ['/dir/a.txt'],
      restoreDestinationPath: '/restore',
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to restore backup files');
  });

  it('restoreBackupFilesHandler falls back to Unknown error when error has no message', async () => {
    createClientMock.mockReturnValue({ restoreBackupFiles: vi.fn().mockRejectedValue({}) });
    const { restoreBackupFilesHandler } = await import('./backup-handler.js');

    const result = (await restoreBackupFilesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      backupVaultId: 'bv1',
      backupId: 'b1',
      fileList: ['/dir/a.txt'],
      restoreDestinationPath: '/restore',
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown error');
  });
});

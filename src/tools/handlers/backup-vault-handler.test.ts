import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('backup-vault-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createBackupVaultHandler calls createBackupVault and returns operationId', async () => {
    const createBackupVault = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createBackupVault });

    const { createBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await createBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      description: 'd',
    });

    expect(createBackupVault).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      backupVaultId: 'bv1',
      backupVault: { description: 'd', labels: undefined, backupRetentionPolicy: undefined },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1',
      operationId: 'op-create',
    });
  });

  it('createBackupVaultHandler includes backupRetentionPolicy (immutability) when provided', async () => {
    const createBackupVault = vi.fn().mockResolvedValue([{ name: 'op-create2' }]);
    createClientMock.mockReturnValue({ createBackupVault });

    const { createBackupVaultHandler } = await import('./backup-vault-handler.js');
    await createBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      description: 'd',
      backupRetentionPolicy: {
        backupMinimumEnforcedRetentionDays: 7,
        dailyBackupImmutable: true,
        weeklyBackupImmutable: true,
        monthlyBackupImmutable: false,
        manualBackupImmutable: true,
      },
    });

    expect(createBackupVault).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      backupVaultId: 'bv1',
      backupVault: {
        description: 'd',
        labels: undefined,
        backupRetentionPolicy: {
          backupMinimumEnforcedRetentionDays: 7,
          dailyBackupImmutable: true,
          weeklyBackupImmutable: true,
          monthlyBackupImmutable: false,
          manualBackupImmutable: true,
        },
      },
    });
  });

  it('deleteBackupVaultHandler calls deleteBackupVault and returns operationId', async () => {
    const deleteBackupVault = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteBackupVault });

    const { deleteBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await deleteBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(deleteBackupVault).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('getBackupVaultHandler calls getBackupVault and fills defaults for required fields', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getBackupVault });

    const { getBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await getBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(getBackupVault).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1',
      backupVaultId: 'bv1',
      backupVaultType: 'STANDARD',
      sourceRegion: 'us-central1',
      backupRegion: 'us-central1',
      sourceBackupVault: '',
      destinationBackupVault: '',
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getBackupVaultHandler handles undefined backupVault (covers formatBackupVaultData !backupVault branch)', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getBackupVault });

    const { getBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await getBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(result.structuredContent).toMatchObject({
      backupVaultType: 'STANDARD',
      sourceRegion: 'us-central1',
      backupRegion: 'us-central1',
      sourceBackupVault: '',
      destinationBackupVault: '',
    });
  });

  it('getBackupVaultHandler formats backupRetentionPolicy when present', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        backupRetentionPolicy: {
          backupMinimumEnforcedRetentionDays: 7,
          dailyBackupImmutable: true,
          weeklyBackupImmutable: false,
          monthlyBackupImmutable: true,
          manualBackupImmutable: false,
        },
      },
    ]);
    createClientMock.mockReturnValue({ getBackupVault });

    const { getBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await getBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(result.structuredContent).toMatchObject({
      backupRetentionPolicy: {
        backupMinimumEnforcedRetentionDays: 7,
        dailyBackupImmutable: true,
        weeklyBackupImmutable: false,
        monthlyBackupImmutable: true,
        manualBackupImmutable: false,
      },
    });
  });

  it('getBackupVaultHandler applies backupRetentionPolicy fallbacks for missing/falsey fields', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        backupRetentionPolicy: {
          // Intentionally missing/undefined to exercise `||` fallbacks
          backupMinimumEnforcedRetentionDays: undefined,
          dailyBackupImmutable: undefined,
          weeklyBackupImmutable: true,
          monthlyBackupImmutable: undefined,
          manualBackupImmutable: true,
        },
      },
    ]);
    createClientMock.mockReturnValue({ getBackupVault });

    const { getBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await getBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(result.structuredContent).toMatchObject({
      backupRetentionPolicy: {
        backupMinimumEnforcedRetentionDays: 0,
        dailyBackupImmutable: false,
        weeklyBackupImmutable: true,
        monthlyBackupImmutable: false,
        manualBackupImmutable: true,
      },
    });
  });

  it('getBackupVaultHandler formats updateTime when present', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        updateTime: { seconds: 2 },
      },
    ]);
    createClientMock.mockReturnValue({ getBackupVault });

    const { getBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await getBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect((result.structuredContent as any).updateTime).toBeInstanceOf(Date);
  });

  it('getBackupVaultHandler formats all optional fields (covers most formatBackupVaultData branches)', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        state: 'READY',
        createTime: { seconds: 1 },
        updateTime: { seconds: 2 },
        backupVaultType: 'STANDARD',
        sourceRegion: 'r1',
        backupRegion: 'r2',
        sourceBackupVault: 'src',
        destinationBackupVault: 'dst',
        backupRetentionPolicy: {
          backupMinimumEnforcedRetentionDays: 7,
          dailyBackupImmutable: true,
          weeklyBackupImmutable: false,
          monthlyBackupImmutable: true,
          manualBackupImmutable: false,
        },
        description: 'd',
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getBackupVault });

    const { getBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await getBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
    });

    expect(result.structuredContent).toMatchObject({
      backupVaultId: 'bv1',
      state: 'READY',
      backupVaultType: 'STANDARD',
      sourceRegion: 'r1',
      backupRegion: 'r2',
      sourceBackupVault: 'src',
      destinationBackupVault: 'dst',
      description: 'd',
      labels: { a: 'b' },
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
    expect((result.structuredContent as any).updateTime).toBeInstanceOf(Date);
  });

  it('listBackupVaultsHandler calls listBackupVaults and returns formatted list', async () => {
    const listBackupVaults = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/p1/locations/us-central1/backupVaults/bv1',
          createTime: { seconds: 1 },
        },
        { name: 'projects/p1/locations/us-central1/backupVaults/bv2' },
      ],
    ]);
    createClientMock.mockReturnValue({ listBackupVaults });

    const { listBackupVaultsHandler } = await import('./backup-vault-handler.js');
    const result = await listBackupVaultsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(listBackupVaults).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      filter: undefined,
      pageSize: undefined,
      pageToken: undefined,
    });
    expect(result.structuredContent).toMatchObject({
      backupVaults: [
        expect.objectContaining({ backupVaultId: 'bv1' }),
        expect.objectContaining({ backupVaultId: 'bv2' }),
      ],
    });
  });

  it('listBackupVaultsHandler handles object-shaped responses (backupVaults + nextPageToken)', async () => {
    const listBackupVaults = vi.fn().mockResolvedValue([
      {
        backupVaults: [{ name: 'projects/p1/locations/us-central1/backupVaults/bv1' }],
        nextPageToken: 'next',
      },
    ]);
    createClientMock.mockReturnValue({ listBackupVaults });

    const { listBackupVaultsHandler } = await import('./backup-vault-handler.js');
    const result = await listBackupVaultsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({
      backupVaults: [expect.objectContaining({ backupVaultId: 'bv1' })],
      nextPageToken: 'next',
    });
  });

  it('updateBackupVaultHandler calls updateBackupVault with updateMask', async () => {
    const updateBackupVault = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateBackupVault });

    const { updateBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await updateBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      description: 'd2',
    });

    expect(updateBackupVault).toHaveBeenCalledWith({
      backupVault: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        description: 'd2',
        labels: undefined,
      },
      updateMask: { paths: ['description'] },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1',
      operationId: 'op-upd',
    });
  });

  it('updateBackupVaultHandler supports updating backupRetentionPolicy (immutability) and includes updateMask', async () => {
    const updateBackupVault = vi.fn().mockResolvedValue([{ name: 'op-upd-imm' }]);
    createClientMock.mockReturnValue({ updateBackupVault });

    const { updateBackupVaultHandler } = await import('./backup-vault-handler.js');
    await updateBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupRetentionPolicy: {
        backupMinimumEnforcedRetentionDays: 30,
        dailyBackupImmutable: true,
        weeklyBackupImmutable: false,
        monthlyBackupImmutable: true,
        manualBackupImmutable: true,
      },
    });

    expect(updateBackupVault).toHaveBeenCalledWith({
      backupVault: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        description: undefined,
        labels: undefined,
        backupRetentionPolicy: {
          backupMinimumEnforcedRetentionDays: 30,
          dailyBackupImmutable: true,
          weeklyBackupImmutable: false,
          monthlyBackupImmutable: true,
          manualBackupImmutable: true,
        },
      },
      updateMask: { paths: ['backup_retention_policy'] },
    });
  });

  it('updateBackupVaultHandler includes labels in updateMask when provided', async () => {
    const updateBackupVault = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateBackupVault });

    const { updateBackupVaultHandler } = await import('./backup-vault-handler.js');
    const result = await updateBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      labels: { a: 'b' },
    });

    expect(updateBackupVault).toHaveBeenCalledWith({
      backupVault: {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        description: undefined,
        labels: { a: 'b' },
      },
      updateMask: { paths: ['labels'] },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupVaults/bv1',
      operationId: 'op-upd2',
    });
  });

  it('covers error-code branches for create/delete/get/list/update', async () => {
    const mkErr = (code: number) => Object.assign(new Error('boom'), { code });

    const {
      createBackupVaultHandler,
      deleteBackupVaultHandler,
      getBackupVaultHandler,
      listBackupVaultsHandler,
      updateBackupVaultHandler,
    } = await import('./backup-vault-handler.js');

    // create error branches: 6/7/5/3
    for (const code of [6, 7, 5, 3]) {
      createClientMock.mockReturnValue({
        createBackupVault: vi.fn().mockRejectedValue(mkErr(code)),
      });
      const res = (await createBackupVaultHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
      })) as any;
      expect(res.isError).toBe(true);
    }

    // delete error branches: 5/7/9
    for (const code of [5, 7, 9]) {
      createClientMock.mockReturnValue({
        deleteBackupVault: vi.fn().mockRejectedValue(mkErr(code)),
      });
      const res = (await deleteBackupVaultHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
      })) as any;
      expect(res.isError).toBe(true);
    }

    // get error branches: 5/7
    for (const code of [5, 7]) {
      createClientMock.mockReturnValue({ getBackupVault: vi.fn().mockRejectedValue(mkErr(code)) });
      const res = (await getBackupVaultHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
      })) as any;
      expect(res.isError).toBe(true);
    }

    // list error branches: 5/7/3
    for (const code of [5, 7, 3]) {
      createClientMock.mockReturnValue({
        listBackupVaults: vi.fn().mockRejectedValue(mkErr(code)),
      });
      const res = (await listBackupVaultsHandler({
        projectId: 'p1',
        location: 'us-central1',
        filter: 'x',
      })) as any;
      expect(res.isError).toBe(true);
    }

    // update error branches: 5/7/3
    for (const code of [5, 7, 3]) {
      createClientMock.mockReturnValue({
        updateBackupVault: vi.fn().mockRejectedValue(mkErr(code)),
      });
      const res = (await updateBackupVaultHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
        description: 'd',
      })) as any;
      expect(res.isError).toBe(true);
    }
  });
});

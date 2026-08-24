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
      backupVault: {
        backupVaultType: 'IN_REGION',
        description: 'd',
        labels: undefined,
        backupRetentionPolicy: undefined,
      },
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
        backupVaultType: 'IN_REGION',
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

  it('createBackupVaultHandler constructs a cross-region request', async () => {
    const createBackupVault = vi.fn().mockResolvedValue([{ name: 'op-crb' }]);
    createClientMock.mockReturnValue({ createBackupVault });

    const { createBackupVaultHandler } = await import('./backup-vault-handler.js');
    await createBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupVaultType: 'cross_region',
      backupRegion: 'us-east1',
      kmsConfig: 'projects/p1/locations/us-east1/kmsConfigs/key-1',
    });

    expect(createBackupVault).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      backupVaultId: 'bv1',
      backupVault: {
        backupVaultType: 'CROSS_REGION',
        description: undefined,
        labels: undefined,
        backupRegion: 'us-east1',
        kmsConfig: 'projects/p1/locations/us-east1/kmsConfigs/key-1',
      },
    });
  });

  it('createBackupVaultHandler normalizes resource-name inputs', async () => {
    const createBackupVault = vi.fn().mockResolvedValue([{ name: 'op-crb' }]);
    createClientMock.mockReturnValue({ createBackupVault });

    const { createBackupVaultHandler } = await import('./backup-vault-handler.js');
    await createBackupVaultHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'bv1',
      backupVaultType: 'CROSS_REGION',
      backupRegion: ' projects/p1/locations/us-east1/ ',
      kmsConfig: ' projects/p1/locations/us-east1/kmsConfigs/key-1/ ',
    });

    expect(createBackupVault.mock.calls[0]?.[0].backupVault).toMatchObject({
      backupRegion: 'us-east1',
      kmsConfig: 'projects/p1/locations/us-east1/kmsConfigs/key-1',
    });
  });

  const invalidCreateCases: Array<[Record<string, unknown>, string]> = [
    [{ backupVaultType: 'INVALID' }, 'backupVaultType must be IN_REGION or CROSS_REGION'],
    [{ backupVaultType: 'CROSS_REGION' }, 'CROSS_REGION backup vaults require backupRegion'],
    [
      { backupVaultType: 'CROSS_REGION', backupRegion: 'us-central1' },
      'backupRegion must differ from location',
    ],
    [{ backupRegion: 'us-east1' }, 'backupRegion must match location or be omitted'],
    [
      { backupVaultType: 'CROSS_REGION', backupRegion: 'us-east1', kmsConfig: 'key-1' },
      'kmsConfig must be a full KMS config resource name',
    ],
    [
      {
        backupVaultType: 'CROSS_REGION',
        backupRegion: 'us-east1',
        kmsConfig: 'projects/p1/locations/us-central1/kmsConfigs/key-1',
      },
      'kmsConfig must be in region us-east1',
    ],
    [
      { kmsConfig: 'projects/p1/locations/us-east1/kmsConfigs/key-1' },
      'kmsConfig must be in region us-central1',
    ],
  ];

  it.each(invalidCreateCases)(
    'createBackupVaultHandler rejects invalid arguments (case %#)',
    async (overrides, message) => {
      const createBackupVault = vi.fn();
      createClientMock.mockReturnValue({ createBackupVault });

      const { createBackupVaultHandler } = await import('./backup-vault-handler.js');
      const result = (await createBackupVaultHandler({
        projectId: 'p1',
        location: 'us-central1',
        backupVaultId: 'bv1',
        ...overrides,
      })) as any;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(message);
      expect(createBackupVault).not.toHaveBeenCalled();
    }
  );

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
      backupVaultType: 'BACKUP_VAULT_TYPE_UNSPECIFIED',
    });
    expect(result.structuredContent).not.toHaveProperty('sourceRegion');
    expect(result.structuredContent).not.toHaveProperty('backupRegion');
    expect(result.structuredContent).not.toHaveProperty('sourceBackupVault');
    expect(result.structuredContent).not.toHaveProperty('destinationBackupVault');
    expect((result.structuredContent as any).createTime).toMatch(/^\d{4}-/);
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

    expect(result.structuredContent).toEqual({
      backupVaultType: 'BACKUP_VAULT_TYPE_UNSPECIFIED',
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

    expect((result.structuredContent as any).updateTime).toMatch(/^\d{4}-/);
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
    expect((result.structuredContent as any).createTime).toMatch(/^\d{4}-/);
    expect((result.structuredContent as any).updateTime).toMatch(/^\d{4}-/);
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

  it('getBackupVaultHandler normalizes non-string state and backupVaultType to UNKNOWN', async () => {
    const getBackupVault = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupVaults/bv1',
        state: 1,
        backupVaultType: 2,
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
      state: 'UNKNOWN',
      backupVaultType: 'UNKNOWN',
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

  it('listBackupVaultsHandler uses location "-" when location is omitted', async () => {
    const listBackupVaults = vi.fn().mockResolvedValue([[]]);
    createClientMock.mockReturnValue({ listBackupVaults });

    const { listBackupVaultsHandler } = await import('./backup-vault-handler.js');
    await listBackupVaultsHandler({ projectId: 'p1' });

    expect(listBackupVaults).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/-',
      filter: undefined,
      pageSize: undefined,
      pageToken: undefined,
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

  it('covers error-code branches for create/get/list/update', async () => {
    const mkErr = (code: number) => Object.assign(new Error('boom'), { code });

    const {
      createBackupVaultHandler,
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

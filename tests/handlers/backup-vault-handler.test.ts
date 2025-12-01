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
  createBackupVaultHandler,
  deleteBackupVaultHandler,
  getBackupVaultHandler,
  listBackupVaultsHandler,
  updateBackupVaultHandler,
} from '../../src/tools/handlers/backup-vault-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  backupVaultId: 'vault',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('backup vault handlers', () => {
  it('creates a backup vault', async () => {
    client.createBackupVault = vi.fn().mockResolvedValue([{ name: 'operations/create' }]);

    const result = await createBackupVaultHandler(
      { ...baseArgs, description: 'desc', labels: { env: 'test' } },
      {},
    );

    expect(client.createBackupVault).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1',
      backupVaultId: 'vault',
      backupVault: { description: 'desc', labels: { env: 'test' } },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/backupVaults/vault',
      operationId: 'operations/create',
    });
  });

  it('deletes a backup vault', async () => {
    client.deleteBackupVault = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);

    const result = await deleteBackupVaultHandler(
      { ...baseArgs, force: true },
      {},
    );

    expect(client.deleteBackupVault).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/backupVaults/vault',
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('retrieves and formats a backup vault', async () => {
    const name = 'projects/proj/locations/us-central1/backupVaults/vault';
    client.getBackupVault = vi.fn().mockResolvedValue([
      {
        name,
        state: 'READY',
        backupVaultType: 'STANDARD',
        sourceRegion: 'us-central1',
        backupRegion: 'us-central1',
        backupRetentionPolicy: { backupMinimumEnforcedRetentionDays: 5 },
        createTime: { seconds: 1700000000 },
      },
    ]);

    const result = await getBackupVaultHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      backupVaultId: 'vault',
      state: 'READY',
      backupRetentionPolicy: expect.objectContaining({
        backupMinimumEnforcedRetentionDays: 5,
      }),
    });
  });

  it('lists backup vaults when response is an object', async () => {
    client.listBackupVaults = vi.fn().mockResolvedValue([
      {
        backupVaults: [
          {
            name: 'projects/proj/locations/us-central1/backupVaults/vault1',
            state: 'READY',
            backupVaultType: 'STANDARD',
          },
        ],
        nextPageToken: 'next-1',
      },
    ]);

    const result = await listBackupVaultsHandler(
      { projectId: 'proj', location: 'us-central1' },
      {},
    );

    expect(result.structuredContent).toEqual({
      backupVaults: [
        expect.objectContaining({
          backupVaultId: 'vault1',
          state: 'READY',
        }),
      ],
      nextPageToken: 'next-1',
    });
  });

  it('lists backup vaults when response is an array', async () => {
    client.listBackupVaults = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/proj/locations/us-central1/backupVaults/vault2',
          state: 'READY',
        },
      ],
    ]);

    const result = await listBackupVaultsHandler(
      { projectId: 'proj', location: 'us-central1' },
      {},
    );

    expect(result.structuredContent?.backupVaults).toEqual([
      expect.objectContaining({ backupVaultId: 'vault2' }),
    ]);
  });

  it('updates a backup vault with an update mask', async () => {
    client.updateBackupVault = vi.fn().mockResolvedValue([{ name: 'operations/update' }]);

    const result = await updateBackupVaultHandler(
      { ...baseArgs, description: 'new', labels: { env: 'prod' } },
      {},
    );

    expect(client.updateBackupVault).toHaveBeenCalledWith({
      backupVault: {
        name: 'projects/proj/locations/us-central1/backupVaults/vault',
        description: 'new',
        labels: { env: 'prod' },
      },
      updateMask: {
        paths: ['description', 'labels'],
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/backupVaults/vault',
      operationId: 'operations/update',
    });
  });

  it('returns a readable message when deletion fails', async () => {
    client.deleteBackupVault = vi
      .fn()
      .mockRejectedValue({ code: 5, message: 'not found' });

    const result = await deleteBackupVaultHandler(baseArgs, {});

    expect(result).toMatchObject({
      isError: true,
      content: [
        {
          text: expect.stringContaining(
            'projects/proj/locations/us-central1/backupVaults/vault',
          ),
        },
      ],
    });
  });
});


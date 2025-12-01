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
  createBackupHandler,
  deleteBackupHandler,
  getBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
} from '../../src/tools/handlers/backup-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  backupVaultId: 'vault',
  backupId: 'backup1',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('backup handlers', () => {
  it('creates a backup and returns structured content', async () => {
    const createBackup = vi.fn().mockResolvedValue([{ name: 'operations/123' }]);
    client.createBackup = createBackup;

    const result = await createBackupHandler(
      {
        ...baseArgs,
        sourceVolumeName: 'projects/proj/locations/us-central1/storagePools/pool1/volumes/vol1',
      },
      {},
    );

    expect(createClientMock).toHaveBeenCalled();
    expect(createBackup).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1/backupVaults/vault',
      backupId: 'backup1',
      backup: expect.objectContaining({
        name: 'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
      }),
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
      operationId: 'operations/123',
    });
  });

  it('maps known errors when create backup fails', async () => {
    client.createBackup = vi.fn().mockRejectedValue({ code: 6, message: 'exists' });

    const result = await createBackupHandler(
      {
        ...baseArgs,
        sourceVolumeName: 'projects/proj/locations/us-central1/storagePools/pool1/volumes/vol1',
      },
      {},
    );

    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining('already exists') }],
    });
  });

  it('deletes a backup successfully', async () => {
    const deleteBackup = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);
    client.deleteBackup = deleteBackup;

    const result = await deleteBackupHandler(baseArgs, {});

    expect(deleteBackup).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('formats a retrieved backup', async () => {
    const backupName =
      'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1';
    client.getBackup = vi.fn().mockResolvedValue([
      {
        name: backupName,
        state: 'READY',
        sourceVolume: 'projects/proj/locations/us/storagePools/pool/volumes/vol1',
        volumeUsagebytes: 42,
        createTime: { seconds: 1700000000 },
      },
    ]);

    const result = await getBackupHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      backupId: 'backup1',
      backupVaultId: 'vault',
      state: 'READY',
      volumeUsagebytes: 42,
    });
  });

  it('lists backups and maps pagination token', async () => {
    client.listBackups = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
          state: 'READY',
          volumeUsagebytes: 1,
        },
      ],
      null,
      'token-2',
    ]);

    const result = await listBackupsHandler(baseArgs, {});

    expect(result.structuredContent).toEqual({
      backups: [
        expect.objectContaining({
          backupId: 'backup1',
          state: 'READY',
        }),
      ],
      nextPageToken: 'token-2',
    });
  });

  it('restores a backup using restoreBackup method when available', async () => {
    const restoreBackup = vi.fn().mockResolvedValue([{ name: 'operations/restore' }]);
    client.restoreBackup = restoreBackup;

    const result = await restoreBackupHandler(
      {
        ...baseArgs,
        targetStoragePoolId: 'poolA',
        targetVolumeId: 'volumeA',
        restoreOption: 'CREATE_NEW_VOLUME',
      },
      {},
    );

    expect(restoreBackup).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
      targetVolumeName:
        'projects/proj/locations/us-central1/storagePools/poolA/volumes/volumeA',
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/storagePools/poolA/volumes/volumeA',
      operationId: 'operations/restore',
    });
  });

  it('falls back to restoreVolumeBackup when restoreBackup is unavailable', async () => {
    const restoreVolumeBackup = vi.fn().mockResolvedValue([{ name: 'operations/fallback' }]);
    client.restoreVolumeBackup = restoreVolumeBackup;

    const result = await restoreBackupHandler(
      {
        ...baseArgs,
        targetStoragePoolId: 'poolA',
        targetVolumeId: 'volumeA',
        restoreOption: 'OVERWRITE_EXISTING_VOLUME',
      },
      {},
    );

    expect(restoreVolumeBackup).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
      targetVolumeName:
        'projects/proj/locations/us-central1/storagePools/poolA/volumes/volumeA',
      overwriteExistingVolume: true,
    });
    expect(result.structuredContent?.operationId).toBe('operations/fallback');
  });

  it('surfaces delete errors with helpful messaging', async () => {
    client.deleteBackup = vi
      .fn()
      .mockRejectedValue({ code: 5, message: 'missing' });

    const result = await deleteBackupHandler(baseArgs, {});

    expect(result).toMatchObject({
      isError: true,
      content: [
        {
          text: expect.stringContaining(
            'projects/proj/locations/us-central1/backupVaults/vault/backups/backup1',
          ),
        },
      ],
    });
  });

  it('handles list backups API failures gracefully', async () => {
    client.listBackups = vi
      .fn()
      .mockRejectedValue({ code: 3, message: 'invalid' });

    const result = await listBackupsHandler(baseArgs, {});

    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining('Invalid argument') }],
    });
  });
});


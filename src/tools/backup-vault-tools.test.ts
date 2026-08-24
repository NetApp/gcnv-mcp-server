import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createBackupVaultTool,
  getBackupVaultTool,
  listBackupVaultsTool,
} from './backup-vault-tools.js';

describe('backup-vault-tools', () => {
  it('accepts cross-region create arguments and rejects invalid vault types', () => {
    const schema = z.object(createBackupVaultTool.inputSchema);
    const input = {
      projectId: 'p1',
      location: 'us-central1',
      backupVaultId: 'vault-1',
      backupRegion: 'us-east1',
      kmsConfig: 'projects/p1/locations/us-east1/kmsConfigs/key-1',
    };

    for (const backupVaultType of ['CROSS_REGION', 'cross_region']) {
      expect(() => schema.parse({ ...input, backupVaultType })).not.toThrow();
    }
    expect(() => schema.parse({ ...input, backupVaultType: 'REMOTE' })).toThrow();
  });

  it('advertises every argument required for cross-region creation', () => {
    expect(createBackupVaultTool.inputSchema).toHaveProperty('backupVaultType');
    expect(createBackupVaultTool.inputSchema).toHaveProperty('backupRegion');
    expect(createBackupVaultTool.inputSchema).toHaveProperty('kmsConfig');
  });

  it('get and list output schemas accept backup encryption metadata', () => {
    const getSchema = z.object(getBackupVaultTool.outputSchema);
    const listSchema = z.object(listBackupVaultsTool.outputSchema);
    const vault = {
      name: 'projects/p1/locations/us-central1/backupVaults/vault-1',
      backupVaultId: 'vault-1',
      backupVaultType: 'CROSS_REGION',
      sourceRegion: 'us-central1',
      backupRegion: 'us-east1',
      state: 'READY',
      createTime: '2026-08-07T00:00:00.000Z',
      kmsConfig: 'projects/p1/locations/us-east1/kmsConfigs/key-1',
      encryptionState: 'ENCRYPTION_STATE_COMPLETED',
      backupsCryptoKeyVersion:
        'projects/p1/locations/us-east1/keyRings/ring/cryptoKeys/key/cryptoKeyVersions/1',
    };

    expect(() => getSchema.parse(vault)).not.toThrow();
    expect(() => listSchema.parse({ backupVaults: [vault] })).not.toThrow();
  });
});

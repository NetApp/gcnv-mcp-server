import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getBackupTool, listBackupsTool, restoreBackupTool } from './backup-tools.js';

describe('backup-tools', () => {
  it('does not expose a restore option for full backup restore', () => {
    expect(restoreBackupTool.inputSchema).not.toHaveProperty('restoreOption');
  });

  it('accepts ISO 8601 enforcedRetentionEndTime in backup output schemas', () => {
    const backup = {
      name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
      backupId: 'b1',
      backupVaultId: 'bv1',
      state: 'READY',
      sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
      enforcedRetentionEndTime: '2009-02-13T23:31:30.000Z',
    };

    const getSchema = z.object(getBackupTool.outputSchema);
    const listSchema = z.object(listBackupsTool.outputSchema);

    expect(() => getSchema.parse(backup)).not.toThrow();
    expect(() => listSchema.parse({ backups: [backup] })).not.toThrow();
  });
});

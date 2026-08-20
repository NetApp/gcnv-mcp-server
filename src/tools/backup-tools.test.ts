import { describe, expect, it } from 'vitest';
import { restoreBackupTool } from './backup-tools.js';

describe('backup-tools', () => {
  it('does not expose a restore option for full backup restore', () => {
    expect(restoreBackupTool.inputSchema).not.toHaveProperty('restoreOption');
  });
});

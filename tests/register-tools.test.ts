import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  createStoragePoolTool,
  deleteStoragePoolTool,
  getStoragePoolTool,
  listStoragePoolsTool,
  updateStoragePoolTool,
} from '../src/tools/storage-pool-tools.js';
import {
  createStoragePoolHandler,
  deleteStoragePoolHandler,
  getStoragePoolHandler,
  listStoragePoolsHandler,
  updateStoragePoolHandler,
} from '../src/tools/handlers/storage-pool-handler.js';

import {
  createVolumeTool,
  deleteVolumeTool,
  getVolumeTool,
  listVolumesTool,
  updateVolumeTool,
} from '../src/tools/volume-tools.js';
import {
  createVolumeHandler,
  deleteVolumeHandler,
  getVolumeHandler,
  listVolumesHandler,
  updateVolumeHandler,
} from '../src/tools/handlers/volume-handler.js';

import {
  createSnapshotTool,
  deleteSnapshotTool,
  getSnapshotTool,
  listSnapshotsTool,
  revertVolumeToSnapshotTool,
} from '../src/tools/snapshot-tools.js';
import {
  createSnapshotHandler,
  deleteSnapshotHandler,
  getSnapshotHandler,
  listSnapshotsHandler,
  revertVolumeToSnapshotHandler,
} from '../src/tools/handlers/snapshot-handler.js';

import {
  createBackupVaultTool,
  deleteBackupVaultTool,
  getBackupVaultTool,
  listBackupVaultsTool,
  updateBackupVaultTool,
} from '../src/tools/backup-vault-tools.js';
import {
  createBackupVaultHandler,
  deleteBackupVaultHandler,
  getBackupVaultHandler,
  listBackupVaultsHandler,
  updateBackupVaultHandler,
} from '../src/tools/handlers/backup-vault-handler.js';

import {
  createBackupTool,
  deleteBackupTool,
  getBackupTool,
  listBackupsTool,
  restoreBackupTool,
} from '../src/tools/backup-tools.js';
import {
  createBackupHandler,
  deleteBackupHandler,
  getBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
} from '../src/tools/handlers/backup-handler.js';

import {
  getOperationTool,
  cancelOperationTool,
  listOperationsTool,
} from '../src/tools/operation-tools.js';
import {
  getOperationHandler,
  cancelOperationHandler,
  listOperationsHandler,
} from '../src/tools/handlers/operation-handler.js';

import {
  createBackupPolicyTool,
  deleteBackupPolicyTool,
  getBackupPolicyTool,
  listBackupPoliciesTool,
  updateBackupPolicyTool,
} from '../src/tools/backup-policy-tools.js';
import { backupPolicyHandlers } from '../src/tools/handlers/backup-policy-handler.js';

import {
  createReplicationTool,
  deleteReplicationTool,
  getReplicationTool,
  listReplicationsTool,
  updateReplicationTool,
  resumeReplicationTool,
  stopReplicationTool,
  reverseReplicationDirectionTool,
} from '../src/tools/replication-tools.js';
import {
  createReplicationHandler,
  deleteReplicationHandler,
  getReplicationHandler,
  listReplicationsHandler,
  updateReplicationHandler,
  resumeReplicationHandler,
  stopReplicationHandler,
  reverseReplicationDirectionHandler,
} from '../src/tools/handlers/replication-handler.js';

import { registerAllTools } from '../src/registry/register-tools.js';

describe('registerAllTools', () => {
  it('registers every tool with its handler', () => {
    const registerTool = vi.fn();
    const mockServer = { registerTool } as unknown as McpServer;

    registerAllTools(mockServer);

    const expectedMappings: Array<{ tool: { name: string }; handler: Function }> = [
      { tool: createStoragePoolTool, handler: createStoragePoolHandler },
      { tool: deleteStoragePoolTool, handler: deleteStoragePoolHandler },
      { tool: getStoragePoolTool, handler: getStoragePoolHandler },
      { tool: listStoragePoolsTool, handler: listStoragePoolsHandler },
      { tool: updateStoragePoolTool, handler: updateStoragePoolHandler },

      { tool: createVolumeTool, handler: createVolumeHandler },
      { tool: deleteVolumeTool, handler: deleteVolumeHandler },
      { tool: getVolumeTool, handler: getVolumeHandler },
      { tool: listVolumesTool, handler: listVolumesHandler },
      { tool: updateVolumeTool, handler: updateVolumeHandler },

      { tool: createSnapshotTool, handler: createSnapshotHandler },
      { tool: deleteSnapshotTool, handler: deleteSnapshotHandler },
      { tool: getSnapshotTool, handler: getSnapshotHandler },
      { tool: listSnapshotsTool, handler: listSnapshotsHandler },
      { tool: revertVolumeToSnapshotTool, handler: revertVolumeToSnapshotHandler },

      { tool: createBackupVaultTool, handler: createBackupVaultHandler },
      { tool: deleteBackupVaultTool, handler: deleteBackupVaultHandler },
      { tool: getBackupVaultTool, handler: getBackupVaultHandler },
      { tool: listBackupVaultsTool, handler: listBackupVaultsHandler },
      { tool: updateBackupVaultTool, handler: updateBackupVaultHandler },

      { tool: createBackupTool, handler: createBackupHandler },
      { tool: deleteBackupTool, handler: deleteBackupHandler },
      { tool: getBackupTool, handler: getBackupHandler },
      { tool: listBackupsTool, handler: listBackupsHandler },
      { tool: restoreBackupTool, handler: restoreBackupHandler },

      { tool: getOperationTool, handler: getOperationHandler },
      { tool: cancelOperationTool, handler: cancelOperationHandler },
      { tool: listOperationsTool, handler: listOperationsHandler },

      { tool: createBackupPolicyTool, handler: backupPolicyHandlers[createBackupPolicyTool.name] },
      { tool: deleteBackupPolicyTool, handler: backupPolicyHandlers[deleteBackupPolicyTool.name] },
      { tool: getBackupPolicyTool, handler: backupPolicyHandlers[getBackupPolicyTool.name] },
      { tool: listBackupPoliciesTool, handler: backupPolicyHandlers[listBackupPoliciesTool.name] },
      { tool: updateBackupPolicyTool, handler: backupPolicyHandlers[updateBackupPolicyTool.name] },

      { tool: createReplicationTool, handler: createReplicationHandler },
      { tool: deleteReplicationTool, handler: deleteReplicationHandler },
      { tool: getReplicationTool, handler: getReplicationHandler },
      { tool: listReplicationsTool, handler: listReplicationsHandler },
      { tool: updateReplicationTool, handler: updateReplicationHandler },
      { tool: resumeReplicationTool, handler: resumeReplicationHandler },
      { tool: stopReplicationTool, handler: stopReplicationHandler },
      { tool: reverseReplicationDirectionTool, handler: reverseReplicationDirectionHandler },
    ];

    expect(registerTool).toHaveBeenCalledTimes(expectedMappings.length);

    expectedMappings.forEach(({ tool, handler }) => {
      expect(registerTool).toHaveBeenCalledWith(tool.name, tool, handler);
    });
  });
});


/**
 * Tool Registration Utility
 *
 * Registers all tool definitions and their handlers to the tool registry
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createStoragePoolTool,
  deleteStoragePoolTool,
  getStoragePoolTool,
  listStoragePoolsTool,
  updateStoragePoolTool,
  validateDirectoryServiceTool,
} from '../tools/storage-pool-tools.js';
import {
  createStoragePoolHandler,
  deleteStoragePoolHandler,
  getStoragePoolHandler,
  listStoragePoolsHandler,
  updateStoragePoolHandler,
  validateDirectoryServiceHandler,
} from '../tools/handlers/storage-pool-handler.js';
import {
  createVolumeTool,
  deleteVolumeTool,
  getVolumeTool,
  listVolumesTool,
  updateVolumeTool,
} from '../tools/volume-tools.js';
import {
  createVolumeHandler,
  deleteVolumeHandler,
  getVolumeHandler,
  listVolumesHandler,
  updateVolumeHandler,
} from '../tools/handlers/volume-handler.js';
import {
  createSnapshotTool,
  deleteSnapshotTool,
  getSnapshotTool,
  listSnapshotsTool,
  revertVolumeToSnapshotTool,
  updateSnapshotTool,
} from '../tools/snapshot-tools.js';
import {
  createSnapshotHandler,
  deleteSnapshotHandler,
  getSnapshotHandler,
  listSnapshotsHandler,
  revertVolumeToSnapshotHandler,
  updateSnapshotHandler,
} from '../tools/handlers/snapshot-handler.js';
import {
  createBackupVaultTool,
  deleteBackupVaultTool,
  getBackupVaultTool,
  listBackupVaultsTool,
  updateBackupVaultTool,
} from '../tools/backup-vault-tools.js';
import {
  createBackupVaultHandler,
  deleteBackupVaultHandler,
  getBackupVaultHandler,
  listBackupVaultsHandler,
  updateBackupVaultHandler,
} from '../tools/handlers/backup-vault-handler.js';
import {
  createBackupTool,
  deleteBackupTool,
  getBackupTool,
  listBackupsTool,
  restoreBackupTool,
  restoreBackupFilesTool,
  updateBackupTool,
} from '../tools/backup-tools.js';
import {
  createBackupHandler,
  deleteBackupHandler,
  getBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
  restoreBackupFilesHandler,
  updateBackupHandler,
} from '../tools/handlers/backup-handler.js';
import {
  getOperationTool,
  cancelOperationTool,
  listOperationsTool,
} from '../tools/operation-tools.js';
import {
  getOperationHandler,
  cancelOperationHandler,
  listOperationsHandler,
} from '../tools/handlers/operation-handler.js';
import {
  createBackupPolicyTool,
  deleteBackupPolicyTool,
  getBackupPolicyTool,
  listBackupPoliciesTool,
  updateBackupPolicyTool,
} from '../tools/backup-policy-tools.js';
import { backupPolicyHandlers } from '../tools/handlers/backup-policy-handler.js';
import {
  createReplicationTool,
  deleteReplicationTool,
  getReplicationTool,
  listReplicationsTool,
  updateReplicationTool,
  resumeReplicationTool,
  stopReplicationTool,
  reverseReplicationDirectionTool,
  establishPeeringTool,
  syncReplicationTool,
} from '../tools/replication-tools.js';
import {
  createReplicationHandler,
  deleteReplicationHandler,
  getReplicationHandler,
  listReplicationsHandler,
  updateReplicationHandler,
  resumeReplicationHandler,
  stopReplicationHandler,
  reverseReplicationDirectionHandler,
  establishPeeringHandler,
  syncReplicationHandler,
} from '../tools/handlers/replication-handler.js';
import {
  createActiveDirectoryTool,
  deleteActiveDirectoryTool,
  getActiveDirectoryTool,
  listActiveDirectoriesTool,
  updateActiveDirectoryTool,
} from '../tools/active-directory-tools.js';
import {
  createActiveDirectoryHandler,
  deleteActiveDirectoryHandler,
  getActiveDirectoryHandler,
  listActiveDirectoriesHandler,
  updateActiveDirectoryHandler,
} from '../tools/handlers/active-directory-handler.js';
import {
  createKmsConfigTool,
  deleteKmsConfigTool,
  getKmsConfigTool,
  listKmsConfigsTool,
  updateKmsConfigTool,
  verifyKmsConfigTool,
  encryptVolumesTool,
} from '../tools/kms-config-tools.js';
import {
  createKmsConfigHandler,
  deleteKmsConfigHandler,
  getKmsConfigHandler,
  listKmsConfigsHandler,
  updateKmsConfigHandler,
  verifyKmsConfigHandler,
  encryptVolumesHandler,
} from '../tools/handlers/kms-config-handler.js';
import {
  createQuotaRuleTool,
  deleteQuotaRuleTool,
  getQuotaRuleTool,
  listQuotaRulesTool,
  updateQuotaRuleTool,
} from '../tools/quota-rule-tools.js';
import {
  createQuotaRuleHandler,
  deleteQuotaRuleHandler,
  getQuotaRuleHandler,
  listQuotaRulesHandler,
  updateQuotaRuleHandler,
} from '../tools/handlers/quota-rule-handler.js';
import {
  createHostGroupTool,
  deleteHostGroupTool,
  getHostGroupTool,
  listHostGroupsTool,
  updateHostGroupTool,
} from '../tools/host-group-tools.js';
import {
  createHostGroupHandler,
  deleteHostGroupHandler,
  getHostGroupHandler,
  listHostGroupsHandler,
  updateHostGroupHandler,
} from '../tools/handlers/host-group-handler.js';

/**
 * Register all tools and their handlers to the tool registry
 */
export function registerAllTools(mcpServer: McpServer) {
  // Register storage pool tools
  mcpServer.registerTool(
    createStoragePoolTool.name,
    createStoragePoolTool,
    createStoragePoolHandler
  );
  mcpServer.registerTool(
    deleteStoragePoolTool.name,
    deleteStoragePoolTool,
    deleteStoragePoolHandler
  );
  mcpServer.registerTool(getStoragePoolTool.name, getStoragePoolTool, getStoragePoolHandler);
  mcpServer.registerTool(listStoragePoolsTool.name, listStoragePoolsTool, listStoragePoolsHandler);
  mcpServer.registerTool(
    updateStoragePoolTool.name,
    updateStoragePoolTool,
    updateStoragePoolHandler
  );
  mcpServer.registerTool(
    validateDirectoryServiceTool.name,
    validateDirectoryServiceTool,
    validateDirectoryServiceHandler
  );

  // Register volume tools
  mcpServer.registerTool(createVolumeTool.name, createVolumeTool, createVolumeHandler);
  mcpServer.registerTool(deleteVolumeTool.name, deleteVolumeTool, deleteVolumeHandler);
  mcpServer.registerTool(getVolumeTool.name, getVolumeTool, getVolumeHandler);
  mcpServer.registerTool(listVolumesTool.name, listVolumesTool, listVolumesHandler);
  mcpServer.registerTool(updateVolumeTool.name, updateVolumeTool, updateVolumeHandler);

  // Register snapshot tools
  mcpServer.registerTool(createSnapshotTool.name, createSnapshotTool, createSnapshotHandler);
  mcpServer.registerTool(deleteSnapshotTool.name, deleteSnapshotTool, deleteSnapshotHandler);
  mcpServer.registerTool(getSnapshotTool.name, getSnapshotTool, getSnapshotHandler);
  mcpServer.registerTool(listSnapshotsTool.name, listSnapshotsTool, listSnapshotsHandler);
  mcpServer.registerTool(
    revertVolumeToSnapshotTool.name,
    revertVolumeToSnapshotTool,
    revertVolumeToSnapshotHandler
  );
  mcpServer.registerTool(updateSnapshotTool.name, updateSnapshotTool, updateSnapshotHandler);

  // Register backup vault tools
  mcpServer.registerTool(
    createBackupVaultTool.name,
    createBackupVaultTool,
    createBackupVaultHandler
  );
  mcpServer.registerTool(
    deleteBackupVaultTool.name,
    deleteBackupVaultTool,
    deleteBackupVaultHandler
  );
  mcpServer.registerTool(getBackupVaultTool.name, getBackupVaultTool, getBackupVaultHandler);
  mcpServer.registerTool(listBackupVaultsTool.name, listBackupVaultsTool, listBackupVaultsHandler);
  mcpServer.registerTool(
    updateBackupVaultTool.name,
    updateBackupVaultTool,
    updateBackupVaultHandler
  );

  // Register backup tools
  mcpServer.registerTool(createBackupTool.name, createBackupTool, createBackupHandler);
  mcpServer.registerTool(deleteBackupTool.name, deleteBackupTool, deleteBackupHandler);
  mcpServer.registerTool(getBackupTool.name, getBackupTool, getBackupHandler);
  mcpServer.registerTool(listBackupsTool.name, listBackupsTool, listBackupsHandler);
  mcpServer.registerTool(restoreBackupTool.name, restoreBackupTool, restoreBackupHandler);
  mcpServer.registerTool(
    restoreBackupFilesTool.name,
    restoreBackupFilesTool,
    restoreBackupFilesHandler
  );
  mcpServer.registerTool(updateBackupTool.name, updateBackupTool, updateBackupHandler);

  // Register operation tools
  mcpServer.registerTool(getOperationTool.name, getOperationTool, getOperationHandler);
  mcpServer.registerTool(cancelOperationTool.name, cancelOperationTool, cancelOperationHandler);
  mcpServer.registerTool(listOperationsTool.name, listOperationsTool, listOperationsHandler);

  // Register backup policy tools
  mcpServer.registerTool(
    createBackupPolicyTool.name,
    createBackupPolicyTool,
    backupPolicyHandlers[createBackupPolicyTool.name]
  );
  mcpServer.registerTool(
    deleteBackupPolicyTool.name,
    deleteBackupPolicyTool,
    backupPolicyHandlers[deleteBackupPolicyTool.name]
  );
  mcpServer.registerTool(
    getBackupPolicyTool.name,
    getBackupPolicyTool,
    backupPolicyHandlers[getBackupPolicyTool.name]
  );
  mcpServer.registerTool(
    listBackupPoliciesTool.name,
    listBackupPoliciesTool,
    backupPolicyHandlers[listBackupPoliciesTool.name]
  );
  mcpServer.registerTool(
    updateBackupPolicyTool.name,
    updateBackupPolicyTool,
    backupPolicyHandlers[updateBackupPolicyTool.name]
  );

  // Register replication tools
  mcpServer.registerTool(
    createReplicationTool.name,
    createReplicationTool,
    createReplicationHandler
  );
  mcpServer.registerTool(
    deleteReplicationTool.name,
    deleteReplicationTool,
    deleteReplicationHandler
  );
  mcpServer.registerTool(getReplicationTool.name, getReplicationTool, getReplicationHandler);
  mcpServer.registerTool(listReplicationsTool.name, listReplicationsTool, listReplicationsHandler);
  mcpServer.registerTool(
    updateReplicationTool.name,
    updateReplicationTool,
    updateReplicationHandler
  );
  mcpServer.registerTool(
    resumeReplicationTool.name,
    resumeReplicationTool,
    resumeReplicationHandler
  );
  mcpServer.registerTool(stopReplicationTool.name, stopReplicationTool, stopReplicationHandler);
  mcpServer.registerTool(
    reverseReplicationDirectionTool.name,
    reverseReplicationDirectionTool,
    reverseReplicationDirectionHandler
  );
  mcpServer.registerTool(establishPeeringTool.name, establishPeeringTool, establishPeeringHandler);
  mcpServer.registerTool(syncReplicationTool.name, syncReplicationTool, syncReplicationHandler);

  // Register active directory tools
  mcpServer.registerTool(
    createActiveDirectoryTool.name,
    createActiveDirectoryTool,
    createActiveDirectoryHandler
  );
  mcpServer.registerTool(
    deleteActiveDirectoryTool.name,
    deleteActiveDirectoryTool,
    deleteActiveDirectoryHandler
  );
  mcpServer.registerTool(
    getActiveDirectoryTool.name,
    getActiveDirectoryTool,
    getActiveDirectoryHandler
  );
  mcpServer.registerTool(
    listActiveDirectoriesTool.name,
    listActiveDirectoriesTool,
    listActiveDirectoriesHandler
  );
  mcpServer.registerTool(
    updateActiveDirectoryTool.name,
    updateActiveDirectoryTool,
    updateActiveDirectoryHandler
  );

  // Register KMS config tools
  mcpServer.registerTool(createKmsConfigTool.name, createKmsConfigTool, createKmsConfigHandler);
  mcpServer.registerTool(deleteKmsConfigTool.name, deleteKmsConfigTool, deleteKmsConfigHandler);
  mcpServer.registerTool(getKmsConfigTool.name, getKmsConfigTool, getKmsConfigHandler);
  mcpServer.registerTool(listKmsConfigsTool.name, listKmsConfigsTool, listKmsConfigsHandler);
  mcpServer.registerTool(updateKmsConfigTool.name, updateKmsConfigTool, updateKmsConfigHandler);
  mcpServer.registerTool(verifyKmsConfigTool.name, verifyKmsConfigTool, verifyKmsConfigHandler);
  mcpServer.registerTool(encryptVolumesTool.name, encryptVolumesTool, encryptVolumesHandler);

  // Register quota rule tools
  mcpServer.registerTool(createQuotaRuleTool.name, createQuotaRuleTool, createQuotaRuleHandler);
  mcpServer.registerTool(deleteQuotaRuleTool.name, deleteQuotaRuleTool, deleteQuotaRuleHandler);
  mcpServer.registerTool(getQuotaRuleTool.name, getQuotaRuleTool, getQuotaRuleHandler);
  mcpServer.registerTool(listQuotaRulesTool.name, listQuotaRulesTool, listQuotaRulesHandler);
  mcpServer.registerTool(updateQuotaRuleTool.name, updateQuotaRuleTool, updateQuotaRuleHandler);

  // Register host group tools
  mcpServer.registerTool(createHostGroupTool.name, createHostGroupTool, createHostGroupHandler);
  mcpServer.registerTool(deleteHostGroupTool.name, deleteHostGroupTool, deleteHostGroupHandler);
  mcpServer.registerTool(getHostGroupTool.name, getHostGroupTool, getHostGroupHandler);
  mcpServer.registerTool(listHostGroupsTool.name, listHostGroupsTool, listHostGroupsHandler);
  mcpServer.registerTool(updateHostGroupTool.name, updateHostGroupTool, updateHostGroupHandler);
}

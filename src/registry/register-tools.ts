/**
 * Tool Registration Utility
 *
 * Registers all tool definitions and their handlers to the tool registry
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createStoragePoolTool,
  getStoragePoolTool,
  listStoragePoolsTool,
  updateStoragePoolTool,
  validateDirectoryServiceTool,
} from '../tools/storage-pool-tools.js';
import {
  createStoragePoolHandler,
  getStoragePoolHandler,
  listStoragePoolsHandler,
  updateStoragePoolHandler,
  validateDirectoryServiceHandler,
} from '../tools/handlers/storage-pool-handler.js';
import {
  createVolumeTool,
  getVolumeTool,
  listVolumesTool,
  updateVolumeTool,
} from '../tools/volume-tools.js';
import {
  createVolumeHandler,
  getVolumeHandler,
  listVolumesHandler,
  updateVolumeHandler,
} from '../tools/handlers/volume-handler.js';
import {
  createSnapshotTool,
  getSnapshotTool,
  listSnapshotsTool,
  revertVolumeToSnapshotTool,
  updateSnapshotTool,
} from '../tools/snapshot-tools.js';
import {
  createSnapshotHandler,
  getSnapshotHandler,
  listSnapshotsHandler,
  revertVolumeToSnapshotHandler,
  updateSnapshotHandler,
} from '../tools/handlers/snapshot-handler.js';
import {
  createBackupVaultTool,
  getBackupVaultTool,
  listBackupVaultsTool,
  updateBackupVaultTool,
} from '../tools/backup-vault-tools.js';
import {
  createBackupVaultHandler,
  getBackupVaultHandler,
  listBackupVaultsHandler,
  updateBackupVaultHandler,
} from '../tools/handlers/backup-vault-handler.js';
import {
  createBackupTool,
  getBackupTool,
  listBackupsTool,
  restoreBackupTool,
  restoreBackupFilesTool,
  updateBackupTool,
} from '../tools/backup-tools.js';
import {
  createBackupHandler,
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
  getBackupPolicyTool,
  listBackupPoliciesTool,
  updateBackupPolicyTool,
} from '../tools/backup-policy-tools.js';
import { backupPolicyHandlers } from '../tools/handlers/backup-policy-handler.js';
import {
  createReplicationTool,
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
  getActiveDirectoryTool,
  listActiveDirectoriesTool,
  updateActiveDirectoryTool,
} from '../tools/active-directory-tools.js';
import {
  createActiveDirectoryHandler,
  getActiveDirectoryHandler,
  listActiveDirectoriesHandler,
  updateActiveDirectoryHandler,
} from '../tools/handlers/active-directory-handler.js';
import {
  createKmsConfigTool,
  getKmsConfigTool,
  listKmsConfigsTool,
  updateKmsConfigTool,
  verifyKmsConfigTool,
  encryptVolumesTool,
} from '../tools/kms-config-tools.js';
import {
  createKmsConfigHandler,
  getKmsConfigHandler,
  listKmsConfigsHandler,
  updateKmsConfigHandler,
  verifyKmsConfigHandler,
  encryptVolumesHandler,
} from '../tools/handlers/kms-config-handler.js';
import {
  createQuotaRuleTool,
  getQuotaRuleTool,
  listQuotaRulesTool,
  updateQuotaRuleTool,
} from '../tools/quota-rule-tools.js';
import {
  createQuotaRuleHandler,
  getQuotaRuleHandler,
  listQuotaRulesHandler,
  updateQuotaRuleHandler,
} from '../tools/handlers/quota-rule-handler.js';
import {
  createHostGroupTool,
  getHostGroupTool,
  listHostGroupsTool,
  updateHostGroupTool,
} from '../tools/host-group-tools.js';
import {
  createHostGroupHandler,
  getHostGroupHandler,
  listHostGroupsHandler,
  updateHostGroupHandler,
} from '../tools/handlers/host-group-handler.js';
import {
  ontapSvmListTool,
  ontapVolumeCreateTool,
  ontapVolumeListTool,
  ontapVolumeGetTool,
  ontapJobGetTool,
  ontapSnapshotCreateTool,
  ontapSnapshotListTool,
  ontapLunCreateTool,
  ontapLunListTool,
  ontapLunGetTool,
} from '../tools/ontap-tools.js';
import {
  ontapSvmListHandler,
  ontapVolumeCreateHandler,
  ontapVolumeListHandler,
  ontapVolumeGetHandler,
  ontapJobGetHandler,
  ontapSnapshotCreateHandler,
  ontapSnapshotListHandler,
  ontapLunCreateHandler,
  ontapLunListHandler,
  ontapLunGetHandler,
} from '../tools/handlers/ontap-handler.js';
import { ontapDiscoverTool } from '../tools/ontap-discover-tool.js';
import { ontapDiscoverHandler } from '../tools/handlers/ontap-discover-handler.js';
import { ontapExecuteTool } from '../tools/ontap-execute-tool.js';
import { ontapExecuteHandler } from '../tools/handlers/ontap-execute-handler.js';
import { ontapAuditLogTool } from '../tools/ontap-audit-log-tool.js';
import { ontapAuditLogHandler } from '../tools/handlers/ontap-audit-log-handler.js';
import { withAuditLog } from '../utils/ontap-audit-logger.js';
import { ToolConfig, ToolHandler } from '../types/tool.js';

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
  mcpServer.registerTool(getVolumeTool.name, getVolumeTool, getVolumeHandler);
  mcpServer.registerTool(listVolumesTool.name, listVolumesTool, listVolumesHandler);
  mcpServer.registerTool(updateVolumeTool.name, updateVolumeTool, updateVolumeHandler);

  // Register snapshot tools
  mcpServer.registerTool(createSnapshotTool.name, createSnapshotTool, createSnapshotHandler);
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
  mcpServer.registerTool(getBackupVaultTool.name, getBackupVaultTool, getBackupVaultHandler);
  mcpServer.registerTool(listBackupVaultsTool.name, listBackupVaultsTool, listBackupVaultsHandler);
  mcpServer.registerTool(
    updateBackupVaultTool.name,
    updateBackupVaultTool,
    updateBackupVaultHandler
  );

  // Register backup tools
  mcpServer.registerTool(createBackupTool.name, createBackupTool, createBackupHandler);
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
  mcpServer.registerTool(getKmsConfigTool.name, getKmsConfigTool, getKmsConfigHandler);
  mcpServer.registerTool(listKmsConfigsTool.name, listKmsConfigsTool, listKmsConfigsHandler);
  mcpServer.registerTool(updateKmsConfigTool.name, updateKmsConfigTool, updateKmsConfigHandler);
  mcpServer.registerTool(verifyKmsConfigTool.name, verifyKmsConfigTool, verifyKmsConfigHandler);
  mcpServer.registerTool(encryptVolumesTool.name, encryptVolumesTool, encryptVolumesHandler);

  // Register quota rule tools
  mcpServer.registerTool(createQuotaRuleTool.name, createQuotaRuleTool, createQuotaRuleHandler);
  mcpServer.registerTool(getQuotaRuleTool.name, getQuotaRuleTool, getQuotaRuleHandler);
  mcpServer.registerTool(listQuotaRulesTool.name, listQuotaRulesTool, listQuotaRulesHandler);
  mcpServer.registerTool(updateQuotaRuleTool.name, updateQuotaRuleTool, updateQuotaRuleHandler);

  // Register host group tools
  mcpServer.registerTool(createHostGroupTool.name, createHostGroupTool, createHostGroupHandler);
  mcpServer.registerTool(getHostGroupTool.name, getHostGroupTool, getHostGroupHandler);
  mcpServer.registerTool(listHostGroupsTool.name, listHostGroupsTool, listHostGroupsHandler);
  mcpServer.registerTool(updateHostGroupTool.name, updateHostGroupTool, updateHostGroupHandler);

  // Register ONTAP Expert Mode tools -- audit log control
  mcpServer.registerTool(ontapAuditLogTool.name, ontapAuditLogTool, ontapAuditLogHandler);

  // Register ONTAP Expert Mode tools
  // withAuditLog wraps each handler to record calls when logging is enabled.
  const ontapTools: { tool: ToolConfig; handler: ToolHandler }[] = [
    { tool: ontapDiscoverTool, handler: ontapDiscoverHandler },
    { tool: ontapExecuteTool, handler: ontapExecuteHandler },
    { tool: ontapSvmListTool, handler: ontapSvmListHandler },
    { tool: ontapVolumeCreateTool, handler: ontapVolumeCreateHandler },
    { tool: ontapVolumeListTool, handler: ontapVolumeListHandler },
    { tool: ontapVolumeGetTool, handler: ontapVolumeGetHandler },
    { tool: ontapJobGetTool, handler: ontapJobGetHandler },
    { tool: ontapSnapshotCreateTool, handler: ontapSnapshotCreateHandler },
    { tool: ontapSnapshotListTool, handler: ontapSnapshotListHandler },
    { tool: ontapLunCreateTool, handler: ontapLunCreateHandler },
    { tool: ontapLunListTool, handler: ontapLunListHandler },
    { tool: ontapLunGetTool, handler: ontapLunGetHandler },
  ];

  for (const { tool, handler } of ontapTools) {
    mcpServer.registerTool(tool.name, tool, withAuditLog(handler, tool.name));
  }
}

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
import { ToolConfig, ToolHandler, ToolHandlerExtra } from '../types/tool.js';
import { runWithRequestAccessToken } from '../auth/access-token-context.js';
import {
  STDIO_DELEGATED_ACCESS_TOKEN_ARG,
  isDelegatedAccessTokenEnabled,
} from '../auth/delegated-access-token.js';
import { buildToolInputSchema } from '../auth/tool-input-schema.js';

function filterToolInputArgs(
  inputSchema: ToolConfig['inputSchema'],
  args: { [key: string]: any } | undefined
): { [key: string]: any } {
  const filteredArgs: { [key: string]: any } = {};
  for (const key of Object.keys(inputSchema)) {
    if (Object.prototype.hasOwnProperty.call(args ?? {}, key)) {
      filteredArgs[key] = args![key];
    }
  }
  return filteredArgs;
}

function withDeclaredToolInputKeys(tool: ToolConfig, handler: ToolHandler): ToolHandler {
  return async (args: { [key: string]: any }, extra?: ToolHandlerExtra) =>
    handler(filterToolInputArgs(tool.inputSchema, args), extra);
}

function withDelegatedAccessToken(handler: ToolHandler): ToolHandler {
  return async (args: { [key: string]: any }, extra?: ToolHandlerExtra) => {
    const forwardedArgs = { ...(args || {}) };
    delete forwardedArgs[STDIO_DELEGATED_ACCESS_TOKEN_ARG];

    if (!isDelegatedAccessTokenEnabled()) {
      return handler(forwardedArgs, extra);
    }

    const tokenRaw = args?.[STDIO_DELEGATED_ACCESS_TOKEN_ARG];
    const token = typeof tokenRaw === 'string' && tokenRaw.trim() ? tokenRaw.trim() : undefined;
    // Preserve any token already set by the HTTP/SSE transport when no delegated token is provided.
    if (token === undefined) {
      return handler(forwardedArgs, extra);
    }
    return runWithRequestAccessToken(token, () => handler(forwardedArgs, extra));
  };
}

/**
 * Register all tools and their handlers to the tool registry
 */
export function registerAllTools(mcpServer: McpServer) {
  const registerTool = (tool: ToolConfig, handler: ToolHandler) => {
    mcpServer.registerTool(
      tool.name,
      { ...tool, inputSchema: buildToolInputSchema(tool.inputSchema) },
      withDelegatedAccessToken(withDeclaredToolInputKeys(tool, handler))
    );
  };

  // Register storage pool tools
  registerTool(createStoragePoolTool, createStoragePoolHandler);
  registerTool(getStoragePoolTool, getStoragePoolHandler);
  registerTool(listStoragePoolsTool, listStoragePoolsHandler);
  registerTool(updateStoragePoolTool, updateStoragePoolHandler);
  registerTool(validateDirectoryServiceTool, validateDirectoryServiceHandler);

  // Register volume tools
  registerTool(createVolumeTool, createVolumeHandler);
  registerTool(getVolumeTool, getVolumeHandler);
  registerTool(listVolumesTool, listVolumesHandler);
  registerTool(updateVolumeTool, updateVolumeHandler);

  // Register snapshot tools
  registerTool(createSnapshotTool, createSnapshotHandler);
  registerTool(getSnapshotTool, getSnapshotHandler);
  registerTool(listSnapshotsTool, listSnapshotsHandler);
  registerTool(revertVolumeToSnapshotTool, revertVolumeToSnapshotHandler);
  registerTool(updateSnapshotTool, updateSnapshotHandler);

  // Register backup vault tools
  registerTool(createBackupVaultTool, createBackupVaultHandler);
  registerTool(getBackupVaultTool, getBackupVaultHandler);
  registerTool(listBackupVaultsTool, listBackupVaultsHandler);
  registerTool(updateBackupVaultTool, updateBackupVaultHandler);

  // Register backup tools
  registerTool(createBackupTool, createBackupHandler);
  registerTool(getBackupTool, getBackupHandler);
  registerTool(listBackupsTool, listBackupsHandler);
  registerTool(restoreBackupTool, restoreBackupHandler);
  registerTool(restoreBackupFilesTool, restoreBackupFilesHandler);
  registerTool(updateBackupTool, updateBackupHandler);

  // Register operation tools
  registerTool(getOperationTool, getOperationHandler);
  registerTool(cancelOperationTool, cancelOperationHandler);
  registerTool(listOperationsTool, listOperationsHandler);

  // Register backup policy tools
  registerTool(createBackupPolicyTool, backupPolicyHandlers[createBackupPolicyTool.name]);
  registerTool(getBackupPolicyTool, backupPolicyHandlers[getBackupPolicyTool.name]);
  registerTool(listBackupPoliciesTool, backupPolicyHandlers[listBackupPoliciesTool.name]);
  registerTool(updateBackupPolicyTool, backupPolicyHandlers[updateBackupPolicyTool.name]);

  // Register replication tools
  registerTool(createReplicationTool, createReplicationHandler);
  registerTool(getReplicationTool, getReplicationHandler);
  registerTool(listReplicationsTool, listReplicationsHandler);
  registerTool(updateReplicationTool, updateReplicationHandler);
  registerTool(resumeReplicationTool, resumeReplicationHandler);
  registerTool(stopReplicationTool, stopReplicationHandler);
  registerTool(reverseReplicationDirectionTool, reverseReplicationDirectionHandler);
  registerTool(establishPeeringTool, establishPeeringHandler);
  registerTool(syncReplicationTool, syncReplicationHandler);

  // Register active directory tools
  registerTool(createActiveDirectoryTool, createActiveDirectoryHandler);
  registerTool(getActiveDirectoryTool, getActiveDirectoryHandler);
  registerTool(listActiveDirectoriesTool, listActiveDirectoriesHandler);
  registerTool(updateActiveDirectoryTool, updateActiveDirectoryHandler);

  // Register KMS config tools
  registerTool(createKmsConfigTool, createKmsConfigHandler);
  registerTool(getKmsConfigTool, getKmsConfigHandler);
  registerTool(listKmsConfigsTool, listKmsConfigsHandler);
  registerTool(updateKmsConfigTool, updateKmsConfigHandler);
  registerTool(verifyKmsConfigTool, verifyKmsConfigHandler);
  registerTool(encryptVolumesTool, encryptVolumesHandler);

  // Register quota rule tools
  registerTool(createQuotaRuleTool, createQuotaRuleHandler);
  registerTool(getQuotaRuleTool, getQuotaRuleHandler);
  registerTool(listQuotaRulesTool, listQuotaRulesHandler);
  registerTool(updateQuotaRuleTool, updateQuotaRuleHandler);

  // Register host group tools
  registerTool(createHostGroupTool, createHostGroupHandler);
  registerTool(getHostGroupTool, getHostGroupHandler);
  registerTool(listHostGroupsTool, listHostGroupsHandler);
  registerTool(updateHostGroupTool, updateHostGroupHandler);

  // Register ONTAP Expert Mode tools -- audit log control
  registerTool(ontapAuditLogTool, ontapAuditLogHandler);

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
    registerTool(tool, withAuditLog(handler, tool.name));
  }
}

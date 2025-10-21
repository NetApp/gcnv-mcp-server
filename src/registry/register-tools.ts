/**
 * Tool Registration Utility
 * 
 * Registers all tool definitions and their handlers to the tool registry
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  createStoragePoolTool,
  deleteStoragePoolTool,
  getStoragePoolTool,
  listStoragePoolsTool,
  updateStoragePoolTool
} from "../tools/storage-pool-tools.js";
import {
  createStoragePoolHandler,
  deleteStoragePoolHandler,
  getStoragePoolHandler,
  listStoragePoolsHandler,
  updateStoragePoolHandler
} from "../tools/handlers/storage-pool-handler.js";
import {
  createVolumeTool,
  deleteVolumeTool,
  getVolumeTool,
  listVolumesTool,
  updateVolumeTool
} from "../tools/volume-tools.js";
import {
  createVolumeHandler,
  deleteVolumeHandler,
  getVolumeHandler,
  listVolumesHandler,
  updateVolumeHandler
} from "../tools/handlers/volume-handler.js";
import {
  createSnapshotTool,
  deleteSnapshotTool,
  getSnapshotTool,
  listSnapshotsTool,
  revertVolumeToSnapshotTool
} from "../tools/snapshot-tools.js";
import {
  createSnapshotHandler,
  deleteSnapshotHandler,
  getSnapshotHandler,
  listSnapshotsHandler,
  revertVolumeToSnapshotHandler
} from "../tools/handlers/snapshot-handler.js";
import {
  createBackupVaultTool,
  deleteBackupVaultTool,
  getBackupVaultTool,
  listBackupVaultsTool,
  updateBackupVaultTool
} from "../tools/backup-vault-tools.js";
import {
  createBackupVaultHandler,
  deleteBackupVaultHandler,
  getBackupVaultHandler,
  listBackupVaultsHandler,
  updateBackupVaultHandler
} from "../tools/handlers/backup-vault-handler.js";
import {
  createBackupTool,
  deleteBackupTool,
  getBackupTool,
  listBackupsTool,
  restoreBackupTool
} from "../tools/backup-tools.js";
import {
  createBackupHandler,
  deleteBackupHandler,
  getBackupHandler,
  listBackupsHandler,
  restoreBackupHandler
} from "../tools/handlers/backup-handler.js";
import {
  getOperationTool,
  cancelOperationTool,
  listOperationsTool
} from "../tools/operation-tools.js";
import {
  getOperationHandler,
  cancelOperationHandler,
  listOperationsHandler
} from "../tools/handlers/operation-handler.js";
import {
  createBackupPolicyTool,
  deleteBackupPolicyTool,
  getBackupPolicyTool,
  listBackupPoliciesTool,
  updateBackupPolicyTool
} from "../tools/backup-policy-tools.js";
import {
  backupPolicyHandlers
} from "../tools/handlers/backup-policy-handler.js";

/**
 * Register all tools and their handlers to the tool registry
 */
export function registerAllTools(mcpServer: McpServer) {
  // Register storage pool tools
  mcpServer.registerTool(createStoragePoolTool.name, createStoragePoolTool, createStoragePoolHandler);
  mcpServer.registerTool(deleteStoragePoolTool.name, deleteStoragePoolTool, deleteStoragePoolHandler);
  mcpServer.registerTool(getStoragePoolTool.name, getStoragePoolTool, getStoragePoolHandler);
  mcpServer.registerTool(listStoragePoolsTool.name, listStoragePoolsTool, listStoragePoolsHandler);
  mcpServer.registerTool(updateStoragePoolTool.name, updateStoragePoolTool, updateStoragePoolHandler);
  
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
  mcpServer.registerTool(revertVolumeToSnapshotTool.name, revertVolumeToSnapshotTool, revertVolumeToSnapshotHandler);
  
  // Register backup vault tools
  mcpServer.registerTool(createBackupVaultTool.name, createBackupVaultTool, createBackupVaultHandler);
  mcpServer.registerTool(deleteBackupVaultTool.name, deleteBackupVaultTool, deleteBackupVaultHandler);
  mcpServer.registerTool(getBackupVaultTool.name, getBackupVaultTool, getBackupVaultHandler);
  mcpServer.registerTool(listBackupVaultsTool.name, listBackupVaultsTool, listBackupVaultsHandler);
  mcpServer.registerTool(updateBackupVaultTool.name, updateBackupVaultTool, updateBackupVaultHandler);
  
  // Register backup tools
  mcpServer.registerTool(createBackupTool.name, createBackupTool, createBackupHandler);
  mcpServer.registerTool(deleteBackupTool.name, deleteBackupTool, deleteBackupHandler);
  mcpServer.registerTool(getBackupTool.name, getBackupTool, getBackupHandler);
  mcpServer.registerTool(listBackupsTool.name, listBackupsTool, listBackupsHandler);
  mcpServer.registerTool(restoreBackupTool.name, restoreBackupTool, restoreBackupHandler);
  
  // Register operation tools
  mcpServer.registerTool(getOperationTool.name, getOperationTool, getOperationHandler);
  mcpServer.registerTool(cancelOperationTool.name, cancelOperationTool, cancelOperationHandler);
  mcpServer.registerTool(listOperationsTool.name, listOperationsTool, listOperationsHandler);
  
  // Register backup policy tools
  mcpServer.registerTool(createBackupPolicyTool.name, createBackupPolicyTool, backupPolicyHandlers[createBackupPolicyTool.name]);
  mcpServer.registerTool(deleteBackupPolicyTool.name, deleteBackupPolicyTool, backupPolicyHandlers[deleteBackupPolicyTool.name]);
  mcpServer.registerTool(getBackupPolicyTool.name, getBackupPolicyTool, backupPolicyHandlers[getBackupPolicyTool.name]);
  mcpServer.registerTool(listBackupPoliciesTool.name, listBackupPoliciesTool, backupPolicyHandlers[listBackupPoliciesTool.name]);
  mcpServer.registerTool(updateBackupPolicyTool.name, updateBackupPolicyTool, backupPolicyHandlers[updateBackupPolicyTool.name]);
  
}
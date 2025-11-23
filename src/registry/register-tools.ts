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
import {
  createReplicationTool,
  deleteReplicationTool,
  getReplicationTool,
  listReplicationsTool,
  updateReplicationTool,
  resumeReplicationTool,
  stopReplicationTool,
  reverseReplicationDirectionTool
} from "../tools/replication-tools.js";
import {
  createReplicationHandler,
  deleteReplicationHandler,
  getReplicationHandler,
  listReplicationsHandler,
  updateReplicationHandler,
  resumeReplicationHandler,
  stopReplicationHandler,
  reverseReplicationDirectionHandler
} from "../tools/handlers/replication-handler.js";
// Advanced use case tools
import {
  volumeCapacityAnalysisTool,
  storagePoolCapacityPlanningTool,
  resourceCostEstimationTool
} from "../tools/analytics-tools.js";
import {
  volumeCapacityAnalysisHandler,
  storagePoolCapacityPlanningHandler,
  resourceCostEstimationHandler
} from "../tools/handlers/analytics-handler.js";
import {
  advancedVolumeSearchTool,
  findVolumesByExportPolicyTool,
  findVolumesByMountPointTool,
  findResourcesByLabelsTool
} from "../tools/discovery-tools.js";
import {
  advancedVolumeSearchHandler,
  findVolumesByExportPolicyHandler,
  findVolumesByMountPointHandler,
  findResourcesByLabelsHandler
} from "../tools/handlers/discovery-handler.js";
import {
  resourceHealthCheckTool,
  resourcesNeedingAttentionTool,
  operationStatusSummaryTool
} from "../tools/health-tools.js";
import {
  resourceHealthCheckHandler,
  resourcesNeedingAttentionHandler,
  operationStatusSummaryHandler
} from "../tools/handlers/health-handler.js";
import {
  volumeDependencyTreeTool,
  storagePoolResourceInventoryTool,
  backupChainAnalysisTool,
  replicationStatusOverviewTool
} from "../tools/relationship-tools.js";
import {
  volumeDependencyTreeHandler,
  storagePoolResourceInventoryHandler,
  backupChainAnalysisHandler,
  replicationStatusOverviewHandler
} from "../tools/handlers/relationship-handler.js";
import {
  volumeComparisonTool,
  findSimilarVolumesTool,
  storagePoolComparisonTool
} from "../tools/comparison-tools.js";
import {
  volumeComparisonHandler,
  findSimilarVolumesHandler,
  storagePoolComparisonHandler
} from "../tools/handlers/comparison-handler.js";
import {
  optimalStoragePoolRecommendTool,
  backupPolicyRecommendTool,
  resourceCleanupRecommendTool,
  capacityOptimizationRecommendTool
} from "../tools/recommendation-tools.js";
import {
  optimalStoragePoolRecommendHandler,
  backupPolicyRecommendHandler,
  resourceCleanupRecommendHandler,
  capacityOptimizationRecommendHandler
} from "../tools/handlers/recommendation-handler.js";
import {
  labelComplianceCheckTool,
  backupComplianceCheckTool,
  securityComplianceCheckTool
} from "../tools/compliance-tools.js";
import {
  labelComplianceCheckHandler,
  backupComplianceCheckHandler,
  securityComplianceCheckHandler
} from "../tools/handlers/compliance-handler.js";
import {
  resourceSummaryReportTool,
  capacityUtilizationReportTool,
  costAnalysisReportTool
} from "../tools/reporting-tools.js";
import {
  resourceSummaryReportHandler,
  capacityUtilizationReportHandler,
  costAnalysisReportHandler
} from "../tools/handlers/reporting-handler.js";

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
  
  // Register replication tools
  mcpServer.registerTool(createReplicationTool.name, createReplicationTool, createReplicationHandler);
  mcpServer.registerTool(deleteReplicationTool.name, deleteReplicationTool, deleteReplicationHandler);
  mcpServer.registerTool(getReplicationTool.name, getReplicationTool, getReplicationHandler);
  mcpServer.registerTool(listReplicationsTool.name, listReplicationsTool, listReplicationsHandler);
  mcpServer.registerTool(updateReplicationTool.name, updateReplicationTool, updateReplicationHandler);
  mcpServer.registerTool(resumeReplicationTool.name, resumeReplicationTool, resumeReplicationHandler);
  mcpServer.registerTool(stopReplicationTool.name, stopReplicationTool, stopReplicationHandler);
  mcpServer.registerTool(reverseReplicationDirectionTool.name, reverseReplicationDirectionTool, reverseReplicationDirectionHandler);
  
  // Register analytics tools
  mcpServer.registerTool(volumeCapacityAnalysisTool.name, volumeCapacityAnalysisTool, volumeCapacityAnalysisHandler);
  mcpServer.registerTool(storagePoolCapacityPlanningTool.name, storagePoolCapacityPlanningTool, storagePoolCapacityPlanningHandler);
  mcpServer.registerTool(resourceCostEstimationTool.name, resourceCostEstimationTool, resourceCostEstimationHandler);
  
  // Register discovery/search tools
  mcpServer.registerTool(advancedVolumeSearchTool.name, advancedVolumeSearchTool, advancedVolumeSearchHandler);
  mcpServer.registerTool(findVolumesByExportPolicyTool.name, findVolumesByExportPolicyTool, findVolumesByExportPolicyHandler);
  mcpServer.registerTool(findVolumesByMountPointTool.name, findVolumesByMountPointTool, findVolumesByMountPointHandler);
  mcpServer.registerTool(findResourcesByLabelsTool.name, findResourcesByLabelsTool, findResourcesByLabelsHandler);
  
  // Register health monitoring tools
  mcpServer.registerTool(resourceHealthCheckTool.name, resourceHealthCheckTool, resourceHealthCheckHandler);
  mcpServer.registerTool(resourcesNeedingAttentionTool.name, resourcesNeedingAttentionTool, resourcesNeedingAttentionHandler);
  mcpServer.registerTool(operationStatusSummaryTool.name, operationStatusSummaryTool, operationStatusSummaryHandler);
  
  // Register relationship mapping tools
  mcpServer.registerTool(volumeDependencyTreeTool.name, volumeDependencyTreeTool, volumeDependencyTreeHandler);
  mcpServer.registerTool(storagePoolResourceInventoryTool.name, storagePoolResourceInventoryTool, storagePoolResourceInventoryHandler);
  mcpServer.registerTool(backupChainAnalysisTool.name, backupChainAnalysisTool, backupChainAnalysisHandler);
  mcpServer.registerTool(replicationStatusOverviewTool.name, replicationStatusOverviewTool, replicationStatusOverviewHandler);
  
  // Register comparison tools
  mcpServer.registerTool(volumeComparisonTool.name, volumeComparisonTool, volumeComparisonHandler);
  mcpServer.registerTool(findSimilarVolumesTool.name, findSimilarVolumesTool, findSimilarVolumesHandler);
  mcpServer.registerTool(storagePoolComparisonTool.name, storagePoolComparisonTool, storagePoolComparisonHandler);
  
  // Register recommendation tools
  mcpServer.registerTool(optimalStoragePoolRecommendTool.name, optimalStoragePoolRecommendTool, optimalStoragePoolRecommendHandler);
  mcpServer.registerTool(backupPolicyRecommendTool.name, backupPolicyRecommendTool, backupPolicyRecommendHandler);
  mcpServer.registerTool(resourceCleanupRecommendTool.name, resourceCleanupRecommendTool, resourceCleanupRecommendHandler);
  mcpServer.registerTool(capacityOptimizationRecommendTool.name, capacityOptimizationRecommendTool, capacityOptimizationRecommendHandler);
  
  // Register compliance tools
  mcpServer.registerTool(labelComplianceCheckTool.name, labelComplianceCheckTool, labelComplianceCheckHandler);
  mcpServer.registerTool(backupComplianceCheckTool.name, backupComplianceCheckTool, backupComplianceCheckHandler);
  mcpServer.registerTool(securityComplianceCheckTool.name, securityComplianceCheckTool, securityComplianceCheckHandler);
  
  // Register reporting tools
  mcpServer.registerTool(resourceSummaryReportTool.name, resourceSummaryReportTool, resourceSummaryReportHandler);
  mcpServer.registerTool(capacityUtilizationReportTool.name, capacityUtilizationReportTool, capacityUtilizationReportHandler);
  mcpServer.registerTool(costAnalysisReportTool.name, costAnalysisReportTool, costAnalysisReportHandler);
}
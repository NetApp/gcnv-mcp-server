import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Backup Vault Tool
export const createBackupVaultTool: ToolConfig = {
  name: 'gcnv_backup_vault_create',
  title: 'Create Backup Vault',
  description: 'Creates a new backup vault in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the backup vault should be created'),
    backupVaultId: z.string().describe('The ID to assign to the backup vault'),
    description: z.string().optional().describe('Optional description of the backup vault'),
    backupRetentionPolicy: z
      .object({
        backupMinimumEnforcedRetentionDays: z
          .number()
          .optional()
          .describe('The minimum enforced retention days for backups'),
        dailyBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether daily backups are immutable'),
        weeklyBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether weekly backups are immutable'),
        monthlyBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether monthly backups are immutable'),
        manualBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether manual backups are immutable'),
      })
      .optional()
      .describe('Backup retention policy, including immutability flags'),
    labels: z
      .record(z.string())
      .optional()
      .describe('Optional labels to apply to the backup vault'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created backup vault'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the backup vault'),
  },
};

// Delete Backup Vault Tool
export const deleteBackupVaultTool: ToolConfig = {
  name: 'gcnv_backup_vault_delete',
  title: 'Delete Backup Vault',
  description: 'Deletes a backup vault in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup vault'),
    backupVaultId: z.string().describe('The ID of the backup vault to delete'),
    force: z.boolean().optional().describe('Force deletion even if the vault contains backups'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Backup Vault Tool
export const getBackupVaultTool: ToolConfig = {
  name: 'gcnv_backup_vault_get',
  title: 'Get Backup Vault',
  description: 'Gets details of a specific backup vault',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup vault'),
    backupVaultId: z.string().describe('The ID of the backup vault to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the backup vault'),
    backupVaultId: z.string().describe('The ID of the backup vault to retrieve'),
    backupVaultType: z.string().describe('The type of the backup vault'),
    sourceRegion: z.string().optional().describe('The source region of the backup vault'),
    backupRegion: z.string().optional().describe('The backup region of the backup vault'),
    sourceBackupVault: z
      .string()
      .optional()
      .describe('The source backup vault for cross-region backups'),
    destinationBackupVault: z
      .string()
      .optional()
      .describe('The destination backup vault for cross-region backups'),
    backupRetentionPolicy: z
      .object({
        backupMinimumEnforcedRetentionDays: z
          .number()
          .describe('The minimum enforced retention days for backups'),
        dailyBackupImmutable: z.boolean().describe('Whether daily backups are immutable'),
        weeklyBackupImmutable: z.boolean().describe('Whether weekly backups are immutable'),
        monthlyBackupImmutable: z.boolean().describe('Whether monthly backups are immutable'),
        manualBackupImmutable: z.boolean().describe('Whether manual backups are immutable'),
      })
      .optional()
      .describe('The backup retention policy of the backup vault'),
    state: z.string().describe('The current state of the backup vault'),
    createTime: z.date().describe('The creation time of the backup vault'),
    description: z.string().optional().describe('Description of the backup vault'),
    labels: z.record(z.string()).optional().describe('Labels applied to the backup vault'),
  },
};

// List Backup Vaults Tool
export const listBackupVaultsTool: ToolConfig = {
  name: 'gcnv_backup_vault_list',
  title: 'List Backup Vaults',
  description:
    'Lists backup vaults in a specific project and location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list backup vaults from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('Maximum number of backup vaults to return per page'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    backupVaults: z
      .array(
        z.object({
          name: z.string().describe('The fully qualified name of the backup vault'),
          backupVaultId: z.string().describe('The ID of the backup vault to retrieve'),
          backupVaultType: z.string().describe('The type of the backup vault'),
          sourceRegion: z.string().optional().describe('The source region of the backup vault'),
          backupRegion: z.string().optional().describe('The backup region of the backup vault'),
          sourceBackupVault: z
            .string()
            .optional()
            .describe('The source backup vault for cross-region backups'),
          destinationBackupVault: z
            .string()
            .optional()
            .describe('The destination backup vault for cross-region backups'),
          backupRetentionPolicy: z
            .object({
              backupMinimumEnforcedRetentionDays: z
                .number()
                .describe('The minimum enforced retention days for backups'),
              dailyBackupImmutable: z.boolean().describe('Whether daily backups are immutable'),
              weeklyBackupImmutable: z.boolean().describe('Whether weekly backups are immutable'),
              monthlyBackupImmutable: z.boolean().describe('Whether monthly backups are immutable'),
              manualBackupImmutable: z.boolean().describe('Whether manual backups are immutable'),
            })
            .optional()
            .describe('The backup retention policy of the backup vault'),
          state: z.string().describe('The current state of the backup vault'),
          createTime: z.date().describe('The creation time of the backup vault'),
          description: z.string().optional().describe('Description of the backup vault'),
          labels: z.record(z.string()).optional().describe('Labels applied to the backup vault'),
        })
      )
      .describe('List of backup vaults'),
    nextPageToken: z.string().optional().describe('Token for fetching the next page'),
  },
};

// Update Backup Vault Tool
export const updateBackupVaultTool: ToolConfig = {
  name: 'gcnv_backup_vault_update',
  title: 'Update Backup Vault',
  description: 'Updates the properties of an existing backup vault',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup vault'),
    backupVaultId: z.string().describe('The ID of the backup vault to update'),
    description: z.string().optional().describe('New description for the backup vault'),
    backupRetentionPolicy: z
      .object({
        backupMinimumEnforcedRetentionDays: z
          .number()
          .optional()
          .describe('The minimum enforced retention days for backups'),
        dailyBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether daily backups are immutable'),
        weeklyBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether weekly backups are immutable'),
        monthlyBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether monthly backups are immutable'),
        manualBackupImmutable: z
          .boolean()
          .optional()
          .describe('Whether manual backups are immutable'),
      })
      .optional()
      .describe('Backup retention policy, including immutability flags'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the backup vault'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the updated backup vault'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

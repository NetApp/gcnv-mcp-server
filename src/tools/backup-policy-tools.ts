import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Backup Policy Tool
export const createBackupPolicyTool: ToolConfig = {
  name: 'gcnv_backup_policy_create',
  title: 'Create Backup Policy',
  description: 'Creates a new backup policy in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the backup policy should be created'),
    backupPolicyId: z.string().describe('The ID to assign to the backup policy'),
    dailyBackupLimit: z.number().optional().describe('Maximum number of daily backups to keep'),
    weeklyBackupLimit: z.number().optional().describe('Maximum number of weekly backups to keep'),
    monthlyBackupLimit: z.number().optional().describe('Maximum number of monthly backups to keep'),
    description: z.string().optional().describe('Optional description of the backup policy'),
    enabled: z.boolean().optional().describe('Whether the backup policy is enabled'),
    labels: z
      .record(z.string())
      .optional()
      .describe('Optional labels to apply to the backup policy'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created backup policy'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the backup policy'),
  },
};

// Delete Backup Policy Tool
export const deleteBackupPolicyTool: ToolConfig = {
  name: 'gcnv_backup_policy_delete',
  title: 'Delete Backup Policy',
  description: 'Deletes a backup policy in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup policy'),
    backupPolicyId: z.string().describe('The ID of the backup policy to delete'),
    force: z
      .boolean()
      .optional()
      .describe('Force deletion even if the policy is assigned to volumes'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Backup Policy Tool
export const getBackupPolicyTool: ToolConfig = {
  name: 'gcnv_backup_policy_get',
  title: 'Get Backup Policy',
  description: 'Gets details of a specific backup policy',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup policy'),
    backupPolicyId: z.string().describe('The ID of the backup policy to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the backup policy'),
    backupPolicyId: z.string().describe('The ID of the backup policy'),
    dailyBackupLimit: z.number().optional().describe('Maximum number of daily backups to keep'),
    weeklyBackupLimit: z.number().optional().describe('Maximum number of weekly backups to keep'),
    monthlyBackupLimit: z.number().optional().describe('Maximum number of monthly backups to keep'),
    description: z.string().optional().describe('Description of the backup policy'),
    enabled: z.boolean().describe('Whether the backup policy is enabled'),
    assignedVolumeCount: z
      .number()
      .optional()
      .describe('Number of volumes assigned to this policy'),
    state: z.string().describe('The current state of the backup policy'),
    createTime: z.date().describe('The creation time of the backup policy'),
    labels: z.record(z.string()).optional().describe('Labels applied to the backup policy'),
  },
};

// List Backup Policies Tool
export const listBackupPoliciesTool: ToolConfig = {
  name: 'gcnv_backup_policy_list',
  title: 'List Backup Policies',
  description:
    'Lists backup policies in a specific project and location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list backup policies from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z
      .number()
      .optional()
      .describe('Maximum number of backup policies to return per page'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    backupPolicies: z
      .array(
        z.object({
          name: z.string().describe('The fully qualified name of the backup policy'),
          backupPolicyId: z.string().describe('The ID of the backup policy'),
          dailyBackupLimit: z
            .number()
            .optional()
            .describe('Maximum number of daily backups to keep'),
          weeklyBackupLimit: z
            .number()
            .optional()
            .describe('Maximum number of weekly backups to keep'),
          monthlyBackupLimit: z
            .number()
            .optional()
            .describe('Maximum number of monthly backups to keep'),
          description: z.string().optional().describe('Description of the backup policy'),
          enabled: z.boolean().describe('Whether the backup policy is enabled'),
          assignedVolumeCount: z
            .number()
            .optional()
            .describe('Number of volumes assigned to this policy'),
          state: z.string().describe('The current state of the backup policy'),
          createTime: z.date().optional().describe('The creation time of the backup policy'),
          labels: z.record(z.string()).optional().describe('Labels applied to the backup policy'),
        })
      )
      .describe('List of backup policies'),
    nextPageToken: z.string().optional().describe('Token for fetching the next page'),
  },
};

// Update Backup Policy Tool
export const updateBackupPolicyTool: ToolConfig = {
  name: 'gcnv_backup_policy_update',
  title: 'Update Backup Policy',
  description: 'Updates the properties of an existing backup policy',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup policy'),
    backupPolicyId: z.string().describe('The ID of the backup policy to update'),
    dailyBackupLimit: z.number().optional().describe('Maximum number of daily backups to keep'),
    weeklyBackupLimit: z.number().optional().describe('Maximum number of weekly backups to keep'),
    monthlyBackupLimit: z.number().optional().describe('Maximum number of monthly backups to keep'),
    description: z.string().optional().describe('New description for the backup policy'),
    enabled: z.boolean().optional().describe('Whether the backup policy is enabled'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the backup policy'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the updated backup policy'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

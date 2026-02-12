import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Backup Tool
export const createBackupTool: ToolConfig = {
  name: 'gcnv_backup_create',
  title: 'Create Backup',
  description: 'Creates a new backup of a volume in the specified backup vault',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the backup should be created'),
    backupVaultId: z.string().describe('The ID of the backup vault to store the backup'),
    backupId: z.string().describe('The ID to assign to the backup'),
    backupRegion: z.string().optional().describe('The region where the backup will be stored'),
    sourceVolumeName: z
      .string()
      .optional()
      .describe(
        'The full name of the volume to back up (projects/{project}/locations/{location}/storagePools/{storage_pool}/volumes/{volume}). Provide either sourceVolumeName or sourceSnapshotName.'
      ),
    sourceSnapshotName: z
      .string()
      .optional()
      .describe(
        'The full name of the snapshot to back up (projects/{project}/locations/{location}/volumes/{volume}/snapshots/{snapshot}). Provide either sourceVolumeName or sourceSnapshotName.'
      ),
    description: z.string().optional().describe('Optional description of the backup'),
    labels: z.record(z.string()).optional().describe('Optional labels to apply to the backup'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created backup'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the backup'),
  },
};

// Delete Backup Tool
export const deleteBackupTool: ToolConfig = {
  name: 'gcnv_backup_delete',
  title: 'Delete Backup',
  description: 'Deletes a backup from the specified backup vault',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Backup Tool
export const getBackupTool: ToolConfig = {
  name: 'gcnv_backup_get',
  title: 'Get Backup',
  description: 'Gets details of a specific backup',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the backup'),
    backupId: z.string().describe('The ID of the backup'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    state: z.string().describe('The current state of the backup'),
    description: z.string().optional().describe('Description of the backup'),
    volumeUsagebytes: z.number().optional().describe('The size of the volume in bytes'),
    backupType: z.string().optional().describe('The type of the backup'),
    sourceVolume: z.string().describe('The name of the source volume'),
    createTime: z.date().optional().describe('The creation time of the backup'),
    chainStoragebytes: z.number().optional().describe('The size of the backup chain in bytes'),
    satisfiesPzs: z.boolean().optional().describe('Whether the backup satisfies PZS requirements'),
    satisfiesPzi: z.boolean().optional().describe('Whether the backup satisfies PZI requirements'),
    volumeRegion: z.string().optional().describe('The region of the source volume'),
    backupRegion: z.string().optional().describe('The region where the backup is stored'),
    enforcedRetentionEndTime: z
      .number()
      .optional()
      .describe('The number of days the backup is retained'),
    sourceSnapshot: z
      .string()
      .optional()
      .describe('The name of the source snapshot if the backup was created from a snapshot'),
    labels: z.record(z.string()).optional().describe('Labels applied to the backup'),
  },
};

// List Backups Tool
export const listBackupsTool: ToolConfig = {
  name: 'gcnv_backup_list',
  title: 'List Backups',
  description: 'Lists backups in a specific backup vault (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list backups from; omit or use "-" for all locations'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backups'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('Maximum number of backups to return per page'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    backups: z
      .array(
        z.object({
          name: z.string().describe('The fully qualified name of the backup'),
          backupId: z.string().describe('The ID of the backup'),
          backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
          state: z.string().describe('The current state of the backup'),
          description: z.string().optional().describe('Description of the backup'),
          volumeUsagebytes: z.number().optional().describe('The size of the volume in bytes'),
          backupType: z.string().optional().describe('The type of the backup'),
          sourceVolume: z.string().describe('The name of the source volume'),
          createTime: z.date().optional().describe('The creation time of the backup'),
          chainStoragebytes: z
            .number()
            .optional()
            .describe('The size of the backup chain in bytes'),
          satisfiesPzs: z
            .boolean()
            .optional()
            .describe('Whether the backup satisfies PZS requirements'),
          satisfiesPzi: z
            .boolean()
            .optional()
            .describe('Whether the backup satisfies PZI requirements'),
          volumeRegion: z.string().optional().describe('The region of the source volume'),
          backupRegion: z.string().optional().describe('The region where the backup is stored'),
          enforcedRetentionEndTime: z
            .number()
            .optional()
            .describe('The number of days the backup is retained'),
          sourceSnapshot: z
            .string()
            .optional()
            .describe('The name of the source snapshot if the backup was created from a snapshot'),
          labels: z.record(z.string()).optional().describe('Labels applied to the backup'),
        })
      )
      .describe('List of backups'),
    nextPageToken: z.string().optional().describe('Token for fetching the next page'),
  },
};

// Restore Backup Tool
export const restoreBackupTool: ToolConfig = {
  name: 'gcnv_backup_restore',
  title: 'Restore Backup',
  description: 'Restores a backup to a new or existing volume',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to restore'),
    targetStoragePoolId: z.string().describe('The ID of the storage pool to restore to'),
    targetVolumeId: z.string().describe('The ID of the target volume to create or overwrite'),
    restoreOption: z
      .enum(['CREATE_NEW_VOLUME', 'OVERWRITE_EXISTING_VOLUME'])
      .describe('Whether to create a new volume or overwrite an existing one'),
  },
  outputSchema: {
    name: z.string().describe('The name of the target volume'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for restoring the backup'),
  },
};

// Restore Backup Files Tool
export const restoreBackupFilesTool: ToolConfig = {
  name: 'gcnv_backup_restore_files',
  title: 'Restore Backup Files',
  description: 'Restores specific files from a backup into a destination volume',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup and destination volume'),
    volumeId: z
      .string()
      .describe(
        'The destination volume ID (volume resource name is projects/{project}/locations/{location}/volumes/{volumeId})'
      ),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to restore files from'),
    fileList: z
      .array(z.string())
      .min(1)
      .describe(
        'List of files to restore, specified by their absolute path in the source volume (e.g. /dir/file.txt)'
      ),
    restoreDestinationPath: z
      .string()
      .optional()
      .describe(
        'Absolute directory path in the destination volume where files should be restored (required when fileList is provided)'
      ),
  },
  outputSchema: {
    name: z.string().describe('The destination volume resource name'),
    operationId: z.string().describe('The ID of the long-running operation for restoring files'),
  },
};

// Update Backup Tool
export const updateBackupTool: ToolConfig = {
  name: 'gcnv_backup_update',
  title: 'Update Backup',
  description: 'Updates a backup with full spec',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to update'),
    description: z.string().optional().describe('New description of the backup'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the backup'),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated backup'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for updating the backup'),
  },
};

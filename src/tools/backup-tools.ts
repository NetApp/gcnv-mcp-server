import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

const ontapSourceOutputSchema = z
  .object({
    storagePool: z.string().optional().describe('ONTAP-mode storage pool resource name'),
    volumeUuid: z.string().optional().describe('UUID of the ONTAP source volume'),
    snapshotUuid: z.string().optional().describe('UUID of the ONTAP source snapshot'),
  })
  .optional()
  .describe('Source details for backups of ONTAP-mode volumes');

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
        'The full name of the volume to back up (projects/{project}/locations/{location}/storagePools/{storage_pool}/volumes/{volume}). Provide exactly one source: sourceVolumeName, sourceSnapshotName, or ontapStoragePool + ontapVolumeUuid.'
      ),
    sourceSnapshotName: z
      .string()
      .optional()
      .describe(
        'The full name of the snapshot to back up (projects/{project}/locations/{location}/volumes/{volume}/snapshots/{snapshot}). Provide exactly one source: sourceVolumeName, sourceSnapshotName, or ontapStoragePool + ontapVolumeUuid.'
      ),
    ontapStoragePool: z
      .string()
      .optional()
      .describe(
        'ONTAP-mode only. Storage pool ID or full resource name (projects/{project}/locations/{location}/storagePools/{pool}). An ID is resolved under `location`; pass the full name when the pool location differs from the vault location (e.g. zonal pool, regional vault). Requires ontapVolumeUuid.'
      ),
    ontapVolumeUuid: z
      .string()
      .optional()
      .describe(
        'ONTAP-mode only. UUID of the ONTAP volume to back up (from ontap_volume_list). Requires ontapStoragePool.'
      ),
    ontapSnapshotUuid: z
      .string()
      .optional()
      .describe(
        'ONTAP-mode only. Optional UUID of an ONTAP snapshot to back up instead of the current volume state.'
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
    volumeUsagebytes: z.string().optional().describe('The size of the volume in bytes'),
    backupType: z.string().optional().describe('The type of the backup'),
    sourceVolume: z
      .string()
      .optional()
      .describe('The name of the source volume (absent for ONTAP-mode backups)'),
    ontapSource: ontapSourceOutputSchema,
    createTime: z.string().optional().describe('The creation time of the backup'),
    chainStoragebytes: z.string().optional().describe('The size of the backup chain in bytes'),
    satisfiesPzs: z.boolean().optional().describe('Whether the backup satisfies PZS requirements'),
    satisfiesPzi: z.boolean().optional().describe('Whether the backup satisfies PZI requirements'),
    volumeRegion: z.string().optional().describe('The region of the source volume'),
    backupRegion: z.string().optional().describe('The region where the backup is stored'),
    enforcedRetentionEndTime: z
      .string()
      .optional()
      .describe('The time until which the backup is not deletable (ISO 8601)'),
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
          volumeUsagebytes: z.string().optional().describe('The size of the volume in bytes'),
          backupType: z.string().optional().describe('The type of the backup'),
          sourceVolume: z
            .string()
            .optional()
            .describe('The name of the source volume (absent for ONTAP-mode backups)'),
          ontapSource: ontapSourceOutputSchema,
          createTime: z.string().optional().describe('The creation time of the backup'),
          chainStoragebytes: z
            .string()
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
            .string()
            .optional()
            .describe('The time until which the backup is not deletable (ISO 8601)'),
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
  description:
    'Creates a new volume from a backup (full restore) using volumes.create with restoreParameters.sourceBackup. For selective/single-file restore use gcnv_backup_restore_files instead.',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the backup'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to restore'),
    targetStoragePoolId: z.string().describe('The ID of the storage pool to restore to'),
    targetVolumeId: z.string().describe('The ID of the new volume to create from the backup'),
    capacityGib: z
      .number()
      .describe(
        'The capacity of the new volume in GiB. Must be larger than the backup volume usage size (docs recommend at least 20% larger).'
      ),
    protocols: z
      .array(z.enum(['NFSV3', 'NFSV4', 'SMB', 'ISCSI']))
      .min(1)
      .describe(
        'The protocols to enable on the new volume. Use the same protocols as the source volume.'
      ),
    hostGroups: z
      .array(z.string())
      .min(1)
      .optional()
      .describe(
        'Host group IDs or fully-qualified resource names to attach to iSCSI block device(s) (e.g. "hg1" or "projects/.../locations/.../hostGroups/hg1"). Required when protocols includes ISCSI.'
      ),
    hostGroup: z
      .string()
      .optional()
      .describe(
        'Single host group ID or fully-qualified resource name (shorthand for hostGroups=[...]).'
      ),
    blockDevice: z
      .object({
        identifier: z
          .string()
          .optional()
          .describe('Optional block device identifier (defaults to "<targetVolumeId>-lun0")'),
        osType: z
          .union([
            z.enum(['OS_TYPE_UNSPECIFIED', 'LINUX', 'WINDOWS', 'ESXI']),
            z.enum(['os_type_unspecified', 'linux', 'windows', 'esxi']),
            z.number(),
          ])
          .optional()
          .describe('Optional OS type for the iSCSI block device'),
      })
      .optional()
      .describe('iSCSI block device configuration (used when protocols includes ISCSI)'),
    shareName: z
      .string()
      .optional()
      .describe('Share name for the new volume. Defaults to targetVolumeId.'),
    description: z.string().optional().describe('Optional description for the new volume'),
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

// List ONTAP-mode Volume Backup Configs Tool
export const listStoragePoolBackupConfigsTool: ToolConfig = {
  name: 'gcnv_storage_pool_backup_config_list',
  title: 'List ONTAP-mode Backup Configs',
  description:
    'Lists the backup configuration (vault, policies, scheduled backups) of every volume in an ONTAP-mode storage pool',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the ONTAP-mode storage pool'),
    storagePoolId: z.string().describe('The ID of the ONTAP-mode storage pool'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('Maximum number of configs to return per page'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    volumeBackupConfigs: z
      .array(
        z.object({
          volumeUuid: z.string().describe('UUID of the ONTAP volume'),
          backupVault: z.string().optional().describe('Backup vault resource name'),
          backupPolicies: z.array(z.string()).describe('Attached backup policy resource names'),
          scheduledBackupEnabled: z
            .boolean()
            .optional()
            .describe('Whether scheduled backups are enabled'),
          backupChainBytes: z
            .string()
            .optional()
            .describe('Total size of the backup chain in bytes'),
        })
      )
      .describe('Backup configuration per ONTAP volume'),
    nextPageToken: z.string().optional().describe('Token for fetching the next page'),
  },
};

// Update ONTAP-mode Volume Backup Config Tool
export const updateStoragePoolBackupConfigTool: ToolConfig = {
  name: 'gcnv_storage_pool_backup_config_update',
  title: 'Update ONTAP-mode Backup Config',
  description:
    'Assigns, changes, pauses, resumes, or unassigns the backup vault and backup policy of an ONTAP-mode volume (identified by UUID). Only the provided fields are updated.',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the ONTAP-mode storage pool'),
    storagePoolId: z.string().describe('The ID of the ONTAP-mode storage pool'),
    volumeUuid: z.string().describe('UUID of the ONTAP volume (from ontap_volume_list)'),
    backupVault: z
      .string()
      .optional()
      .describe(
        'Backup vault resource name (projects/{project}/locations/{location}/backupVaults/{vault})'
      ),
    backupPolicies: z
      .array(z.string())
      .optional()
      .describe(
        'Backup policy resource names (projects/{project}/locations/{location}/backupPolicies/{policy}). Pass an empty array to unassign the policy.'
      ),
    scheduledBackupEnabled: z
      .boolean()
      .optional()
      .describe('true to enable (resume) scheduled backups, false to pause them'),
  },
  outputSchema: {
    name: z.string().describe('The storage pool resource name'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for updating the backup config'),
  },
};

// Restore Backup to ONTAP-mode Volume Tool
export const restoreStoragePoolVolumeTool: ToolConfig = {
  name: 'gcnv_storage_pool_restore_volume',
  title: 'Restore Backup to ONTAP-mode Volume',
  description:
    'Restores a backup into an existing ONTAP-mode volume (identified by UUID). Omit fileList for a full restore (target must be a DP-type volume created through ONTAP); provide fileList for a selective file restore.',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the ONTAP-mode storage pool'),
    storagePoolId: z.string().describe('The ID of the ONTAP-mode storage pool'),
    backupVaultId: z.string().describe('The ID of the backup vault containing the backup'),
    backupId: z.string().describe('The ID of the backup to restore'),
    backupLocation: z
      .string()
      .optional()
      .describe('The location of the backup vault; defaults to `location`'),
    volumeUuid: z.string().describe('UUID of the target ONTAP volume (from ontap_volume_list)'),
    fileList: z
      .array(z.string().startsWith('/', 'fileList paths must be absolute (start with /)'))
      .min(1)
      .optional()
      .describe('Absolute source paths of files to restore. Omit for a full restore.'),
    restoreDestinationPath: z
      .string()
      .startsWith('/', 'restoreDestinationPath must be absolute (start with /)')
      .optional()
      .describe('Absolute directory path in the target volume (for selective file restore)'),
  },
  outputSchema: {
    name: z.string().describe('The storage pool resource name'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for restoring the backup'),
  },
};

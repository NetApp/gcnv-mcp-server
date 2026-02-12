import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Volume Tool
export const createVolumeTool: ToolConfig = {
  name: 'gcnv_volume_create',
  title: 'Create Volume',
  description: 'Creates a new volume in the specified storage pool',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the volume should be created'),
    storagePoolId: z.string().describe('The ID of the storage pool to create the volume in'),
    volumeId: z.string().describe('The ID to assign to the volume'),
    capacityGib: z.number().describe('The capacity of the volume in GiB'),
    protocols: z
      .array(z.enum(['NFSV3', 'NFSV4', 'SMB', 'ISCSI']))
      .describe('The protocols to enable. Supported values: NFSV3, NFSV4, SMB, ISCSI.'),
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
          .describe('Optional block device identifier (defaults to "<volumeId>-lun0")'),
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
    description: z.string().optional().describe('Optional description of the volume'),
    shareName: z.string().optional().describe('Optional name of the file share'),
    labels: z.record(z.string()).optional().describe('Optional labels to apply to the volume'),
    backupConfig: z
      .object({
        backupPolicies: z
          .array(z.string())
          .optional()
          .describe('Backup policy resource names (projects/.../backupPolicies/ID)'),
        backupVault: z
          .string()
          .optional()
          .describe('Backup vault resource name (projects/.../backupVaults/ID)'),
        scheduledBackupEnabled: z.boolean().optional().describe('Enable scheduled backups'),
      })
      .optional()
      .describe('Backup configuration'),
    snapshotPolicy: z
      .object({
        enabled: z.boolean().optional().describe('Enable scheduled snapshots for this volume'),
        hourlySchedule: z
          .object({
            snapshotsToKeep: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('Number of hourly snapshots to retain'),
            minute: z
              .number()
              .int()
              .min(0)
              .max(59)
              .optional()
              .describe('Minute of the hour to take the snapshot (0-59)'),
          })
          .optional()
          .describe('Hourly snapshot schedule'),
        dailySchedule: z
          .object({
            snapshotsToKeep: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('Number of daily snapshots to retain'),
            minute: z
              .number()
              .int()
              .min(0)
              .max(59)
              .optional()
              .describe('Minute of the hour to take the snapshot (0-59)'),
            hour: z
              .number()
              .int()
              .min(0)
              .max(23)
              .optional()
              .describe('Hour of the day to take the snapshot (0-23)'),
          })
          .optional()
          .describe('Daily snapshot schedule'),
        weeklySchedule: z
          .object({
            snapshotsToKeep: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('Number of weekly snapshots to retain'),
            minute: z
              .number()
              .int()
              .min(0)
              .max(59)
              .optional()
              .describe('Minute of the hour to take the snapshot (0-59)'),
            hour: z
              .number()
              .int()
              .min(0)
              .max(23)
              .optional()
              .describe('Hour of the day to take the snapshot (0-23)'),
            day: z
              .string()
              .optional()
              .describe('Day of the week to take the snapshot (API expects a string)'),
          })
          .optional()
          .describe('Weekly snapshot schedule'),
        monthlySchedule: z
          .object({
            snapshotsToKeep: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('Number of monthly snapshots to retain'),
            minute: z
              .number()
              .int()
              .min(0)
              .max(59)
              .optional()
              .describe('Minute of the hour to take the snapshot (0-59)'),
            hour: z
              .number()
              .int()
              .min(0)
              .max(23)
              .optional()
              .describe('Hour of the day to take the snapshot (0-23)'),
            daysOfMonth: z
              .string()
              .optional()
              .describe('Days of month to take the snapshot (API expects a string)'),
          })
          .optional()
          .describe('Monthly snapshot schedule'),
      })
      .optional()
      .describe('Snapshot scheduling policy for the volume'),
    tieringPolicy: z
      .object({
        tierAction: z
          .enum(['TIER_ACTION_UNSPECIFIED', 'ENABLED', 'PAUSED'])
          .optional()
          .describe('Auto-tiering action (ENABLED/PAUSED)'),
        coolingThresholdDays: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Cooling threshold in days before data is tiered'),
        hotTierBypassModeEnabled: z
          .boolean()
          .optional()
          .describe('Whether hot tier bypass mode is enabled'),
      })
      .optional()
      .describe('Tiering policy (auto-tiering) for the volume'),
    hybridReplicationParameters: z
      .object({
        replication: z.string().optional().describe('Hybrid replication resource name/reference'),
        peerVolumeName: z.string().optional().describe('Peer volume name'),
        peerClusterName: z.string().optional().describe('Peer cluster name'),
        peerSvmName: z.string().optional().describe('Peer SVM name'),
        peerIpAddresses: z
          .array(z.string())
          .optional()
          .describe('Peer IP addresses for hybrid replication'),
        clusterLocation: z.string().optional().describe('Cluster location'),
        description: z.string().optional().describe('Description'),
        labels: z.record(z.string()).optional().describe('Labels'),
        replicationSchedule: z
          .enum(['HYBRID_REPLICATION_SCHEDULE_UNSPECIFIED', 'EVERY_10_MINUTES', 'HOURLY', 'DAILY'])
          .optional()
          .describe('Replication schedule'),
        hybridReplicationType: z
          .enum([
            'VOLUME_HYBRID_REPLICATION_TYPE_UNSPECIFIED',
            'MIGRATION',
            'CONTINUOUS_REPLICATION',
            'ONPREM_REPLICATION',
            'REVERSE_ONPREM_REPLICATION',
          ])
          .optional()
          .describe('Hybrid replication type'),
        largeVolumeConstituentCount: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Large volume constituent count'),
      })
      .optional()
      .describe('Hybrid replication parameters for the volume'),
    exportPolicy: z
      .object({
        rules: z
          .array(
            z.object({
              allowedClients: z.string().describe('CIDR range of client IPs to allow'),
              accessType: z
                .enum(['READ_ONLY', 'READ_WRITE'])
                .optional()
                .describe('Access permission type'),
              nfsv3: z.boolean().optional().describe('Whether NFSv3 is allowed'),
              nfsv4: z.boolean().optional().describe('Whether NFSv4 is allowed'),
              hasRootAccess: z.boolean().optional().describe('Whether root access is allowed'),
              nfsOptions: z
                .object({
                  rootSquash: z.boolean().optional().describe('Whether to enable root squashing'),
                  anon: z.string().optional().describe('Anonymous user ID for mapped root user'),
                })
                .optional()
                .describe('NFS-specific options'),
              kerberos5ReadOnly: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5 is required for read-only operations'),
              kerberos5ReadWrite: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5 is required for read-write operations'),
              kerberos5iReadOnly: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5i is required for read-only operations'),
              kerberos5iReadWrite: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5i is required for read-write operations'),
              kerberos5pReadOnly: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5p is required for read-only operations'),
              kerberos5pReadWrite: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5p is required for read-write operations'),
            })
          )
          .describe('List of export policy rules'),
      })
      .optional()
      .describe('NFS export policy configuration'),
    throughputMibps: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Manual QoS throughput limit for the volume in MiBps (only applicable when the storage pool uses qosType MANUAL)'
      ),
    largeCapacity: z
      .boolean()
      .optional()
      .describe(
        'Enable Large Capacity Volume mode (Premium/Extreme only). Requires capacityGib >= 15360 (15 TiB).'
      ),
    multipleEndpoints: z
      .boolean()
      .optional()
      .describe(
        'Use multiple storage endpoints for Large Capacity Volumes (only valid when largeCapacity is true).'
      ),
  },
  outputSchema: {
    name: z.string().describe('The name of the created volume'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the volume'),
  },
};

// Delete Volume Tool
export const deleteVolumeTool: ToolConfig = {
  name: 'gcnv_volume_delete',
  title: 'Delete Volume',
  description: 'Deletes a volume in the specified storage pool',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume to delete'),
    force: z.boolean().optional().describe('Force deletion even if the volume has snapshots'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Volume Tool
export const getVolumeTool: ToolConfig = {
  name: 'gcnv_volume_get',
  title: 'Get Volume',
  description: 'Gets details of a specific volume',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume to retrieve'),
  },
  // Allow any additional fields from the API
  outputSchema: {
    volume: z.record(z.any()).describe('Volume details'),
  },
};

// List Volumes Tool
export const listVolumesTool: ToolConfig = {
  name: 'gcnv_volume_list',
  title: 'List Volumes',
  description: 'Lists all volumes in the specified storage pool (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list volumes from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('The maximum number of volumes to return'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    volumes: z.array(z.record(z.any())).describe('List of volumes'),
    nextPageToken: z.string().optional().describe('Token to retrieve the next page of results'),
  },
};

// Update Volume Tool
export const updateVolumeTool: ToolConfig = {
  name: 'gcnv_volume_update',
  title: 'Update Volume',
  description: 'Updates a volume in the specified storage pool',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume to update'),
    capacityGib: z.number().optional().describe('The new capacity of the volume in GiB'),
    description: z.string().optional().describe('New description of the volume'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the volume'),
    backupConfig: z
      .object({
        backupPolicies: z
          .array(z.string())
          .describe('Backup policy resource names (projects/.../backupPolicies/ID)'),
        backupVault: z
          .string()
          .describe('Backup vault resource name (projects/.../backupVaults/ID)'),
        scheduledBackupEnabled: z.boolean().describe('Enable scheduled backups'),
      })
      .optional()
      .describe('Backup configuration'),
    tieringPolicy: z
      .object({
        tierAction: z
          .enum(['TIER_ACTION_UNSPECIFIED', 'ENABLED', 'PAUSED'])
          .optional()
          .describe('Auto-tiering action (ENABLED/PAUSED)'),
        coolingThresholdDays: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Cooling threshold in days before data is tiered'),
        hotTierBypassModeEnabled: z
          .boolean()
          .optional()
          .describe('Whether hot tier bypass mode is enabled'),
      })
      .optional()
      .describe('Tiering policy (auto-tiering) for the volume'),
    hybridReplicationParameters: z
      .object({
        replication: z.string().optional().describe('Hybrid replication resource name/reference'),
        peerVolumeName: z.string().optional().describe('Peer volume name'),
        peerClusterName: z.string().optional().describe('Peer cluster name'),
        peerSvmName: z.string().optional().describe('Peer SVM name'),
        peerIpAddresses: z
          .array(z.string())
          .optional()
          .describe('Peer IP addresses for hybrid replication'),
        clusterLocation: z.string().optional().describe('Cluster location'),
        description: z.string().optional().describe('Description'),
        labels: z.record(z.string()).optional().describe('Labels'),
        replicationSchedule: z
          .enum(['HYBRID_REPLICATION_SCHEDULE_UNSPECIFIED', 'EVERY_10_MINUTES', 'HOURLY', 'DAILY'])
          .optional()
          .describe('Replication schedule'),
        hybridReplicationType: z
          .enum([
            'VOLUME_HYBRID_REPLICATION_TYPE_UNSPECIFIED',
            'MIGRATION',
            'CONTINUOUS_REPLICATION',
            'ONPREM_REPLICATION',
            'REVERSE_ONPREM_REPLICATION',
          ])
          .optional()
          .describe('Hybrid replication type'),
        largeVolumeConstituentCount: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Large volume constituent count'),
      })
      .optional()
      .describe('Hybrid replication parameters for the volume'),
    exportPolicy: z
      .object({
        rules: z
          .array(
            z.object({
              allowedClients: z.string().optional().describe('CIDR range of client IPs to allow'),
              accessType: z
                .enum(['READ_ONLY', 'READ_WRITE'])
                .optional()
                .describe('Access permission type'),
              nfsv3: z.boolean().optional().describe('Whether NFSv3 is allowed'),
              nfsv4: z.boolean().optional().describe('Whether NFSv4 is allowed'),
              nfsOptions: z
                .object({
                  rootSquash: z.boolean().optional().describe('Whether to enable root squashing'),
                  anon: z.string().optional().describe('Anonymous user ID for mapped root user'),
                })
                .optional()
                .describe('NFS-specific options'),
              kerberos5ReadOnly: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5 is required for read-only operations'),
              kerberos5ReadWrite: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5 is required for read-write operations'),
              kerberos5iReadOnly: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5i is required for read-only operations'),
              kerberos5iReadWrite: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5i is required for read-write operations'),
              kerberos5pReadOnly: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5p is required for read-only operations'),
              kerberos5pReadWrite: z
                .boolean()
                .optional()
                .describe('Whether Kerberos5p is required for read-write operations'),
            })
          )
          .describe('List of export policy rules'),
      })
      .optional()
      .describe('Updated NFS export policy configuration'),
    throughputMibps: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Manual QoS throughput limit for the volume in MiBps (only applicable when the storage pool uses qosType MANUAL)'
      ),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated volume'),
    operationId: z
      .string()
      .optional()
      .describe('The ID of the long-running operation for updating the volume'),
  },
};

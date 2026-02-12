import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Replication Tool
export const createReplicationTool: ToolConfig = {
  name: 'gcnv_replication_create',
  title: 'Create Replication',
  description:
    'Creates a new replication between volumes. Only supported region pairs/region-groups are allowed; see https://docs.cloud.google.com/netapp/volumes/docs/protect-data/about-volume-replication',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the replication should be created'),
    replicationId: z.string().describe('The ID to assign to the replication'),
    sourceVolumeId: z.string().describe('The ID of the source volume to replicate from'),
    destinationStoragePool: z.string().describe('The full path of destination storage pool'),
    replicationSchedule: z
      .enum(['EVERY_10_MINUTES', 'HOURLY', 'DAILY'])
      .default('HOURLY')
      .describe('Replication schedule; defaults to HOURLY'),
    description: z.string().optional().describe('Optional description of the replication'),
    labels: z.record(z.string()).optional().describe('Optional labels to apply to the replication'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created replication'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the replication'),
  },
};

// Delete Replication Tool
export const deleteReplicationTool: ToolConfig = {
  name: 'gcnv_replication_delete',
  title: 'Delete Replication',
  description: 'Deletes a replication configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Replication Tool
export const getReplicationTool: ToolConfig = {
  name: 'gcnv_replication_get',
  title: 'Get Replication',
  description: 'Gets details of a specific replication',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the replication'),
    replicationId: z.string().describe('The ID of the replication'),
    sourceVolume: z.string().describe('The source volume of the replication'),
    destinationVolume: z.string().describe('The destination volume of the replication'),
    state: z.string().describe('The current state of the replication'),
    createTime: z.date().describe('The timestamp when the replication was created'),
    description: z.string().optional().describe('The description of the replication'),
    labels: z.record(z.string()).optional().describe('Labels applied to the replication'),
    healthy: z.boolean().describe('Whether the replication is healthy'),
    lastReplicationTime: z
      .date()
      .optional()
      .describe('The timestamp of the last successful replication'),
  },
};

// List Replications Tool
export const listReplicationsTool: ToolConfig = {
  name: 'gcnv_replication_list',
  title: 'List Replications',
  description: 'Lists all replications in the specified location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list replications from; omit or use "-" for all locations'),
    volumeId: z.string().describe('The ID of the volume for which the replications are listed'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('The maximum number of replications to return'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    replications: z
      .array(
        z.object({
          name: z.string().describe('The name of the replication'),
          replicationId: z.string().describe('The ID of the replication'),
          sourceVolume: z.string().describe('The source volume of the replication'),
          destinationVolume: z.string().describe('The destination volume of the replication'),
          state: z.string().describe('The current state of the replication'),
          createTime: z.date().describe('The timestamp when the replication was created'),
          description: z.string().optional().describe('The description of the replication'),
          labels: z.record(z.string()).optional().describe('Labels applied to the replication'),
          healthy: z.boolean().describe('Whether the replication is healthy'),
          lastReplicationTime: z
            .date()
            .optional()
            .describe('The timestamp of the last successful replication'),
        })
      )
      .describe('List of replications'),
    nextPageToken: z.string().optional().describe('Token to retrieve the next page of results'),
  },
};

// Update Replication Tool
export const updateReplicationTool: ToolConfig = {
  name: 'gcnv_replication_update',
  title: 'Update Replication',
  description: 'Updates a replication configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to update'),
    description: z.string().optional().describe('New description of the replication'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the replication'),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated replication'),
    operationId: z
      .string()
      .optional()
      .describe('The ID of the long-running operation for updating the replication'),
  },
};

// Resume Replication Tool
export const resumeReplicationTool: ToolConfig = {
  name: 'gcnv_replication_resume',
  title: 'Resume Replication',
  description: 'Resumes a paused replication',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to resume'),
  },
  outputSchema: {
    name: z.string().describe('The name of the replication'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for resuming the replication'),
  },
};

// Stop Replication Tool
export const stopReplicationTool: ToolConfig = {
  name: 'gcnv_replication_stop',
  title: 'Stop Replication',
  description: 'Stops an active replication',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to stop'),
  },
  outputSchema: {
    name: z.string().describe('The name of the replication'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for stopping the replication'),
  },
};

// Reverse Replication Direction Tool
export const reverseReplicationDirectionTool: ToolConfig = {
  name: 'gcnv_replication_reverse_direction',
  title: 'Reverse Replication Direction',
  description: 'Reverses the direction of an existing replication',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to reverse'),
  },
  outputSchema: {
    name: z.string().describe('The name of the replication'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for reversing the replication direction'),
  },
};

// Establish Peering Tool
export const establishPeeringTool: ToolConfig = {
  name: 'gcnv_replication_establish_peering',
  title: 'Establish Replication Peering',
  description: 'Establishes replication peering between clusters',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication'),
    peerClusterName: z
      .string()
      .describe(
        "Name of the user's local source cluster to be peered with the destination cluster"
      ),
    peerSvmName: z
      .string()
      .describe(
        "Name of the user's local source vserver svm to be peered with the destination vserver svm"
      ),
    peerVolumeName: z
      .string()
      .describe("Name of the user's local source volume to be peered with the destination volume"),
    peerIpAddresses: z
      .array(z.string())
      .optional()
      .describe('Optional list of IPv4 ip addresses to be used for peering'),
  },
  outputSchema: {
    name: z.string().describe('The name of the replication'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for establishing peering'),
  },
};

// Sync Replication Tool
export const syncReplicationTool: ToolConfig = {
  name: 'gcnv_replication_sync',
  title: 'Sync Replication',
  description:
    'Syncs the replication - invokes one time volume data transfer from source to destination',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the replication'),
    volumeId: z.string().describe('The ID of the volume containing the replication'),
    replicationId: z.string().describe('The ID of the replication to sync'),
  },
  outputSchema: {
    name: z.string().describe('The name of the replication'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for syncing the replication'),
  },
};

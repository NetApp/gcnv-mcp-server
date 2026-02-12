import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Snapshot Tool
export const createSnapshotTool: ToolConfig = {
  name: 'gcnv_snapshot_create',
  title: 'Create Snapshot',
  description: 'Creates a new snapshot of the specified volume',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume to snapshot'),
    snapshotId: z.string().describe('The ID to assign to the snapshot'),
    description: z.string().optional().describe('Optional description of the snapshot'),
    labels: z.record(z.string()).optional().describe('Optional labels to apply to the snapshot'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created snapshot'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the snapshot'),
  },
};

// Delete Snapshot Tool
export const deleteSnapshotTool: ToolConfig = {
  name: 'gcnv_snapshot_delete',
  title: 'Delete Snapshot',
  description: 'Deletes a snapshot of a volume',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume containing the snapshot'),
    snapshotId: z.string().describe('The ID of the snapshot to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Snapshot Tool
export const getSnapshotTool: ToolConfig = {
  name: 'gcnv_snapshot_get',
  title: 'Get Snapshot',
  description: 'Gets details of a specific snapshot',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume containing the snapshot'),
    snapshotId: z.string().describe('The ID of the snapshot to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the snapshot'),
    snapshotId: z.string().describe('The ID of the snapshot'),
    volumeId: z.string().describe('The ID of the source volume'),
    state: z.string().describe('The current state of the snapshot'),
    createTime: z.date().describe('The timestamp when the snapshot was created'),
    description: z.string().optional().describe('The description of the snapshot'),
    labels: z.record(z.string()).optional().describe('Labels applied to the snapshot'),
  },
};

// List Snapshots Tool
export const listSnapshotsTool: ToolConfig = {
  name: 'gcnv_snapshot_list',
  title: 'List Snapshots',
  description: 'Lists all snapshots for a specified volume (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location of the volume; omit or use "-" for all locations'),
    volumeId: z.string().describe('The ID of the volume to list snapshots from'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('The maximum number of snapshots to return'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    snapshots: z
      .array(
        z.object({
          name: z.string().describe('The name of the snapshot'),
          snapshotId: z.string().describe('The ID of the snapshot'),
          volumeId: z.string().describe('The ID of the source volume'),
          state: z.string().describe('The current state of the snapshot'),
          createTime: z.date().describe('The timestamp when the snapshot was created'),
          description: z.string().optional().describe('The description of the snapshot'),
          labels: z.record(z.string()).optional().describe('Labels applied to the snapshot'),
        })
      )
      .describe('List of snapshots'),
    nextPageToken: z.string().optional().describe('Token to retrieve the next page of results'),
  },
};

// Revert Volume to Snapshot Tool
export const revertVolumeToSnapshotTool: ToolConfig = {
  name: 'gcnv_snapshot_revert',
  title: 'Revert Volume to Snapshot',
  description: 'Reverts a volume to a previous snapshot state',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume to revert'),
    snapshotId: z.string().describe('The ID of the snapshot to revert to'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the revert operation was successful'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for reverting the volume'),
  },
};

// Update Snapshot Tool
export const updateSnapshotTool: ToolConfig = {
  name: 'gcnv_snapshot_update',
  title: 'Update Snapshot',
  description: 'Updates the settings of a specific snapshot',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume containing the snapshot'),
    snapshotId: z.string().describe('The ID of the snapshot to update'),
    description: z.string().optional().describe('New description of the snapshot'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the snapshot'),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated snapshot'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for updating the snapshot'),
  },
};

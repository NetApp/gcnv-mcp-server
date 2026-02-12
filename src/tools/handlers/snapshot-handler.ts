import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'snapshot-handler' });

// Helper to format snapshot data for responses
function formatSnapshotData(snapshot: any): any {
  const result: any = {};

  if (!snapshot) return result;

  if (snapshot.name) {
    // Extract snapshotId from name (last part after last slash)
    const nameParts = snapshot.name.split('/');
    result.name = snapshot.name;
    result.snapshotId = nameParts[nameParts.length - 1];

    // Extract volumeId from name
    const volumeMatch = snapshot.name.match(/\/volumes\/([^/]+)\/snapshots\//);
    if (volumeMatch && volumeMatch[1]) {
      result.volumeId = volumeMatch[1];
    }
  }

  // Copy basic properties
  if (snapshot.state) result.state = snapshot.state;

  // Format timestamps if they exist
  if (snapshot.createTime) {
    result.createTime = new Date(snapshot.createTime.seconds * 1000);
  }

  // Copy optional properties
  if (snapshot.description) result.description = snapshot.description;
  if (snapshot.labels) result.labels = snapshot.labels;

  return result;
}

// Create Snapshot Handler
export const createSnapshotHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, snapshotId, description, labels } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the snapshot
    const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Create the snapshot request
    const request = {
      parent,
      snapshotId,
      snapshot: {
        description,
        labels,
      },
    };

    log.info({ request }, 'Create Snapshot request');
    // Call the API to create a snapshot
    const [operation] = await netAppClient.createSnapshot(request);
    log.info({ operation }, 'Create Snapshot operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/snapshots/${snapshotId}`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/snapshots/${snapshotId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating snapshot');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating snapshot: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Snapshot Handler
export const deleteSnapshotHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, snapshotId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the snapshot
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/snapshots/${snapshotId}`;

    // Call the API to delete the snapshot
    const request = { name };

    log.info({ request }, 'Delete Snapshot request');
    const [operation] = await netAppClient.deleteSnapshot(request);
    log.info({ operation }, 'Delete Snapshot operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Snapshot '${snapshotId}' deletion operation started.`,
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting snapshot');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting snapshot: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        success: false,
      },
    };
  }
};

// Get Snapshot Handler
export const getSnapshotHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, snapshotId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the snapshot
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/snapshots/${snapshotId}`;

    // Call the API to get the snapshot
    log.info({ name }, 'Get Snapshot request');
    const [snapshot] = await netAppClient.getSnapshot({ name });
    log.info({ snapshot }, 'Get Snapshot response');

    // Format the snapshot data
    const formattedSnapshot = formatSnapshotData(snapshot);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(formattedSnapshot, null, 2),
        },
      ],
      structuredContent: formattedSnapshot,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting snapshot');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting snapshot: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Snapshots Handler
export const listSnapshotsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, volumeId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path (use "-" for all locations)
    const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Create the request object
    const request: any = { parent };
    if (filter) request.filter = filter;
    if (pageSize) request.pageSize = pageSize;
    if (pageToken) request.pageToken = pageToken;

    // Call the API to list snapshots
    log.info({ request }, 'List Snapshots request');
    const [snapshots, , nextPageToken] = await netAppClient.listSnapshots(request);
    log.info({ snapshots, nextPageToken }, 'List Snapshots response');

    const formattedSnapshots = snapshots.map(formatSnapshotData);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              snapshots: snapshots,
              nextPageToken: nextPageToken || '',
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        snapshots: formattedSnapshots,
        nextPageToken: nextPageToken || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing snapshots');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing snapshots: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        snapshots: [],
        nextPageToken: '',
      },
    };
  }
};

// Revert Volume to Snapshot Handler
export const revertVolumeToSnapshotHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, snapshotId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the snapshot
    const snapshot = `projects/${projectId}/locations/${location}/volumes/${volumeId}/snapshots/${snapshotId}`;
    const volume = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Call the API to revert to snapshot
    const request = {
      name: volume,
      snapshot,
    };

    log.info({ request }, 'Revert to Snapshot request');
    const [operation] = await netAppClient.revertVolume(request);
    log.info({ operation }, 'Revert to Snapshot operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Volume '${volumeId}' revert to snapshot '${snapshotId}' operation started.`,
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error reverting to snapshot');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error reverting to snapshot: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        success: false,
      },
    };
  }
};

// Update Snapshot Handler
export const updateSnapshotHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, snapshotId, description, labels } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the snapshot
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/snapshots/${snapshotId}`;

    // Prepare the update mask based on provided fields
    const updateMask: string[] = [];
    const snapshot: any = { name };

    if (description !== undefined) {
      snapshot.description = description;
      updateMask.push('description');
    }

    if (labels !== undefined) {
      snapshot.labels = labels;
      updateMask.push('labels');
    }

    // Call the API to update the snapshot
    const request = {
      snapshot,
      updateMask: {
        paths: updateMask,
      },
    };

    log.info({ request }, 'Update Snapshot request');
    const [operation] = await netAppClient.updateSnapshot(request);
    log.info({ operation }, 'Update Snapshot operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Snapshot '${snapshotId}' update operation started`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: name,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating snapshot');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating snapshot: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

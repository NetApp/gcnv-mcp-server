import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { protos } from '@google-cloud/netapp';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'replication-handler' });

// Helper to format replication data for responses
function formatReplicationData(replication: any): any {
  const result: any = {};

  if (!replication) return result;

  if (replication.name) {
    // Extract replicationId from name (last part after last slash)
    const nameParts = replication.name.split('/');
    result.name = replication.name;
    result.replicationId = nameParts[nameParts.length - 1];
  }

  // Copy basic properties
  if (replication.sourceVolume) result.sourceVolume = replication.sourceVolume;
  if (replication.destinationVolume) result.destinationVolume = replication.destinationVolume;
  if (replication.state) result.state = replication.state;
  if (replication.healthy !== undefined) result.healthy = replication.healthy;

  // Format timestamps if they exist
  if (replication.createTime) {
    result.createTime = new Date(replication.createTime.seconds * 1000);
  }

  if (replication.lastReplicationTime) {
    result.lastReplicationTime = new Date(replication.lastReplicationTime.seconds * 1000);
  }

  // Copy optional properties
  if (replication.description) result.description = replication.description;
  if (replication.labels) result.labels = replication.labels;

  return result;
}

// Create Replication Handler
export const createReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      replicationId,
      sourceVolumeId,
      destinationStoragePool,
      replicationSchedule,
      description,
      labels,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path - for replications, parent is at the location level
    const parent = `projects/${projectId}/locations/${location}/volumes/${sourceVolumeId}`;

    // Format the source and destination volumes
    const sourceVolume = `projects/${projectId}/locations/${location}/volumes/${sourceVolumeId}`;

    const scheduleMap: Record<
      string,
      protos.google.cloud.netapp.v1.Replication.ReplicationSchedule
    > = {
      EVERY_10_MINUTES:
        protos.google.cloud.netapp.v1.Replication.ReplicationSchedule.EVERY_10_MINUTES,
      HOURLY: protos.google.cloud.netapp.v1.Replication.ReplicationSchedule.HOURLY,
      DAILY: protos.google.cloud.netapp.v1.Replication.ReplicationSchedule.DAILY,
    };
    const scheduleValue =
      scheduleMap[replicationSchedule] ||
      protos.google.cloud.netapp.v1.Replication.ReplicationSchedule.HOURLY;

    // Create the final request
    const request = {
      parent,
      replicationId,
      replication: {
        name: replicationId,
        destinationVolumeParameters: {
          storagePool: destinationStoragePool,
        },
        sourceVolume,
        replicationSchedule: scheduleValue,
        description: description || '',
        labels: labels || {},
      },
    };

    // Log the request to help debug
    log.info({ request }, 'Create Replication request');

    // Call the API to create a replication
    const [operation] = await netAppClient.createReplication(request);
    log.info({ operation }, 'Create Replication operation');

    // Make the response more robust by checking operation properties
    const operationName = operation && operation.name ? operation.name : 'Unknown';

    return {
      content: [
        {
          type: 'text' as const,
          text: `Created replication ${replicationId} successfully. Operation: ${operationName}`,
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${sourceVolumeId}/replications/${replicationId}`,
        operationId: operationName,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating replication: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Replication Handler
export const deleteReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, replicationId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to delete the replication
    const request = { name };

    log.info({ request }, 'Delete Replication request');
    const [operation] = await netAppClient.deleteReplication(request);
    log.info({ operation }, 'Delete Replication operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication ${replicationId} deletion requested`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting replication: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        success: false,
      },
    };
  }
};

// Get Replication Handler
export const getReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, replicationId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to get the replication
    log.info({ name }, 'Get Replication request');
    const [replication] = await netAppClient.getReplication({ name });
    log.info({ replication }, 'Get Replication response');

    // Format the response
    const formattedReplication = formatReplicationData(replication);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(formattedReplication, null, 2),
        },
      ],
      structuredContent: formattedReplication,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting replication: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Replications Handler
export const listReplicationsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, volumeId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path (use "-" for all locations)
    const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Create the list request
    const request: any = { parent };
    if (filter) request.filter = filter;
    if (pageSize) request.pageSize = pageSize;
    if (pageToken) request.pageToken = pageToken;

    // Call the API to list replications
    log.info({ request }, 'List Replications request');
    const [replications, , nextPageToken] = await netAppClient.listReplications(request);
    log.info({ replications, nextPageToken }, 'List Replications response');

    const formattedReplications = replications.map(formatReplicationData);
    log.info({ formattedReplications }, 'Formatted replications');
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ replications, nextPageToken }, null, 2),
        },
      ],
      structuredContent: {
        replications: formattedReplications,
        nextPageToken: nextPageToken || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing replications');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing replications: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Replication Handler
export const updateReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, replicationId, description, labels } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Create update mask based on provided fields
    const updateMask: string[] = [];
    const replication: any = { name };

    if (description !== undefined) {
      replication.description = description;
      updateMask.push('description');
    }

    if (labels !== undefined) {
      replication.labels = labels;
      updateMask.push('labels');
    }

    // Call the API to update the replication
    const request = { replication, updateMask: { paths: updateMask } };

    log.info({ request }, 'Update Replication request');
    const [operation] = await netAppClient.updateReplication(request);
    log.info({ operation }, 'Update Replication operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication ${replicationId} update requested`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating replication: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Resume Replication Handler
export const resumeReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, replicationId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to resume the replication
    const request = { name };

    log.info({ request }, 'Resume Replication request');
    const [operation] = await netAppClient.resumeReplication(request);
    log.info({ operation }, 'Resume Replication operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication ${replicationId} resume requested`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error resuming replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error resuming replication: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Stop Replication Handler
export const stopReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, replicationId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to stop the replication
    const request = { name };

    log.info({ request }, 'Stop Replication request');
    const [operation] = await netAppClient.stopReplication(request);
    log.info({ operation }, 'Stop Replication operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication ${replicationId} stop requested`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error stopping replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error stopping replication: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Reverse Replication Direction Handler
export const reverseReplicationDirectionHandler: ToolHandler = async (args: {
  [key: string]: any;
}) => {
  try {
    const { projectId, location, volumeId, replicationId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to reverse replication direction
    const request = { name };

    log.info({ request }, 'Reverse Replication direction request');
    const [operation] = await netAppClient.reverseReplicationDirection(request);
    log.info({ operation }, 'Reverse Replication direction operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication ${replicationId} direction reversal requested`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error reversing replication direction');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error reversing replication direction: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Establish Peering Handler
export const establishPeeringHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      replicationId,
      peerClusterName,
      peerSvmName,
      peerVolumeName,
      peerIpAddresses,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to establish peering
    const request: any = {
      name,
      peerClusterName,
      peerSvmName,
      peerVolumeName,
    };

    if (peerIpAddresses && peerIpAddresses.length > 0) {
      request.peerIpAddresses = peerIpAddresses;
    }

    log.info({ request }, 'Establish Replication Peering request');
    const [operation] = await netAppClient.establishPeering(request);
    log.info({ operation }, 'Establish Replication Peering operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication peering establishment requested for ${replicationId}`,
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
    log.error({ err: error }, 'Error establishing peering');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error establishing peering: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Sync Replication Handler
export const syncReplicationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, replicationId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the replication
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/replications/${replicationId}`;

    // Call the API to sync replication
    const request = { name };

    log.info({ request }, 'Sync Replication request');
    const [operation] = await netAppClient.syncReplication(request);
    log.info({ operation }, 'Sync Replication operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Replication sync requested for ${replicationId}`,
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
    log.error({ err: error }, 'Error syncing replication');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error syncing replication: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'volume-handler' });

// Helper to format volume data for responses
function formatVolumeData(volume: any): any {
  const result: any = {};

  if (!volume) return result;

  if (volume.name) {
    // Extract volumeId from name (last part after last slash)
    const nameParts = volume.name.split('/');
    result.name = volume.name;
    result.volumeId = nameParts[nameParts.length - 1];
  }

  // Extract storage pool from name
  if (volume.storagePool) {
    result.storagePool = volume.storagePool;
  }

  // Copy basic properties
  if (volume.capacityGib) result.capacityGib = Number(volume.capacityGib);
  if (volume.usedGib) result.usedGib = Number(volume.usedGib);
  if (volume.state) result.state = volume.state;
  if (volume.stateDetails) result.stateDetails = volume.stateDetails;
  if (volume.shareName) result.shareName = volume.shareName;
  if (volume.protocols) result.protocols = volume.protocols;
  if (volume.serviceLevel) result.serviceLevel = volume.serviceLevel;
  if (volume.network) result.network = volume.network;
  if (volume.securityStyle) result.securityStyle = volume.securityStyle;

  // Format timestamps if they exist
  if (volume.createTime) {
    result.createTime = new Date(volume.createTime.seconds * 1000);
  }

  // Copy optional properties
  if (volume.description) result.description = volume.description;
  if (volume.labels) result.labels = volume.labels;
  if (volume.unixPermissions) result.unixPermissions = volume.unixPermissions;
  if (volume.kmsConfig) result.kmsConfig = volume.kmsConfig;
  if (volume.encryptionType) result.encryptionType = volume.encryptionType;
  if (volume.backupConfig) result.backupConfig = volume.backupConfig;
  if (volume.tieringPolicy) result.tieringPolicy = volume.tieringPolicy;
  if (volume.throughputMibps !== undefined) result.throughputMibps = volume.throughputMibps;
  if (volume.replicaZone) result.replicaZone = volume.replicaZone;
  if (volume.zone) result.zone = volume.zone;
  if (volume.coldTierSizeGib !== undefined) result.coldTierSizeGib = Number(volume.coldTierSizeGib);
  if (volume.hotTierSizeUsedGib !== undefined)
    result.hotTierSizeUsedGib = Number(volume.hotTierSizeUsedGib);
  if (volume.largeCapacity !== undefined) result.largeCapacity = volume.largeCapacity;
  if (volume.multipleEndpoints !== undefined) result.multipleEndpoints = volume.multipleEndpoints;
  if (volume.hasReplication !== undefined) result.hasReplication = volume.hasReplication;
  if (volume.restrictedActions) result.restrictedActions = volume.restrictedActions;

  // Format mount points
  if (volume.mountOptions && volume.mountOptions.length > 0) {
    result.mountOptions = volume.mountOptions.map((mp: any) => ({
      protocol: mp.protocol || '',
      ipAddress: mp.ipAddress || '',
      export: mp.export || '',
      exportFull: mp.exportFull || '',
    }));
  }

  // Surface export policy if present
  if (volume.exportPolicy) result.exportPolicy = volume.exportPolicy;

  // Surface SMB settings if present
  if (volume.smbSettings) result.smbSettings = volume.smbSettings;

  return result;
}

// Create Volume Handler
export const createVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      storagePoolId,
      volumeId,
      capacityGib,
      protocols,
      description,
      labels,
      backupConfig,
      exportPolicy,
      shareName,
      throughputMibps,
      largeCapacity,
      multipleEndpoints,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the volume
    const parent = `projects/${projectId}/locations/${location}`;

    // Large Capacity Volumes guardrails:
    // - Premium/Extreme only (enforced by checking the storage pool service level)
    // - Minimum size 15 TiB => 15360 GiB
    if (multipleEndpoints && !largeCapacity) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating volume: multipleEndpoints is only valid when largeCapacity is true.',
          },
        ],
      };
    }

    if (largeCapacity) {
      if (capacityGib < 15360) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Error creating volume: largeCapacity requires capacityGib >= 15360 (15 TiB).',
            },
          ],
        };
      }

      const storagePoolName = String(storagePoolId || '').includes('/')
        ? storagePoolId
        : `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;
      const [pool] = await netAppClient.getStoragePool({ name: storagePoolName });
      const poolServiceLevel = (pool?.serviceLevel || '').toString().toUpperCase();
      if (poolServiceLevel !== 'PREMIUM' && poolServiceLevel !== 'EXTREME') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error creating volume: largeCapacity volumes are only supported in PREMIUM or EXTREME pools (got ${poolServiceLevel || 'UNKNOWN'}).`,
            },
          ],
        };
      }
    }

    // Create the volume request
    const request = {
      parent,
      volumeId,
      volume: {
        storagePool: storagePoolId,
        capacityGib,
        protocols: protocols || ['NFS3'],
        description,
        labels,
        backupConfig,
        shareName: shareName || volumeId,
        exportPolicy,
        ...(throughputMibps !== undefined ? { throughputMibps } : {}),
        ...(largeCapacity !== undefined ? { largeCapacity } : {}),
        ...(multipleEndpoints !== undefined ? { multipleEndpoints } : {}),
      },
    };

    log.info({ request }, 'Create Volume request');
    // Call the API to create a volume
    const [operation] = await netAppClient.createVolume(request);
    log.info({ operation }, 'Create Volume operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Created volume ${volumeId}. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating volume: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Volume Handler
export const deleteVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, force = false } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the volume
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Call the API to delete the volume
    const request: any = { name };
    // Only add force if it's true to avoid API errors
    if (force) {
      request.force = true;
    }

    log.info({ request }, 'Delete Volume request');
    const [operation] = await netAppClient.deleteVolume(request);
    log.info({ operation }, 'Delete Volume operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Volume ${volumeId} deletion requested`,
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
    log.error({ err: error }, 'Error deleting volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting volume: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        success: false,
      },
    };
  }
};

// Get Volume Handler
export const getVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the volume
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Call the API to get the volume
    log.info({ name }, 'Get Volume request');
    const [volume] = await netAppClient.getVolume({ name });
    log.info({ volume }, 'Get Volume response');

    // Format the volume data
    const formattedVolume = formatVolumeData(volume);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(volume, null, 2),
        },
      ],
      structuredContent: { volume: formattedVolume },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting volume: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Volumes Handler
export const listVolumesHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, filter, pageSize, pageToken } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path
    const parent = `projects/${projectId}/locations/${location}`;

    // Create the request object
    const request: any = { parent };
    if (filter) request.filter = filter;
    if (pageSize) request.pageSize = pageSize;
    if (pageToken) request.pageToken = pageToken;

    // Call the API to list volumes
    log.info({ request }, 'List Volumes request');
    const [volumes, , nextPageToken] = await netAppClient.listVolumes(request);
    log.info({ volumes, nextPageToken }, 'List Volumes response');

    const formattedVolumes = volumes.map(formatVolumeData);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ volumes: volumes, nextPageToken: nextPageToken }, null, 2),
        },
      ],
      structuredContent: {
        volumes: formattedVolumes,
        nextPageToken: pageToken || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing volumes');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing volumes: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Volume Handler
// TODO: update is not tested
// FIX_ME: errors "reason: 'RESOURCE_PROJECT_INVALID'
export const updateVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      capacityGib,
      description,
      labels,
      backupConfig,
      exportPolicy,
      throughputMibps,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the volume
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Create the update mask
    const updateMask: string[] = [];
    const volume: any = { name };

    // Add fields to update mask if they're provided
    if (capacityGib !== undefined) {
      volume.capacityGib = capacityGib;
      updateMask.push('capacity_gib');
    }
    if (description !== undefined) {
      volume.description = description;
      updateMask.push('description');
    }
    if (labels !== undefined) {
      volume.labels = labels;
      updateMask.push('labels');
    }
    if (exportPolicy !== undefined) {
      volume.exportPolicy = exportPolicy;
      updateMask.push('export_policy');
    }
    if (backupConfig !== undefined) {
      volume.backupConfig = backupConfig;
      // Update mask must use proto (snake_case) field names
      if (backupConfig.backupPolicies !== undefined)
        updateMask.push('backup_config.backup_policies');
      if (backupConfig.backupVault !== undefined) updateMask.push('backup_config.backup_vault');
      if (backupConfig.scheduledBackupEnabled !== undefined)
        updateMask.push('backup_config.scheduled_backup_enabled');
    }

    if (throughputMibps !== undefined) {
      volume.throughputMibps = throughputMibps;
      updateMask.push('throughput_mibps');
    }
    // Create the request
    const request = {
      volume,
      updateMask: { paths: updateMask },
    };

    log.info({ request }, 'Update Volume request');
    const [operation] = await netAppClient.updateVolume(request);
    log.info({ operation }, 'Update Volume operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Updated volume ${volumeId}. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        name,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating volume: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

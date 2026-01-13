import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'storage-pool-handler' });

// Create Storage Pool Handler
export const createStoragePoolHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      storagePoolId,
      capacityGib,
      serviceLevel,
      description,
      labels,
      network,
      activeDirectory,
      kmsConfig,
      encryptionType,
      ldapEnabled,
      totalThroughputMibps,
      qosType,
      allowAutoTiering,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the storage pool
    const parent = `projects/${projectId}/locations/${location}`;

    // Accept case-insensitive service levels (e.g. "flex" -> "FLEX")
    const normalizedServiceLevel =
      typeof serviceLevel === 'string' ? serviceLevel.toUpperCase() : serviceLevel;

    const normalizedQosType = typeof qosType === 'string' ? qosType.toUpperCase() : qosType;

    // Flex custom performance: only applicable to FLEX pools
    if (totalThroughputMibps !== undefined && normalizedServiceLevel !== 'FLEX') {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating storage pool: totalThroughputMibps is only supported when serviceLevel is FLEX.',
          },
        ],
      };
    }

    // Manual QoS is supported for Standard/Premium/Extreme; not supported for Flex
    if (normalizedQosType === 'MANUAL' && normalizedServiceLevel === 'FLEX') {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating storage pool: qosType MANUAL is not supported for FLEX service level.',
          },
        ],
      };
    }

    // Build the storage pool payload with provided fields only
    const storagePoolPayload: any = {
      capacityGib,
      serviceLevel: normalizedServiceLevel,
      description,
      labels,
      network,
    };

    if (activeDirectory) storagePoolPayload.activeDirectory = activeDirectory;
    if (kmsConfig) storagePoolPayload.kmsConfig = kmsConfig;
    if (encryptionType) storagePoolPayload.encryptionType = encryptionType;
    if (ldapEnabled !== undefined) storagePoolPayload.ldapEnabled = ldapEnabled;
    if (totalThroughputMibps !== undefined) {
      storagePoolPayload.customPerformanceEnabled = true;
      storagePoolPayload.totalThroughputMibps = totalThroughputMibps;
    }
    if (normalizedQosType) storagePoolPayload.qosType = normalizedQosType;
    if (allowAutoTiering !== undefined) storagePoolPayload.allowAutoTiering = allowAutoTiering;

    // Create the storage pool request
    const request = {
      parent,
      storagePoolId,
      storagePool: storagePoolPayload,
    };

    log.info({ request }, 'Create Storage Pool request');
    // Call the API to create a storage pool
    const [operation] = await netAppClient.createStoragePool(request);
    log.info({ operation }, 'Create Storage Pool operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating storage pool');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating storage pool: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Storage Pool Handler
export const deleteStoragePoolHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, storagePoolId, force = false } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the storage pool
    const name = `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;

    // Call the API to delete the storage pool
    const request: any = { name };
    // Only add force if it's true to avoid API errors
    if (force) {
      request.force = force;
    }

    const operation = await netAppClient.deleteStoragePool(request);
    const operationName = operation[0].name || '';

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, operation: operation }, null, 2),
        },
      ],
      structuredContent: {
        success: true,
        operationId: operationName,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting storage pool');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting storage pool: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Get Storage Pool Handler
export const getStoragePoolHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, storagePoolId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the storage pool
    const name = `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;

    // Call the API to get the storage pool
    const [storagePool] = await netAppClient.getStoragePool({ name });
    log.info({ storagePool }, 'Get Storage Pool response');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(storagePool, null, 2),
        },
      ],
      structuredContent: {
        name: storagePool.name || '',
        storagePoolId: storagePoolId,
        capacityGib: Number(storagePool.capacityGib) || 0,
        volumeCapacityGib: Number(storagePool.volumeCapacityGib) || 0,
        volumecount: storagePool.volumeCount || 0,
        serviceLevel: storagePool.serviceLevel || '',
        state: storagePool.state || 'UNKNOWN',
        createTime:
          storagePool.createTime && storagePool.createTime.seconds
            ? new Date(Number(storagePool.createTime.seconds) * 1000)
            : new Date(),
        description: storagePool.description || '',
        labels: storagePool.labels || {},
        network: storagePool.network,
        activeDirectory: storagePool.activeDirectory,
        kmsConfig: storagePool.kmsConfig,
        encryptionType: storagePool.encryptionType,
        ldapEnabled: storagePool.ldapEnabled ?? false,
        customPerformanceEnabled:
          typeof storagePool.customPerformanceEnabled === 'boolean'
            ? storagePool.customPerformanceEnabled
            : undefined,
        totalThroughputMibps:
          storagePool.totalThroughputMibps !== undefined
            ? Number(storagePool.totalThroughputMibps) || 0
            : undefined,
        qosType: storagePool.qosType,
        allowAutoTiering: storagePool.allowAutoTiering ?? false,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting storage pool');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting storage pool: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Storage Pools Handler
export const listStoragePoolsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, filter, pageSize, pageToken } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for listing storage pools
    const parent = `projects/${projectId}/locations/${location}`;

    // Call the API to list storage pools
    const [storagePools, , paginated_response] = await netAppClient.listStoragePools({
      parent,
      pageSize,
      pageToken,
      orderBy: undefined,
      filter,
    });

    log.info({ storagePools, paginated_response }, 'List Storage Pools response');
    // Get the storage pools and next page token

    const nextPageToken = paginated_response ? paginated_response.nextPageToken : undefined;

    // Map the storage pools to the desired format
    const formattedPools = storagePools.map((pool: any) => {
      // Extract the ID from the name
      const name = pool.name || '';
      const nameParts = name.split('/');
      const extractedId = nameParts[nameParts.length - 1];

      return {
        name: name,
        storagePoolId: extractedId,
        serviceLevel: pool.serviceLevel || '',
        capacityGib: Number(pool.capacityGib) || 0,
        volumeCapacityGib: Number(pool.volumeCapacityGib) || 0,
        volumecount: pool.volumeCount || 0,
        state: pool.state || 'UNKNOWN',
        createTime:
          pool.createTime && pool.createTime.seconds
            ? new Date(Number(pool.createTime.seconds) * 1000)
            : new Date(),
        description: pool.description || '',
        labels: pool.labels || {},
        network: pool.network,
        activeDirectory: pool.activeDirectory,
        kmsConfig: pool.kmsConfig,
        encryptionType: pool.encryptionType,
        ldapEnabled: pool.ldapEnabled ?? false,
        customPerformanceEnabled:
          typeof pool.customPerformanceEnabled === 'boolean'
            ? pool.customPerformanceEnabled
            : undefined,
        totalThroughputMibps:
          pool.totalThroughputMibps !== undefined
            ? Number(pool.totalThroughputMibps) || 0
            : undefined,
        qosType: pool.qosType,
        allowAutoTiering: pool.allowAutoTiering ?? false,
      };
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(storagePools, null, 2),
        },
      ],
      structuredContent: {
        storagePools: formattedPools,
        nextPageToken: nextPageToken,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing storage pools');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing storage pools: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Storage Pool Handler
export const updateStoragePoolHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, storagePoolId, capacityGib, description, labels, qosType } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the storage pool
    const name = `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;

    // Prepare the update mask based on provided fields
    const updateMask: string[] = [];
    const storagePool: any = {};

    if (capacityGib !== undefined) {
      storagePool.capacityGib = capacityGib;
      updateMask.push('capacity_gib');
    }

    if (description !== undefined) {
      storagePool.description = description;
      updateMask.push('description');
    }

    if (labels !== undefined) {
      storagePool.labels = labels;
      updateMask.push('labels');
    }

    if (qosType !== undefined) {
      storagePool.qosType = typeof qosType === 'string' ? qosType.toUpperCase() : qosType;
      updateMask.push('qos_type');
    }

    // Call the API to update the storage pool
    const [operation] = await netAppClient.updateStoragePool({
      storagePool: {
        name,
        ...storagePool,
      },
      updateMask: {
        paths: updateMask,
      },
    });

    log.info({ operation }, 'Update Storage Pool operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ name: `Update ${name}`, operation: operation }, null, 2),
        },
      ],
      structuredContent: {
        name: storagePool.name || '',
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating storage pool');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating storage pool: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Validate Directory Service Handler
export const validateDirectoryServiceHandler: ToolHandler = async (args: {
  [key: string]: any;
}) => {
  try {
    const { projectId, location, storagePoolId, directoryServiceType } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the storage pool
    const name = `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;

    // Call the API to validate directory service
    const [operation] = await netAppClient.validateDirectoryService({
      name,
      directoryServiceType,
    });

    log.info({ operation }, 'Validate Directory Service operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Directory service validation initiated for storage pool ${storagePoolId}`,
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
    log.error({ err: error }, 'Error validating directory service');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error validating directory service: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

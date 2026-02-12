import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'storage-pool-handler' });

function parseStoragePoolType(input: any): { value?: number; error?: string } {
  const enumMap: Record<string, number> = {
    STORAGE_POOL_TYPE_UNSPECIFIED: 0,
    FILE: 1,
    UNIFIED: 2,
    UNIFIED_LARGE_CAPACITY: 3,
  };

  if (input === undefined || input === null) return {};

  if (typeof input === 'number') {
    if (Object.values(enumMap).includes(input)) return { value: input };
    return { error: 'storagePoolType must be a valid enum number (0-3)' };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim().toUpperCase();
    if (enumMap[trimmed] !== undefined) return { value: enumMap[trimmed] };
    return {
      error:
        'storagePoolType must be one of STORAGE_POOL_TYPE_UNSPECIFIED, FILE, UNIFIED, UNIFIED_LARGE_CAPACITY, or the corresponding enum number',
    };
  }

  return { error: 'storagePoolType must be a string enum name or enum number' };
}

function isLikelyZone(location: string): boolean {
  // Treat anything ending with "-<letter>" as a zone (e.g. us-central1-a).
  // This matches GCP zone formatting without being overly strict.
  return /-[a-z]$/i.test(location.trim());
}

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
      storagePoolType,
      zone,
      replicaZone,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the storage pool
    const parent = `projects/${projectId}/locations/${location}`;

    // Accept case-insensitive service levels (e.g. "flex" -> "FLEX")
    const normalizedServiceLevel =
      typeof serviceLevel === 'string' ? serviceLevel.toUpperCase() : serviceLevel;

    const normalizedQosType = typeof qosType === 'string' ? qosType.toUpperCase() : qosType;

    const { value: parsedStoragePoolType, error: storagePoolTypeError } =
      parseStoragePoolType(storagePoolType);
    if (storagePoolTypeError) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error creating storage pool: ${storagePoolTypeError}`,
          },
        ],
      };
    }

    // New pool types (UNIFIED / UNIFIED_LARGE_CAPACITY) are only available for FLEX
    if (
      parsedStoragePoolType !== undefined &&
      (parsedStoragePoolType === 2 || parsedStoragePoolType === 3) &&
      normalizedServiceLevel !== 'FLEX'
    ) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating storage pool: storagePoolType UNIFIED and UNIFIED_LARGE_CAPACITY are only supported when serviceLevel is FLEX.',
          },
        ],
      };
    }

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

    // FLEX location requirements:
    // - If user provided a zonal location (e.g. us-central1-a), that satisfies "zone in location".
    // - If user provided a regional location (e.g. us-central1), then zone + replicaZone must be provided.
    const locStr = typeof location === 'string' ? location.trim() : '';
    const locationIsZone = locStr ? isLikelyZone(locStr) : false;
    if (normalizedServiceLevel === 'FLEX' && !locationIsZone) {
      if (typeof zone !== 'string' || zone.trim() === '') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Error creating storage pool: for FLEX pools, if location is a region then zone must be provided.',
            },
          ],
        };
      }
      if (typeof replicaZone !== 'string' || replicaZone.trim() === '') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Error creating storage pool: for FLEX pools, if location is a region then replicaZone must be provided.',
            },
          ],
        };
      }
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
    if (parsedStoragePoolType !== undefined) storagePoolPayload.type = parsedStoragePoolType;

    if (normalizedServiceLevel === 'FLEX') {
      // IMPORTANT: For zonal pools, the zone is encoded in the URL/location already;
      // do not send zone/replicaZone fields in the request body.
      // For regional pools, zone + replicaZone must be provided and are sent in the body.
      if (!locationIsZone) {
        if (zone) storagePoolPayload.zone = zone;
        if (replicaZone) storagePoolPayload.replicaZone = replicaZone;
      }
    }

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
        storagePoolType: storagePool.type,
        zone: storagePool.zone,
        replicaZone: storagePool.replicaZone,
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
    const { projectId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for listing storage pools (use "-" for all locations)
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
        storagePoolType: pool.type,
        zone: pool.zone,
        replicaZone: pool.replicaZone,
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
    const {
      projectId,
      location,
      storagePoolId,
      capacityGib,
      description,
      labels,
      qosType,
      storagePoolType,
      zone,
      replicaZone,
    } = args;

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

    if (storagePoolType !== undefined) {
      const { value: parsedType, error: typeError } = parseStoragePoolType(storagePoolType);
      if (typeError) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error updating storage pool: ${typeError}`,
            },
          ],
        };
      }

      // Only enforce FLEX for new types; FILE is allowed everywhere (and is the historical default)
      if (parsedType === 2 || parsedType === 3) {
        const [existing] = await netAppClient.getStoragePool({ name });
        const existingServiceLevel =
          typeof existing?.serviceLevel === 'string'
            ? existing.serviceLevel.toUpperCase()
            : existing?.serviceLevel;
        if (existingServiceLevel !== 'FLEX') {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'Error updating storage pool: storagePoolType UNIFIED and UNIFIED_LARGE_CAPACITY are only supported when serviceLevel is FLEX.',
              },
            ],
          };
        }
      }

      storagePool.type = parsedType;
      updateMask.push('type');
    }

    if (zone !== undefined) {
      storagePool.zone = zone;
      updateMask.push('zone');
    }
    if (replicaZone !== undefined) {
      storagePool.replicaZone = replicaZone;
      updateMask.push('replica_zone');
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
        name,
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

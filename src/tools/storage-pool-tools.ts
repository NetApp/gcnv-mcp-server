import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Storage Pool Tool
export const createStoragePoolTool: ToolConfig = {
  name: 'gcnv_storage_pool_create',
  title: 'Create Storage Pool',
  description: 'Creates a new storage pool in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the storage pool should be created'),
    storagePoolId: z.string().describe('The ID to assign to the storage pool'),
    capacityGib: z.number().describe('The capacity of the storage pool in GiB'),
    serviceLevel: z
      .union([
        z.enum(['STANDARD', 'PREMIUM', 'EXTREME', 'FLEX']),
        z.enum(['standard', 'premium', 'extreme', 'flex']),
      ])
      .describe('The service level of the storage pool'),
    description: z.string().optional().describe('Optional description of the storage pool'),
    labels: z
      .record(z.string())
      .optional()
      .describe('Optional labels to apply to the storage pool'),
    network: z
      .string()
      .optional()
      .describe(
        'The VPC network to use for the storage pool (projects/{project}/global/networks/{network})'
      ),
    activeDirectory: z
      .string()
      .optional()
      .describe('The Active Directory policy resource to attach to SMB volumes'),
    kmsConfig: z
      .string()
      .optional()
      .describe(
        'The CMEK KMS config to use for pool encryption (projects/{project}/locations/{location}/kmsConfigs/{kmsConfigId})'
      ),
    encryptionType: z
      .enum(['SERVICE_MANAGED', 'CLOUD_KMS'])
      .optional()
      .describe('Encryption type for the pool; use CLOUD_KMS with kmsConfig'),
    ldapEnabled: z
      .boolean()
      .optional()
      .describe('Whether LDAP should be enabled for NFS volume access'),
    totalThroughputMibps: z
      .number()
      .int()
      .min(64)
      .max(5120)
      .optional()
      .describe('Total throughput in MiBps for Flex custom performance (FLEX only; 64-5120 MiBps)'),
    qosType: z
      .union([z.enum(['AUTO', 'MANUAL']), z.enum(['auto', 'manual'])])
      .optional()
      .describe(
        'QoS type for the storage pool (AUTO or MANUAL). Manual QoS is supported for Standard/Premium/Extreme; not supported for Flex.'
      ),
    allowAutoTiering: z
      .boolean()
      .optional()
      .describe('Enable auto-tiering to manage capacity for the pool'),
    zone: z
      .string()
      .optional()
      .describe(
        'Zone for the storage pool. For FLEX pools: if location is a region (e.g. us-central1), zone and replicaZone must be provided.'
      ),
    replicaZone: z
      .string()
      .optional()
      .describe(
        'Replica zone for the storage pool. For FLEX pools: required when location is a region (e.g. us-central1).'
      ),
    storagePoolType: z
      .union([
        z.enum(['STORAGE_POOL_TYPE_UNSPECIFIED', 'FILE', 'UNIFIED', 'UNIFIED_LARGE_CAPACITY']),
        z.enum(['storage_pool_type_unspecified', 'file', 'unified', 'unified_large_capacity']),
        z.number(),
      ])
      .optional()
      .describe(
        'Storage pool type (StoragePoolType). UNIFIED and UNIFIED_LARGE_CAPACITY are only available for FLEX service level.'
      ),
  },
  outputSchema: {
    name: z.string().describe('The name of the created storage pool'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for creating the storage pool'),
  },
};

// Delete Storage Pool Tool
export const deleteStoragePoolTool: ToolConfig = {
  name: 'gcnv_storage_pool_delete',
  title: 'Delete Storage Pool',
  description: 'Deletes a storage pool in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the storage pool'),
    storagePoolId: z.string().describe('The ID of the storage pool to delete'),
    force: z.boolean().optional().describe('Force deletion even if the pool contains resources'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Storage Pool Tool
export const getStoragePoolTool: ToolConfig = {
  name: 'gcnv_storage_pool_get',
  title: 'Get Storage Pool',
  description: 'Gets details of a specific storage pool',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the storage pool'),
    storagePoolId: z.string().describe('The ID of the storage pool to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the storage pool'),
    storagePoolId: z.string().describe('The ID of the storage pool'),
    serviceLevel: z.string().describe('The service level of the storage pool'),
    capacityGib: z.number().describe('The capacity of the storage pool in GiB'),
    volumeCapacityGib: z.number().describe('The total volume capacity in GiB'),
    volumecount: z.number().describe('The number of volumes in the storage pool'),
    state: z.string().describe('The current state of the storage pool'),
    createTime: z.date().describe('The timestamp when the storage pool was created'),
    description: z.string().optional().describe('The description of the storage pool'),
    labels: z.record(z.string()).optional().describe('Labels applied to the storage pool'),
    network: z.string().optional().describe('The VPC network used by the storage pool'),
    activeDirectory: z
      .string()
      .optional()
      .describe('The Active Directory policy attached to SMB volumes'),
    kmsConfig: z.string().optional().describe('The CMEK KMS config applied to the pool'),
    encryptionType: z.string().optional().describe('The encryption type configured for the pool'),
    ldapEnabled: z.boolean().optional().describe('Whether LDAP is enabled for NFS volume access'),
    customPerformanceEnabled: z
      .boolean()
      .optional()
      .describe('Whether Flex custom performance is enabled for the pool'),
    totalThroughputMibps: z
      .number()
      .optional()
      .describe('Total throughput in MiBps for the pool (Flex custom performance)'),
    qosType: z.string().optional().describe('The QoS type configured for the storage pool'),
    allowAutoTiering: z
      .boolean()
      .optional()
      .describe('Whether auto-tiering is enabled for the pool'),
    storagePoolType: z
      .union([z.string(), z.number()])
      .optional()
      .describe('Storage pool type (StoragePoolType)'),
    zone: z.string().optional().describe('Zone for the storage pool'),
    replicaZone: z.string().optional().describe('Replica zone for the storage pool'),
  },
};

// List Storage Pools Tool
export const listStoragePoolsTool: ToolConfig = {
  name: 'gcnv_storage_pool_list',
  title: 'List Storage Pools',
  description:
    'Lists all storage pools in the specified project and location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list storage pools from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    pageSize: z.number().optional().describe('The maximum number of storage pools to return'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    storagePools: z
      .array(
        z.object({
          name: z.string().describe('The name of the storage pool'),
          storagePoolId: z.string().describe('The ID of the storage pool'),
          serviceLevel: z.string().describe('The service level of the storage pool'),
          capacityGib: z.number().describe('The capacity of the storage pool in GiB'),
          volumeCapacityGib: z.number().describe('The total volume capacity in GiB'),
          volumecount: z.number().describe('The number of volumes in the storage pool'),
          state: z.string().describe('The current state of the storage pool'),
          createTime: z.date().describe('The timestamp when the storage pool was created'),
          description: z.string().optional().describe('The description of the storage pool'),
          labels: z.record(z.string()).optional().describe('Labels applied to the storage pool'),
          network: z.string().optional().describe('The VPC network used by the storage pool'),
          activeDirectory: z
            .string()
            .optional()
            .describe('The Active Directory policy attached to SMB volumes'),
          kmsConfig: z.string().optional().describe('The CMEK KMS config applied to the pool'),
          encryptionType: z
            .string()
            .optional()
            .describe('The encryption type configured for the pool'),
          ldapEnabled: z
            .boolean()
            .optional()
            .describe('Whether LDAP is enabled for NFS volume access'),
          customPerformanceEnabled: z
            .boolean()
            .optional()
            .describe('Whether Flex custom performance is enabled for the pool'),
          totalThroughputMibps: z
            .number()
            .optional()
            .describe('Total throughput in MiBps for the pool (Flex custom performance)'),
          qosType: z.string().optional().describe('The QoS type configured for the storage pool'),
          allowAutoTiering: z
            .boolean()
            .optional()
            .describe('Whether auto-tiering is enabled for the pool'),
          storagePoolType: z
            .union([z.string(), z.number()])
            .optional()
            .describe('Storage pool type (StoragePoolType)'),
          zone: z.string().optional().describe('Zone for the storage pool'),
          replicaZone: z.string().optional().describe('Replica zone for the storage pool'),
        })
      )
      .describe('List of storage pools'),
    nextPageToken: z.string().optional().describe('Token to retrieve the next page of results'),
  },
};

// Update Storage Pool Tool
export const updateStoragePoolTool: ToolConfig = {
  name: 'gcnv_storage_pool_update',
  title: 'Update Storage Pool',
  description: 'Updates a storage pool in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the storage pool'),
    storagePoolId: z.string().describe('The ID of the storage pool to update'),
    capacityGib: z.number().optional().describe('The new capacity of the storage pool in GiB'),
    description: z.string().optional().describe('New description of the storage pool'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the storage pool'),
    qosType: z
      .union([z.enum(['AUTO', 'MANUAL']), z.enum(['auto', 'manual'])])
      .optional()
      .describe(
        'QoS type for the storage pool (AUTO or MANUAL). Manual QoS is supported for Standard/Premium/Extreme; not supported for Flex.'
      ),
    storagePoolType: z
      .union([
        z.enum(['STORAGE_POOL_TYPE_UNSPECIFIED', 'FILE', 'UNIFIED', 'UNIFIED_LARGE_CAPACITY']),
        z.enum(['storage_pool_type_unspecified', 'file', 'unified', 'unified_large_capacity']),
        z.number(),
      ])
      .optional()
      .describe(
        'Storage pool type (StoragePoolType). UNIFIED and UNIFIED_LARGE_CAPACITY are only available for FLEX service level.'
      ),
    zone: z
      .string()
      .optional()
      .describe(
        'Zone for the storage pool (FLEX pools may require zone + replicaZone when location is a region)'
      ),
    replicaZone: z
      .string()
      .optional()
      .describe(
        'Replica zone for the storage pool (FLEX pools may require when location is a region)'
      ),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated storage pool'),
    operationId: z
      .string()
      .optional()
      .describe('The ID of the long-running operation for updating the storage pool'),
  },
};

// Validate Directory Service Tool
export const validateDirectoryServiceTool: ToolConfig = {
  name: 'gcnv_storage_pool_validate_directory_service',
  title: 'Validate Directory Service',
  description: 'Validates directory service policy attached to a storage pool',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the storage pool'),
    storagePoolId: z.string().describe('The ID of the storage pool'),
    directoryServiceType: z
      .enum(['ACTIVE_DIRECTORY', 'LDAP'])
      .describe('Type of directory service policy attached to the storage pool'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the validation was successful'),
    operationId: z
      .string()
      .describe('The ID of the long-running operation for validating directory service'),
  },
};

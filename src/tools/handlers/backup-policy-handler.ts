import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import {
  createBackupPolicyTool,
  deleteBackupPolicyTool,
  getBackupPolicyTool,
  listBackupPoliciesTool,
  updateBackupPolicyTool,
} from '../backup-policy-tools.js';

// Define interface for backup policy
interface BackupPolicy {
  dailyBackupLimit?: number;
  weeklyBackupLimit?: number;
  monthlyBackupLimit?: number;
  description?: string;
  enabled?: boolean;
  labels?: Record<string, string>;
  name?: string;
  [key: string]: any; // Index signature to allow dynamic access
}

import { ToolHandler } from '../../types/tool.js';

/**
 * Creates a new backup policy
 */
export const createBackupPolicyHandler: ToolHandler = async (args) => {
  try {
    const {
      projectId,
      location,
      backupPolicyId,
      dailyBackupLimit,
      weeklyBackupLimit,
      monthlyBackupLimit,
      description,
      enabled,
      labels,
    } = args;

    const client = NetAppClientFactory.createClient();

    // Format resource name
    const parent = `projects/${projectId}/locations/${location}`;

    // Build backup policy
    const backupPolicy: BackupPolicy = {
      dailyBackupLimit,
      weeklyBackupLimit,
      monthlyBackupLimit,
      description,
      enabled,
      labels,
    };

    // Filter out undefined properties
    Object.keys(backupPolicy).forEach((key) => {
      if (backupPolicy[key] === undefined) {
        delete backupPolicy[key];
      }
    });

    // Call the API to create a backup policy
    const [operation] = await client.createBackupPolicy({
      parent,
      backupPolicy,
      backupPolicyId,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created backup policy: ${backupPolicyId}. Operation ID: ${operation.name}`,
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/backupPolicy/${backupPolicyId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to create backup policy: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Deletes a backup policy
 */
export const deleteBackupPolicyHandler: ToolHandler = async (args) => {
  try {
    const { projectId, location, backupPolicyId } = args;

    const client = NetAppClientFactory.createClient();

    // Format resource name
    const name = `projects/${projectId}/locations/${location}/backupPolicies/${backupPolicyId}`;

    // Call the API to delete a backup policy
    const [operation] = await client.deleteBackupPolicy({
      name,
    });

    const result = {
      success: true,
      operationId: operation.name || '',
    };

    return {
      content: [
        {
          type: 'text',
          text: `Deleted backup policy ${backupPolicyId}. Operation ID: ${result.operationId}`,
        },
      ],
      structuredContent: result,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to delete backup policy: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Gets a backup policy
 */
export const getBackupPolicyHandler: ToolHandler = async (args) => {
  try {
    const { projectId, location, backupPolicyId } = args;

    const client = NetAppClientFactory.createClient();

    // Format resource name
    const name = `projects/${projectId}/locations/${location}/backupPolicies/${backupPolicyId}`;

    // Call the API to get a backup policy
    const [backupPolicy] = await client.getBackupPolicy({ name });

    const result = {
      name: backupPolicy.name || '',
      backupPolicyId: backupPolicy.name?.split('/').pop() || '',
      dailyBackupLimit: backupPolicy.dailyBackupLimit,
      weeklyBackupLimit: backupPolicy.weeklyBackupLimit,
      monthlyBackupLimit: backupPolicy.monthlyBackupLimit,
      description: backupPolicy.description,
      enabled: backupPolicy.enabled || false,
      assignedVolumeCount: backupPolicy.assignedVolumeCount,
      state: backupPolicy.state || 'UNKNOWN',
      createTime: backupPolicy.createTime
        ? new Date(Number((backupPolicy.createTime as any).seconds || 0) * 1000)
        : new Date(),
      labels: backupPolicy.labels,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to get backup policy: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Lists backup policies
 */
export const listBackupPoliciesHandler: ToolHandler = async (args) => {
  try {
    const { projectId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    const client = NetAppClientFactory.createClient();

    // Format resource name (use "-" for all locations)
    const parent = `projects/${projectId}/locations/${location}`;

    // Call the API to list backup policies
    const [response] = await client.listBackupPolicies({
      parent,
      filter,
      pageSize,
      pageToken,
    });

    // Handle API response
    const backupPolicies = Array.isArray(response)
      ? response
      : (response as any).backupPolicies || [];
    const nextPageToken =
      typeof response === 'object' && response !== null
        ? (response as any).nextPageToken || ''
        : '';

    const result = {
      backupPolicies: backupPolicies.map((policy: any) => ({
        name: policy.name || '',
        backupPolicyId: policy.name?.split('/').pop() || '',
        dailyBackupLimit: policy.dailyBackupLimit,
        weeklyBackupLimit: policy.weeklyBackupLimit,
        monthlyBackupLimit: policy.monthlyBackupLimit,
        description: policy.description,
        enabled: policy.enabled || false,
        assignedVolumeCount: policy.assignedVolumeCount,
        state: policy.state || 'UNKNOWN',
        createTime: policy.createTime
          ? new Date(Number(policy.createTime.seconds ?? 0) * 1000)
          : undefined,
        labels: policy.labels,
      })),
      nextPageToken: nextPageToken,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { backupPolicies: backupPolicies, nextPageToken: nextPageToken },
            null,
            2
          ),
        },
      ],
      structuredContent: result,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to list backup policies: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Updates a backup policy
 */
export const updateBackupPolicyHandler: ToolHandler = async (args) => {
  try {
    const {
      projectId,
      location,
      backupPolicyId,
      dailyBackupLimit,
      weeklyBackupLimit,
      monthlyBackupLimit,
      description,
      enabled,
      labels,
    } = args;

    const client = NetAppClientFactory.createClient();

    // Format resource name
    const name = `projects/${projectId}/locations/${location}/backupPolicies/${backupPolicyId}`;

    // Build backup policy update
    const backupPolicy: BackupPolicy = {
      name,
      dailyBackupLimit,
      weeklyBackupLimit,
      monthlyBackupLimit,
      description,
      enabled,
      labels,
    };

    // Filter out undefined properties
    Object.keys(backupPolicy).forEach((key) => {
      if (backupPolicy[key] === undefined) {
        delete backupPolicy[key];
      }
    });

    // Create an update mask based on the provided fields
    const updateMask = {
      paths: Object.keys(backupPolicy).filter((key) => key !== 'name'),
    };

    // Call the API to update a backup policy
    const [operation] = await client.updateBackupPolicy({
      backupPolicy,
      updateMask,
    });

    const result = {
      name: operation.metadata ? (operation.metadata as any).target || '' : '',
      operationId: operation.name || '',
    };

    return {
      content: [
        {
          type: 'text',
          text: `Updated backup policy: ${result.name}. Operation ID: ${result.operationId}`,
        },
      ],
      structuredContent: result,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to update backup policy: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};

// Export tool handler mappings
export const backupPolicyHandlers = {
  [createBackupPolicyTool.name]: createBackupPolicyHandler,
  [deleteBackupPolicyTool.name]: deleteBackupPolicyHandler,
  [getBackupPolicyTool.name]: getBackupPolicyHandler,
  [listBackupPoliciesTool.name]: listBackupPoliciesHandler,
  [updateBackupPolicyTool.name]: updateBackupPolicyHandler,
};

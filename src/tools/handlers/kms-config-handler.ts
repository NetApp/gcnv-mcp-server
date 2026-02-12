import { ToolHandler } from '../../types/tool.js';
import { z } from 'zod';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { getKmsConfigTool, listKmsConfigsTool } from '../kms-config-tools.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'kms-config-handler' });

const getKmsConfigOutputSchema = z.object(getKmsConfigTool.outputSchema);
const listKmsConfigsOutputSchema = z.object(listKmsConfigsTool.outputSchema);

// Helper to format KMS config data
function formatKmsConfigData(config: any): any {
  const result: any = {};

  if (!config) return result;

  if (config.name) {
    const nameParts = config.name.split('/');
    result.name = config.name;
    result.kmsConfigId = nameParts[nameParts.length - 1];
  }

  if (config.cryptoKeyName) result.cryptoKeyName = config.cryptoKeyName;
  if (config.state) result.state = config.state;
  if (config.stateDetails) result.stateDetails = config.stateDetails;
  if (config.instructions) result.instructions = config.instructions;
  if (config.serviceAccount) result.serviceAccount = config.serviceAccount;

  if (config.createTime) {
    result.createTime = new Date(config.createTime.seconds * 1000);
  }

  if (config.description) result.description = config.description;
  if (config.labels) result.labels = config.labels;

  return result;
}

// Create KMS Config Handler
export const createKmsConfigHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, kmsConfigId, cryptoKeyName, description, labels } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const parent = `projects/${projectId}/locations/${location}`;

    const kmsConfig: any = {};
    if (cryptoKeyName) kmsConfig.cryptoKeyName = cryptoKeyName;
    if (description) kmsConfig.description = description;
    if (labels) kmsConfig.labels = labels;

    const request = {
      parent,
      kmsConfigId,
      kmsConfig,
    };

    log.info({ request }, 'Create KMS Config request');
    const [operation] = await netAppClient.createKmsConfig(request);
    log.info({ operation }, 'Create KMS Config operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating KMS config');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating KMS config: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete KMS Config Handler
export const deleteKmsConfigHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, kmsConfigId } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`;

    const [operation] = await netAppClient.deleteKmsConfig({ name });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `KMS config ${kmsConfigId} deletion requested`,
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
    log.error({ err: error }, 'Error deleting KMS config');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting KMS config: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Get KMS Config Handler
export const getKmsConfigHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, kmsConfigId } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`;

    const [kmsConfig] = await netAppClient.getKmsConfig({ name });
    const formatted = formatKmsConfigData(kmsConfig);

    const structuredContent = getKmsConfigOutputSchema.parse(formatted);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(structuredContent, null, 2),
        },
      ],
      structuredContent,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting KMS config');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting KMS config: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List KMS Configs Handler
export const listKmsConfigsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, filter, pageSize, pageToken, orderBy } = args;
    const location = args.location ?? '-';

    const netAppClient = NetAppClientFactory.createClient();
    const parent = `projects/${projectId}/locations/${location}`;

    const request: any = { parent };
    if (filter) request.filter = filter;
    if (pageSize) request.pageSize = pageSize;
    if (pageToken) request.pageToken = pageToken;
    if (orderBy) request.orderBy = orderBy;

    const [kmsConfigs, , response] = await netAppClient.listKmsConfigs(request);
    const structuredContent = listKmsConfigsOutputSchema.parse({
      kmsConfigs: kmsConfigs.map(formatKmsConfigData),
      nextPageToken: response?.nextPageToken,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(structuredContent, null, 2),
        },
      ],
      structuredContent,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing KMS configs');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing KMS configs: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update KMS Config Handler
export const updateKmsConfigHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, kmsConfigId, cryptoKeyName, description, labels } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`;

    const updateMask: string[] = [];
    const kmsConfig: any = { name };

    if (cryptoKeyName !== undefined) {
      kmsConfig.cryptoKeyName = cryptoKeyName;
      updateMask.push('crypto_key_name');
    }
    if (description !== undefined) {
      kmsConfig.description = description;
      updateMask.push('description');
    }
    if (labels !== undefined) {
      kmsConfig.labels = labels;
      updateMask.push('labels');
    }

    const request = {
      kmsConfig,
      updateMask: { paths: updateMask },
    };

    log.info({ request }, 'Update KMS Config request');
    const [operation] = await netAppClient.updateKmsConfig(request);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `KMS config ${kmsConfigId} update requested`,
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
    log.error({ err: error }, 'Error updating KMS config');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating KMS config: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Verify KMS Config Handler
export const verifyKmsConfigHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, kmsConfigId } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`;

    const [response] = await netAppClient.verifyKmsConfig({ name });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
      structuredContent: {
        reachable: response.healthy,
        healthError: response.healthError,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error verifying KMS config');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error verifying KMS config: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Encrypt Volumes Handler
export const encryptVolumesHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, kmsConfigId } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}/kmsConfigs/${kmsConfigId}`;

    const [operation] = await netAppClient.encryptVolumes({ name });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Volume encryption initiated for KMS config ${kmsConfigId}`,
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
    log.error({ err: error }, 'Error encrypting volumes');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error encrypting volumes: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

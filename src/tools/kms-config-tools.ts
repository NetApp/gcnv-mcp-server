import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create KMS Config Tool
export const createKmsConfigTool: ToolConfig = {
  name: 'gcnv_kms_config_create',
  title: 'Create KMS Config',
  description: 'Creates a new KMS (Key Management Service) configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the KMS config should be created'),
    kmsConfigId: z.string().describe('The ID to assign to the KMS config'),
    cryptoKeyName: z.string().describe('The full name of the crypto key'),
    description: z.string().optional().describe('Optional description'),
    labels: z.record(z.string()).optional().describe('Optional labels'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created KMS config'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

// Delete KMS Config Tool
export const deleteKmsConfigTool: ToolConfig = {
  name: 'gcnv_kms_config_delete',
  title: 'Delete KMS Config',
  description: 'Deletes a KMS configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the KMS config'),
    kmsConfigId: z.string().describe('The ID of the KMS config to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get KMS Config Tool
export const getKmsConfigTool: ToolConfig = {
  name: 'gcnv_kms_config_get',
  title: 'Get KMS Config',
  description: 'Gets details of a specific KMS configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the KMS config'),
    kmsConfigId: z.string().describe('The ID of the KMS config to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the KMS config'),
    kmsConfigId: z.string().describe('The ID of the KMS config'),
    cryptoKeyName: z.string().optional().describe('The name of the crypto key'),
    state: z
      .string()
      .optional()
      .describe('The current state (e.g., READY, KEY_CHECK_PENDING—run instructions if pending)'),
    instructions: z
      .string()
      .optional()
      .describe('Steps to grant the service account access when state is KEY_CHECK_PENDING'),
    stateDetails: z
      .string()
      .optional()
      .describe('Additional state details when the KMS config is not ready'),
    createTime: z.date().optional().describe('The creation timestamp'),
    description: z.string().optional().describe('Description'),
    labels: z.record(z.string()).optional().describe('Labels'),
    serviceAccount: z
      .string()
      .optional()
      .describe('Service account used by NetApp to access the KMS key'),
  },
};

// List KMS Configs Tool
export const listKmsConfigsTool: ToolConfig = {
  name: 'gcnv_kms_config_list',
  title: 'List KMS Configs',
  description:
    'Lists all KMS configurations in the specified location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list KMS configs from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression'),
    pageSize: z.number().optional().describe('Maximum number of items to return'),
    pageToken: z.string().optional().describe('Page token from previous request'),
    orderBy: z.string().optional().describe('Sort order'),
  },
  outputSchema: {
    kmsConfigs: z
      .array(
        z.object({
          name: z.string().describe('The name of the KMS config'),
          kmsConfigId: z.string().describe('The ID of the KMS config'),
          cryptoKeyName: z.string().optional().describe('The name of the crypto key'),
          state: z
            .string()
            .optional()
            .describe('The current state (e.g., READY, KEY_CHECK_PENDING)'),
          stateDetails: z
            .string()
            .optional()
            .describe('Additional state details when the KMS config is not ready'),
          createTime: z.date().optional().describe('The creation timestamp'),
          description: z.string().optional().describe('Description'),
          labels: z.record(z.string()).optional().describe('Labels'),
          serviceAccount: z
            .string()
            .optional()
            .describe('Service account used by NetApp to access the KMS key'),
        })
      )
      .describe('List of KMS configs'),
    nextPageToken: z.string().optional().describe('Token for next page'),
  },
};

// Update KMS Config Tool
export const updateKmsConfigTool: ToolConfig = {
  name: 'gcnv_kms_config_update',
  title: 'Update KMS Config',
  description: 'Updates a KMS configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the KMS config'),
    kmsConfigId: z.string().describe('The ID of the KMS config to update'),
    cryptoKeyName: z.string().optional().describe('The name of the crypto key'),
    description: z.string().optional().describe('New description'),
    labels: z.record(z.string()).optional().describe('New labels'),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated KMS config'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

// Verify KMS Config Tool
export const verifyKmsConfigTool: ToolConfig = {
  name: 'gcnv_kms_config_verify',
  title: 'Verify KMS Config',
  description:
    'Verifies KMS config reachability after granting CMEK permissions; typically run after following the instructions returned by gcnv_kms_config_get when state is KEY_CHECK_PENDING',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the KMS config'),
    kmsConfigId: z.string().describe('The ID of the KMS config to verify'),
  },
  outputSchema: {
    reachable: z.boolean().optional().describe('Whether the KMS config is reachable'),
    healthError: z.string().optional().describe('Health error if any'),
  },
};

// Encrypt Volumes Tool
export const encryptVolumesTool: ToolConfig = {
  name: 'gcnv_kms_config_encrypt_volumes',
  title: 'Encrypt Volumes',
  description: 'Encrypts existing volumes without CMEK encryption with the desired KMS config',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the KMS config'),
    kmsConfigId: z.string().describe('The ID of the KMS config to use for encryption'),
  },
  outputSchema: {
    name: z.string().describe('The name of the KMS config'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

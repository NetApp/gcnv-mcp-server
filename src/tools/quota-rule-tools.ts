import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Quota Rule Tool
export const createQuotaRuleTool: ToolConfig = {
  name: 'gcnv_quota_rule_create',
  title: 'Create Quota Rule',
  description: 'Creates a new quota rule for a volume',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume'),
    quotaRuleId: z.string().describe('The ID to assign to the quota rule'),
    target: z.string().describe('The POSIX user/group this rule targets'),
    // Accept either enum name or numeric value
    quotaType: z
      .union([
        z.enum([
          'TYPE_UNSPECIFIED',
          'INDIVIDUAL_USER_QUOTA',
          'INDIVIDUAL_GROUP_QUOTA',
          'DEFAULT_USER_QUOTA',
          'DEFAULT_GROUP_QUOTA',
        ]),
        z.number(),
      ])
      .describe('Quota rule type (enum name or number)'),
    // Temporary alias to allow callers to pass 'type' directly
    type: z
      .union([
        z.enum([
          'TYPE_UNSPECIFIED',
          'INDIVIDUAL_USER_QUOTA',
          'INDIVIDUAL_GROUP_QUOTA',
          'DEFAULT_USER_QUOTA',
          'DEFAULT_GROUP_QUOTA',
        ]),
        z.number(),
      ])
      .optional()
      .describe('Quota rule type (enum name or number)'),
    diskLimitMib: z.number().describe('Quota size in MiB'),
    description: z.string().optional().describe('Optional description'),
    labels: z.record(z.string()).optional().describe('Optional labels'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created quota rule'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

// Delete Quota Rule Tool
export const deleteQuotaRuleTool: ToolConfig = {
  name: 'gcnv_quota_rule_delete',
  title: 'Delete Quota Rule',
  description: 'Deletes a quota rule',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume'),
    quotaRuleId: z.string().describe('The ID of the quota rule to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Quota Rule Tool
export const getQuotaRuleTool: ToolConfig = {
  name: 'gcnv_quota_rule_get',
  title: 'Get Quota Rule',
  description: 'Gets details of a specific quota rule',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume'),
    quotaRuleId: z.string().describe('The ID of the quota rule to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the quota rule'),
    quotaRuleId: z.string().describe('The ID of the quota rule'),
    target: z.string().optional().describe('The POSIX user/group this rule targets'),
    quotaType: z.number().optional().describe('Type of quota rule (enum number)'),
    type: z.number().optional().describe('Type of quota rule (enum number)'),
    diskLimitMib: z.number().optional().describe('Quota size in MiB'),
    state: z.string().optional().describe('The current state'),
    createTime: z.date().optional().describe('The creation timestamp'),
    description: z.string().optional().describe('Description'),
    labels: z.record(z.string()).optional().describe('Labels'),
  },
};

// List Quota Rules Tool
export const listQuotaRulesTool: ToolConfig = {
  name: 'gcnv_quota_rule_list',
  title: 'List Quota Rules',
  description: 'Lists all quota rules for a volume (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location of the volume; omit or use "-" for all locations'),
    volumeId: z.string().describe('The ID of the volume'),
    filter: z.string().optional().describe('Filter expression'),
    pageSize: z.number().optional().describe('Maximum number of items to return'),
    pageToken: z.string().optional().describe('Page token from previous request'),
    orderBy: z.string().optional().describe('Sort order'),
  },
  outputSchema: {
    quotaRules: z
      .array(
        z.object({
          name: z.string().describe('The name of the quota rule'),
          quotaRuleId: z.string().describe('The ID of the quota rule'),
          target: z.string().optional().describe('The POSIX user/group this rule targets'),
          quotaType: z.number().optional().describe('Type of quota rule (enum number)'),
          type: z.number().optional().describe('Type of quota rule (enum number)'),
          diskLimitMib: z.number().optional().describe('Quota size in MiB'),
          state: z.string().optional().describe('The current state'),
          createTime: z.date().optional().describe('The creation timestamp'),
          description: z.string().optional().describe('Description'),
          labels: z.record(z.string()).optional().describe('Labels'),
        })
      )
      .describe('List of quota rules'),
    nextPageToken: z.string().optional().describe('Token for next page'),
  },
};

// Update Quota Rule Tool
export const updateQuotaRuleTool: ToolConfig = {
  name: 'gcnv_quota_rule_update',
  title: 'Update Quota Rule',
  description: 'Updates a quota rule',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the volume'),
    volumeId: z.string().describe('The ID of the volume'),
    quotaRuleId: z.string().describe('The ID of the quota rule to update'),
    target: z.string().optional().describe('The POSIX user/group this rule targets'),
    quotaType: z
      .union([
        z.enum([
          'TYPE_UNSPECIFIED',
          'INDIVIDUAL_USER_QUOTA',
          'INDIVIDUAL_GROUP_QUOTA',
          'DEFAULT_USER_QUOTA',
          'DEFAULT_GROUP_QUOTA',
        ]),
        z.number(),
      ])
      .optional()
      .describe('Type of quota rule (enum name or number)'),
    type: z
      .union([
        z.enum([
          'TYPE_UNSPECIFIED',
          'INDIVIDUAL_USER_QUOTA',
          'INDIVIDUAL_GROUP_QUOTA',
          'DEFAULT_USER_QUOTA',
          'DEFAULT_GROUP_QUOTA',
        ]),
        z.number(),
      ])
      .optional()
      .describe('Type of quota rule (enum name or number)'),
    diskLimitMib: z.number().optional().describe('Quota size in MiB'),
    description: z.string().optional().describe('New description'),
    labels: z.record(z.string()).optional().describe('New labels'),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated quota rule'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Get Host Group Tool
export const getHostGroupTool: ToolConfig = {
  name: 'gcnv_host_group_get',
  title: 'Get Host Group',
  description: 'Gets details of a specific host group',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the host group'),
    hostGroupId: z.string().describe('The ID of the host group to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the host group'),
    hostGroupId: z.string().describe('The ID of the host group'),
    type: z.union([z.string(), z.number()]).optional().describe('Host group type (enum)'),
    state: z.union([z.string(), z.number()]).optional().describe('Host group state (enum)'),
    createTime: z.date().optional().describe('The creation time of the host group'),
    hosts: z.array(z.string()).optional().describe('List of hosts/initiators in the group'),
    osType: z.union([z.string(), z.number()]).optional().describe('OS type (enum)'),
    description: z.string().optional().describe('Description of the host group'),
    labels: z.record(z.string()).optional().describe('Labels applied to the host group'),
  },
};

// List Host Groups Tool
export const listHostGroupsTool: ToolConfig = {
  name: 'gcnv_host_group_list',
  title: 'List Host Groups',
  description: 'Lists host groups in a specific location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list host groups from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression for filtering results'),
    orderBy: z.string().optional().describe('Order by expression'),
    pageSize: z.number().optional().describe('Maximum number of host groups to return per page'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    hostGroups: z
      .array(
        z.object({
          name: z.string().describe('The fully qualified name of the host group'),
          hostGroupId: z.string().describe('The ID of the host group'),
          type: z.union([z.string(), z.number()]).optional().describe('Host group type (enum)'),
          state: z.union([z.string(), z.number()]).optional().describe('Host group state (enum)'),
          createTime: z.date().optional().describe('The creation time of the host group'),
          hosts: z.array(z.string()).optional().describe('List of hosts/initiators in the group'),
          osType: z.union([z.string(), z.number()]).optional().describe('OS type (enum)'),
          description: z.string().optional().describe('Description of the host group'),
          labels: z.record(z.string()).optional().describe('Labels applied to the host group'),
        })
      )
      .describe('List of host groups'),
    nextPageToken: z.string().optional().describe('Token for fetching the next page'),
  },
};

// Create Host Group Tool
export const createHostGroupTool: ToolConfig = {
  name: 'gcnv_host_group_create',
  title: 'Create Host Group',
  description: 'Creates a new host group in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the host group should be created'),
    hostGroupId: z.string().describe('The ID to assign to the host group'),
    type: z
      .union([
        z.enum(['TYPE_UNSPECIFIED', 'ISCSI_INITIATOR']),
        z.enum(['type_unspecified', 'iscsi_initiator']),
        z.number(),
      ])
      .describe('Host group type'),
    osType: z
      .union([
        z.enum(['OS_TYPE_UNSPECIFIED', 'LINUX', 'WINDOWS', 'ESXI']),
        z.enum(['os_type_unspecified', 'linux', 'windows', 'esxi']),
        z.number(),
      ])
      .describe('OS type for initiators in this host group'),
    hosts: z.array(z.string()).min(1).describe('List of initiators/hosts to include in the group'),
    description: z.string().optional().describe('Optional description of the host group'),
    labels: z.record(z.string()).optional().describe('Optional labels to apply to the host group'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created host group'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

// Update Host Group Tool
export const updateHostGroupTool: ToolConfig = {
  name: 'gcnv_host_group_update',
  title: 'Update Host Group',
  description: 'Updates a host group (partial update using updateMask)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the host group'),
    hostGroupId: z.string().describe('The ID of the host group to update'),
    type: z
      .union([
        z.enum(['TYPE_UNSPECIFIED', 'ISCSI_INITIATOR']),
        z.enum(['type_unspecified', 'iscsi_initiator']),
        z.number(),
      ])
      .optional()
      .describe('Host group type'),
    osType: z
      .union([
        z.enum(['OS_TYPE_UNSPECIFIED', 'LINUX', 'WINDOWS', 'ESXI']),
        z.enum(['os_type_unspecified', 'linux', 'windows', 'esxi']),
        z.number(),
      ])
      .optional()
      .describe('OS type for initiators in this host group'),
    hosts: z.array(z.string()).optional().describe('New list of initiators/hosts'),
    description: z.string().optional().describe('New description of the host group'),
    labels: z.record(z.string()).optional().describe('New labels to apply to the host group'),
  },
  outputSchema: {
    name: z.string().describe('The fully qualified name of the host group'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

// Delete Host Group Tool
export const deleteHostGroupTool: ToolConfig = {
  name: 'gcnv_host_group_delete',
  title: 'Delete Host Group',
  description: 'Deletes a host group in the specified project and location',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the host group'),
    hostGroupId: z.string().describe('The ID of the host group to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion request was submitted successfully'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

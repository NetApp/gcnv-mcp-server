import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Create Active Directory Tool
export const createActiveDirectoryTool: ToolConfig = {
  name: 'gcnv_active_directory_create',
  title: 'Create Active Directory',
  description: 'Creates a new active directory configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location where the active directory should be created'),
    activeDirectoryId: z.string().describe('The ID to assign to the active directory'),
    domain: z.string().optional().describe('Domain name'),
    site: z.string().optional().describe('Site name'),
    dns: z.string().optional().describe('DNS server address'),
    netBiosPrefix: z.string().optional().describe('NetBIOS prefix'),
    organizationalUnit: z.string().optional().describe('Organizational unit'),
    aesEncryption: z.boolean().optional().describe('Enable AES encryption'),
    username: z.string().optional().describe('Username for domain join'),
    password: z.string().optional().describe('Password for domain join'),
    backupOperators: z.array(z.string()).optional().describe('List of backup operators'),
    administrators: z
      .array(z.string())
      .optional()
      .describe('Users to be added to the Built-in Administrators group'),
    securityOperators: z.array(z.string()).optional().describe('List of security operators'),
    kdcHostname: z.string().optional().describe('KDC hostname'),
    kdcIp: z.string().optional().describe('KDC IP address'),
    nfsUsersWithLdap: z.boolean().optional().describe('Enable NFS users with LDAP'),
    description: z.string().optional().describe('Optional description'),
    labels: z.record(z.string()).optional().describe('Optional labels'),
  },
  outputSchema: {
    name: z.string().describe('The name of the created active directory'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

// Delete Active Directory Tool
export const deleteActiveDirectoryTool: ToolConfig = {
  name: 'gcnv_active_directory_delete',
  title: 'Delete Active Directory',
  description: 'Deletes an active directory configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the active directory'),
    activeDirectoryId: z.string().describe('The ID of the active directory to delete'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the deletion was successful'),
    operationId: z.string().optional().describe('The ID of the long-running operation'),
  },
};

// Get Active Directory Tool
export const getActiveDirectoryTool: ToolConfig = {
  name: 'gcnv_active_directory_get',
  title: 'Get Active Directory',
  description: 'Gets details of a specific active directory',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the active directory'),
    activeDirectoryId: z.string().describe('The ID of the active directory to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the active directory'),
    activeDirectoryId: z.string().describe('The ID of the active directory'),
    domain: z.string().optional().describe('Domain name'),
    site: z.string().optional().describe('Site name'),
    dns: z.string().optional().describe('DNS server address'),
    state: z.string().optional().describe('The current state'),
    createTime: z.date().optional().describe('The creation timestamp'),
    description: z.string().optional().describe('Description'),
    labels: z.record(z.string()).optional().describe('Labels'),
  },
};

// List Active Directories Tool
export const listActiveDirectoriesTool: ToolConfig = {
  name: 'gcnv_active_directory_list',
  title: 'List Active Directories',
  description:
    'Lists all active directories in the specified location (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list active directories from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression'),
    pageSize: z.number().optional().describe('Maximum number of items to return'),
    pageToken: z.string().optional().describe('Page token from previous request'),
  },
  outputSchema: {
    activeDirectories: z
      .array(
        z.object({
          name: z.string().describe('The name of the active directory'),
          activeDirectoryId: z.string().describe('The ID of the active directory'),
          domain: z.string().optional().describe('Domain name'),
          site: z.string().optional().describe('Site name'),
          state: z.string().optional().describe('The current state'),
          createTime: z.date().optional().describe('The creation timestamp'),
        })
      )
      .describe('List of active directories'),
    nextPageToken: z.string().optional().describe('Token for next page'),
  },
};

// Update Active Directory Tool
export const updateActiveDirectoryTool: ToolConfig = {
  name: 'gcnv_active_directory_update',
  title: 'Update Active Directory',
  description: 'Updates an active directory configuration',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z.string().describe('The location of the active directory'),
    activeDirectoryId: z.string().describe('The ID of the active directory to update'),
    domain: z.string().optional().describe('Domain name'),
    site: z.string().optional().describe('Site name'),
    dns: z.string().optional().describe('DNS server address'),
    netBiosPrefix: z.string().optional().describe('NetBIOS prefix'),
    organizationalUnit: z.string().optional().describe('Organizational unit'),
    aesEncryption: z.boolean().optional().describe('Enable AES encryption'),
    username: z.string().optional().describe('Username for domain join'),
    password: z.string().optional().describe('Password for domain join'),
    backupOperators: z.array(z.string()).optional().describe('List of backup operators'),
    administrators: z
      .array(z.string())
      .optional()
      .describe('Users to be added to the Built-in Administrators group'),
    securityOperators: z.array(z.string()).optional().describe('List of security operators'),
    kdcHostname: z.string().optional().describe('KDC hostname'),
    kdcIp: z.string().optional().describe('KDC IP address'),
    nfsUsersWithLdap: z.boolean().optional().describe('Enable NFS users with LDAP'),
    description: z.string().optional().describe('New description'),
    labels: z.record(z.string()).optional().describe('New labels'),
  },
  outputSchema: {
    name: z.string().describe('The name of the updated active directory'),
    operationId: z.string().describe('The ID of the long-running operation'),
  },
};

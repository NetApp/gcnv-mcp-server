import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

// Get Operation Tool
export const getOperationTool: ToolConfig = {
  name: 'gcnv_operation_get',
  title: 'Get Operation',
  description: 'Get details of a long-running operation by its ID',
  inputSchema: {
    operationName: z.string().describe('The full name of the operation to retrieve'),
  },
  outputSchema: {
    name: z.string().describe('The name of the operation'),
    done: z.boolean().describe('Whether the operation is complete'),
    success: z.boolean().describe('True when done is true; done determines the final result'),
    metadata: z.record(z.any()).optional().describe('Metadata about the operation'),
    error: z.record(z.any()).optional().describe('Error details if the operation failed'),
    response: z.record(z.any()).optional().describe('The response if the operation succeeded'),
    createTime: z.string().optional().describe('When the operation was created'),
    target: z.string().optional().describe('The target resource of the operation'),
    verb: z.string().optional().describe('The operation verb (create, update, delete)'),
    statusMessage: z.string().optional().describe('Current status message of the operation'),
    cancelRequested: z.boolean().optional().describe('Whether cancellation was requested'),
    apiVersion: z.string().optional().describe('API version used for the operation'),
  },
};

// Cancel Operation Tool
export const cancelOperationTool: ToolConfig = {
  name: 'gcnv_operation_cancel',
  title: 'Cancel Operation',
  description: 'Cancels a long-running operation that is still in progress',
  inputSchema: {
    operationName: z.string().describe('The full name of the operation to cancel'),
  },
  outputSchema: {
    success: z.boolean().describe('Whether the cancellation request was successful'),
    message: z.string().describe('Status message about the cancellation attempt'),
  },
};

// List Operations Tool
export const listOperationsTool: ToolConfig = {
  name: 'gcnv_operation_list',
  title: 'List Operations',
  description:
    'Lists all active long-running operations in the project (omit location for all locations)',
  inputSchema: {
    projectId: z.string().describe('The ID of the Google Cloud project'),
    location: z
      .string()
      .optional()
      .describe('The location to list operations from; omit or use "-" for all locations'),
    filter: z.string().optional().describe('Filter expression for operations'),
    pageSize: z.number().optional().describe('The maximum number of operations to return'),
    pageToken: z.string().optional().describe('Page token from a previous list request'),
  },
  outputSchema: {
    operations: z
      .array(
        z.object({
          name: z.string().describe('The name of the operation'),
          done: z.boolean().describe('Whether the operation is complete'),
          success: z.boolean().describe('True when done is true; done determines the final result'),
          target: z.string().optional().describe('The target resource of the operation'),
          verb: z.string().optional().describe('The operation verb (create, update, delete)'),
          createTime: z.string().optional().describe('When the operation was created'),
          statusMessage: z.string().optional().describe('Current status message of the operation'),
        })
      )
      .describe('List of operations'),
    nextPageToken: z.string().optional().describe('Token to retrieve the next page of results'),
  },
};

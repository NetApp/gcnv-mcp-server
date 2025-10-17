import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";
import axios from 'axios';

/**
 * Parse metadata from a Google Cloud operation
 * @param operation The operation object
 * @returns Formatted metadata
 */
function parseOperationMetadata(operation: any): Record<string, any> {
    const result: Record<string, any> = {
        name: operation.name || '',
        done: operation.done || false
    };

    // Try to get metadata from the operation
    if (operation.metadata) {
        try {
            // Add metadata as-is to the result
            result.metadata = operation.metadata;
            
            // Try to extract specific fields that might be useful
            const metadata = operation.metadata;
            
            if (metadata.createTime) {
                result.createTime = metadata.createTime;
            }
            
            // These fields might be present depending on the operation type
            if (metadata.target) result.target = metadata.target;
            if (metadata.verb) result.verb = metadata.verb;
            if (metadata.statusMessage) result.statusMessage = metadata.statusMessage;
            if (metadata.apiVersion) result.apiVersion = metadata.apiVersion;
            if (metadata.requestedCancellation !== undefined) {
                result.cancelRequested = metadata.requestedCancellation;
            }
        } catch (err) {
            console.warn("Error parsing operation metadata:", err);
        }
    }
    
    // Add error information if operation failed
    if (operation.done && operation.error) {
        result.error = {
            code: operation.error.code,
            message: operation.error.message
        };
    }
    
    // Add response data if operation succeeded
    if (operation.done && operation.response) {
        result.response = operation.response;
    }

    return result;
}

// Get Operation Handler
export const getOperationHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { operationName } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();
            
            // Make a direct request to the operations API
            // Using the Google API client's credentials
            const auth = (netAppClient as any).auth;
            
            // Make a direct API call using axios
            const response = await axios.request({
                url: `https://netapp.googleapis.com/v1/${operationName}`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            
            const operation = response.data;

            // Parse the operation data
            const formattedResponse = parseOperationMetadata(operation);

            return {
                content: [{
                    type: "text" as const,
                    text: `Retrieved details for operation '${operationName}'.`
                }],
                structuredContent: formattedResponse
            };
        } catch (error: any) {
            console.error("Error getting operation:", error);
            return {
                content: [{
                    type: "text" as const,
                    text: `Error getting operation: ${error.message || 'Unknown error'}`
                }],
                structuredContent: {
                    error: error.message || 'Unknown error'
                }
            };
        }
    };

// Cancel Operation Handler
export const cancelOperationHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { operationName } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();
            
            // Access the auth client to make direct API calls
            const auth = (netAppClient as any).auth;
            
            // First, get the current operation state
            const getResponse = await axios.request({
                url: `https://netapp.googleapis.com/v1/${operationName}`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            
            const operation = getResponse.data as { done: boolean };
            
            // Check if operation is already completed
            if (operation.done) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `Operation '${operationName}' is already completed and cannot be cancelled.`
                    }],
                    structuredContent: {
                        success: false,
                        message: "Operation already completed"
                    }
                };
            }

            // Cancel the operation using direct API call
            await axios.request({
                url: `https://netapp.googleapis.com/v1/${operationName}:cancel`,
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            
            return {
                content: [{
                    type: "text" as const,
                    text: `Successfully requested cancellation of operation '${operationName}'.`
                }],
                structuredContent: {
                    success: true,
                    message: "Cancellation request submitted successfully"
                }
            };
        } catch (error: any) {
            console.error("Error cancelling operation:", error);
            return {
                content: [{
                    type: "text" as const,
                    text: `Error cancelling operation: ${error.message || 'Unknown error'}`
                }],
                structuredContent: {
                    success: false,
                    message: error.message || 'Unknown error'
                }
            };
        }
    };

// List Operations Handler
export const listOperationsHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, filter, pageSize, pageToken } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();
            
            // Make a direct API call using the client's auth credentials
            const auth = (netAppClient as any).auth;
            
            // Build the request parameters
            const params: Record<string, any> = {};
            
            if (filter) params.filter = filter;
            if (pageSize) params.pageSize = pageSize;
            if (pageToken) params.pageToken = pageToken;
            
            // Make the API request
            const response = await axios.request({
                url: `https://netapp.googleapis.com/v1/projects/${projectId}/locations/${location}/operations`,
                method: 'GET',
                params,
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            
            console.log("List Operations Response:", response.data);

            // Type assertion for response data
            const responseData = response.data as { operations?: any[], nextPageToken?: string };
            const operations = responseData.operations || [];
            const nextPageToken = responseData.nextPageToken;
            
            // Format the operations
            const formattedOperations = operations.map((op: any) => {
                const result: any = {
                    name: op.name || '',
                    done: op.done || false
                };
                
                // Extract metadata
                if (op.metadata) {
                    if (op.metadata.createTime) {
                        result.createTime = op.metadata.createTime;
                    }
                    if (op.metadata.target) {
                        result.target = op.metadata.target;
                    }
                    if (op.metadata.verb) {
                        result.verb = op.metadata.verb;
                    }
                    if (op.metadata.statusMessage) {
                        result.statusMessage = op.metadata.statusMessage;
                    }
                }
                
                return result;
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ operations: response.data, nextPageToken: nextPageToken }, null, 2)
                }],
                structuredContent: {
                    operations: formattedOperations,
                    nextPageToken: nextPageToken
                }
            };
        } catch (error: any) {
            console.error("Error listing operations:", error);
            return {
                content: [{
                    type: "text" as const,
                    text: `Error listing operations: ${error.message || 'Unknown error'}`
                }],
                structuredContent: {
                    operations: [],
                    error: error.message || 'Unknown error'
                }
            };
        }
    };
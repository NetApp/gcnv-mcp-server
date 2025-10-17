import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Interface for storage pool network configuration
interface NetworkConfig {
    network?: string;
}

// Interface for storage pool
interface StoragePool {
    name?: string;
    capacityGib?: number;
    serviceLevel?: string;
    state?: string;
    createTime?: string;
    updateTime?: string;
    description?: string;
    labels?: Record<string, string>;
    networkConfig?: NetworkConfig;
}

// Create Storage Pool Handler
export const createStoragePoolHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                storagePoolId, 
                capacityGib, 
                serviceLevel, 
                description, 
                labels,
                networkConfig
            } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the parent path for the storage pool
            const parent = `projects/${projectId}/locations/${location}`;

            // Create the storage pool request
            const request = {
                parent,
                storagePoolId,
                storagePool: {
                    capacityGib,
                    serviceLevel,
                    description,
                    labels,
                    networkConfig: networkConfig ? {
                        network: networkConfig.network
                    } : undefined
                }
            };

            console.log("Create Storage Pool Request:", request);
            // Call the API to create a storage pool
            const [operation] = await netAppClient.createStoragePool(request);
            console.log("Create Storage Pool Operation:", operation);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ name: `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`, operation: operation }, null, 2)  
                }],
                structuredContent: {
                    name: `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error creating storage pool:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error creating storage pool: ${error.message || 'Unknown error'}`
                }]
            }; 
        }
    };

// Delete Storage Pool Handler
export const deleteStoragePoolHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
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
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ success: true, operation: operation }, null, 2)
                }],
                structuredContent: {
                    success: true,
                    operationId: operationName
                }
            };
        } catch (error: any) {
            console.error("Error deleting storage pool:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error deleting storage pool: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Get Storage Pool Handler
export const getStoragePoolHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, storagePoolId } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the name for the storage pool
            const name = `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;

            // Call the API to get the storage pool
            const [storagePool] = await netAppClient.getStoragePool({ name });
            console.log("Get Storage Pool Response:", storagePool);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(storagePool, null, 2)
                }],
                structuredContent: {
                    name: storagePool.name || '',
                    storagePoolId: storagePoolId,
                    capacityGib: Number(storagePool.capacityGib) || 0,
                    volumeCapacityGib: Number(storagePool.volumeCapacityGib) || 0,
                    volumecount: storagePool.volumeCount || 0,
                    serviceLevel: storagePool.serviceLevel || '',
                    state: storagePool.state || 'UNKNOWN',
                    createTime: storagePool.createTime && storagePool.createTime.seconds ? new Date(Number(storagePool.createTime.seconds) * 1000) : new Date(),
                    description: storagePool.description || '',
                    labels: storagePool.labels || {},
                    network: storagePool.network
                }
            };
        } catch (error: any) {
            console.error("Error getting storage pool:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting storage pool: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// List Storage Pools Handler
export const listStoragePoolsHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, filter, pageSize, pageToken } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the parent path for listing storage pools
            const parent = `projects/${projectId}/locations/${location}`;

            // Call the API to list storage pools
            const [storagePools, _, paginated_response] = await netAppClient.listStoragePools({
                parent,
                pageSize,
                pageToken,
                orderBy : undefined,
                filter,
            });

            console.log("List Storage Pools Response:", storagePools, paginated_response);
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
                    createTime: pool.createTime && pool.createTime.seconds ? new Date(Number(pool.createTime.seconds) * 1000) : new Date(),
                    description: pool.description || '',
                    labels: pool.labels || {},
                    network: pool.network
                };
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(storagePools, null, 2)
                }],
                structuredContent: {
                    storagePools: formattedPools,
                    nextPageToken: nextPageToken
                }
            };
        } catch (error: any) {
            console.error("Error listing storage pools:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error listing storage pools: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Update Storage Pool Handler
export const updateStoragePoolHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, storagePoolId, capacityGib, description, labels } = args;

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

            // Call the API to update the storage pool
            const [operation] = await netAppClient.updateStoragePool({
                storagePool: {
                    name,
                    ...storagePool
                },
                updateMask: {
                    paths: updateMask
                }
            });

            console.log("Update Storage Pool Operation:", operation);
            
            // Most APIs don't return updateTime as a field in the response
            // Using current time as a fallback
            const currentTime = new Date().toISOString();

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ name: `Update ${name}`, operation: operation }, null, 2)
                }],
                structuredContent: {
                    name: storagePool.name || '',
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error updating storage pool:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error updating storage pool: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };
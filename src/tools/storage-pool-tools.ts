import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Create Storage Pool Tool
export const createStoragePoolTool: ToolConfig = {
    name: "storage_pool_create",
    title: "Create Storage Pool",
    description: "Creates a new storage pool in the specified project and location",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location where the storage pool should be created"),
        storagePoolId: z.string().describe("The ID to assign to the storage pool"),
        capacityGib: z.number().describe("The capacity of the storage pool in GiB"),
        serviceLevel: z.enum(["STANDARD", "PREMIUM", "EXTREME"]).describe("The service level of the storage pool"),
        description: z.string().optional().describe("Optional description of the storage pool"),
        labels: z.record(z.string()).optional().describe("Optional labels to apply to the storage pool"),
        networkConfig: z.object({
            network: z.string().describe("The VPC network to use for the storage pool"),
        }).optional().describe("Optional network configuration")
    },
    outputSchema: {
        name: z.string().describe("The name of the created storage pool"),
        operationId: z.string().describe("The ID of the long-running operation for creating the storage pool")
    }
};

// Delete Storage Pool Tool
export const deleteStoragePoolTool: ToolConfig = {
    name: "storage_pool_delete",
    title: "Delete Storage Pool",
    description: "Deletes a storage pool in the specified project and location",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the storage pool"),
        storagePoolId: z.string().describe("The ID of the storage pool to delete"),
        force: z.boolean().optional().describe("Force deletion even if the pool contains resources")
    },
    outputSchema: {
        success: z.boolean().describe("Whether the deletion was successful"),
        operationId: z.string().optional().describe("The ID of the long-running operation")
    }
};

// Get Storage Pool Tool
export const getStoragePoolTool: ToolConfig = {
    name: "storage_pool_get",
    title: "Get Storage Pool",
    description: "Gets details of a specific storage pool",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the storage pool"),
        storagePoolId: z.string().describe("The ID of the storage pool to retrieve")
    },
    outputSchema: {
        name: z.string().describe("The name of the storage pool"),
        storagePoolId: z.string().describe("The ID of the storage pool"),
        serviceLevel: z.string().describe("The service level of the storage pool"),
        capacityGib: z.number().describe("The capacity of the storage pool in GiB"),
        volumeCapacityGib: z.number().describe("The total volume capacity in GiB"),
        volumecount: z.number().describe("The number of volumes in the storage pool"),
        state: z.string().describe("The current state of the storage pool"),
        createTime: z.date().describe("The timestamp when the storage pool was created"),
        description: z.string().optional().describe("The description of the storage pool"),
        labels: z.record(z.string()).optional().describe("Labels applied to the storage pool"),
        network: z.string().optional().describe("The VPC network used by the storage pool")
    }
};

// List Storage Pools Tool
export const listStoragePoolsTool: ToolConfig = {
    name: "storage_pool_list",
    title: "List Storage Pools",
    description: "Lists all storage pools in the specified project and location",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to list storage pools from"),
        filter: z.string().optional().describe("Filter expression for filtering results"),
        pageSize: z.number().optional().describe("The maximum number of storage pools to return"),
        pageToken: z.string().optional().describe("Page token from a previous list request")
    },
    outputSchema: {
        storagePools: z.array(z.object({
            name: z.string().describe("The name of the storage pool"),
            storagePoolId: z.string().describe("The ID of the storage pool"),
            serviceLevel: z.string().describe("The service level of the storage pool"),
            capacityGib: z.number().describe("The capacity of the storage pool in GiB"),
            volumeCapacityGib: z.number().describe("The total volume capacity in GiB"),
            volumecount: z.number().describe("The number of volumes in the storage pool"),
            state: z.string().describe("The current state of the storage pool"),
            createTime: z.date().describe("The timestamp when the storage pool was created"),
            description: z.string().optional().describe("The description of the storage pool"),
            labels: z.record(z.string()).optional().describe("Labels applied to the storage pool"),
            network: z.string().optional().describe("The VPC network used by the storage pool")
        })).describe("List of storage pools"),
        nextPageToken: z.string().optional().describe("Token to retrieve the next page of results")
    }
};

// Update Storage Pool Tool
export const updateStoragePoolTool: ToolConfig = {
    name: "storage_pool_update",
    title: "Update Storage Pool",
    description: "Updates a storage pool in the specified project and location",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the storage pool"),
        storagePoolId: z.string().describe("The ID of the storage pool to update"),
        capacityGib: z.number().optional().describe("The new capacity of the storage pool in GiB"),
        description: z.string().optional().describe("New description of the storage pool"),
        labels: z.record(z.string()).optional().describe("New labels to apply to the storage pool")
    },
    outputSchema: {
        name: z.string().describe("The name of the updated storage pool"),
        operationId: z.string().optional().describe("The ID of the long-running operation for updating the storage pool")
    }
};
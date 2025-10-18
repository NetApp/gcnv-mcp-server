import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Create Volume Tool
export const createVolumeTool: ToolConfig = {
    name: "volume_create",
    title: "Create Volume",
    description: "Creates a new volume in the specified storage pool",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location where the volume should be created"),
        storagePoolId: z.string().describe("The ID of the storage pool to create the volume in"),
        volumeId: z.string().describe("The ID to assign to the volume"),
        capacityGib: z.number().describe("The capacity of the volume in GiB"),
        protocols: z.array(z.enum(["NFSV3", "NFSV4", "SMB", "DUAL"])).describe("The file share protocols to enable"),
        description: z.string().optional().describe("Optional description of the volume"),
        shareName: z.string().optional().describe("Optional name of the file share"),
        labels: z.record(z.string()).optional().describe("Optional labels to apply to the volume"),
        exportPolicy: z.object({
            rules: z.array(z.object({
                allowedClients: z.string().describe("CIDR range of client IPs to allow"),
                accessType: z.enum(["READ_ONLY", "READ_WRITE"]).optional().describe("Access permission type"),
                nfsv3: z.boolean().optional().describe("Whether NFSv3 is allowed"),
                nfsv4: z.boolean().optional().describe("Whether NFSv4 is allowed"),
                hasRootAccess: z.boolean().optional().describe("Whether root access is allowed"),
                nfsOptions: z.object({
                    rootSquash: z.boolean().optional().describe("Whether to enable root squashing"),
                    anon: z.string().optional().describe("Anonymous user ID for mapped root user")
                }).optional().describe("NFS-specific options"),
                kerberos5ReadOnly: z.boolean().optional().describe("Whether Kerberos5 is required for read-only operations"),
                kerberos5ReadWrite: z.boolean().optional().describe("Whether Kerberos5 is required for read-write operations"),
                kerberos5iReadOnly: z.boolean().optional().describe("Whether Kerberos5i is required for read-only operations"),
                kerberos5iReadWrite: z.boolean().optional().describe("Whether Kerberos5i is required for read-write operations"),
                kerberos5pReadOnly: z.boolean().optional().describe("Whether Kerberos5p is required for read-only operations"),
                kerberos5pReadWrite: z.boolean().optional().describe("Whether Kerberos5p is required for read-write operations")
            })).describe("List of export policy rules")
        }).optional().describe("NFS export policy configuration")
    },
    outputSchema: {
        name: z.string().describe("The name of the created volume"),
        operationId: z.string().describe("The ID of the long-running operation for creating the volume")
    }
};

// Delete Volume Tool
export const deleteVolumeTool: ToolConfig = {
    name: "volume_delete",
    title: "Delete Volume",
    description: "Deletes a volume in the specified storage pool",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the volume"),
        volumeId: z.string().describe("The ID of the volume to delete"),
        force: z.boolean().optional().describe("Force deletion even if the volume has snapshots")
    },
    outputSchema: {
        success: z.boolean().describe("Whether the deletion was successful"),
        operationId: z.string().optional().describe("The ID of the long-running operation")
    }
};

// Get Volume Tool
export const getVolumeTool: ToolConfig = {
    name: "volume_get",
    title: "Get Volume",
    description: "Gets details of a specific volume",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the volume"),
        volumeId: z.string().describe("The ID of the volume to retrieve")
    },
    outputSchema: {
        name: z.string().describe("The name of the volume"),
        volumeId: z.string().describe("The ID of the volume"),
        storagePool: z.string().describe("The storage pool containing the volume"),
        capacityGib: z.number().describe("The capacity of the volume in GiB"),
        usedGib: z.number().optional().describe("The used capacity of the volume in GiB"),
        state: z.string().describe("The current state of the volume"),
        shareName: z.string().optional().describe("The name of the file share"),
        protocols: z.array(z.string()).describe("The enabled share protocols"),
        createTime: z.date().describe("The timestamp when the volume was created"),
        description: z.string().optional().describe("The description of the volume"),
        labels: z.record(z.string()).optional().describe("Labels applied to the volume"),
        mountOptions: z.array(z.object({
            ipAddress: z.string().describe("The IP address to use for mounting"),
            export: z.string().describe("The export path"),
            exportFull: z.string().describe("The full export path including ip address"),
            protocol: z.string().describe("The protocol of the mount point")
        })).describe("Mount points for the volume")
    }
};

// List Volumes Tool
export const listVolumesTool: ToolConfig = {
    name: "volume_list",
    title: "List Volumes",
    description: "Lists all volumes in the specified storage pool",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to list volumes from"),
        filter: z.string().optional().describe("Filter expression for filtering results"),
        pageSize: z.number().optional().describe("The maximum number of volumes to return"),
        pageToken: z.string().optional().describe("Page token from a previous list request")
    },
    outputSchema: {
        volumes: z.array(z.object({
            name: z.string().describe("The name of the volume"),
            volumeId: z.string().describe("The ID of the volume"),
            storagePool: z.string().describe("The storage pool containing the volume"),
            capacityGib: z.number().describe("The capacity of the volume in GiB"),
            usedGib: z.number().optional().describe("The used capacity of the volume in GiB"),
            state: z.string().describe("The current state of the volume"),
            shareName: z.string().optional().describe("The name of the file share"),
            protocols: z.array(z.string()).describe("The enabled share protocols"),
            createTime: z.date().describe("The timestamp when the volume was created"),
            labels: z.record(z.string()).optional().describe("Labels applied to the volume"),
            description: z.string().optional().describe("The description of the volume"),
            mountOptions: z.array(z.object({
                ipAddress: z.string().describe("The IP address to use for mounting"),
                export: z.string().describe("The export path"),
                exportFull: z.string().describe("The full export path including ip address"),
                protocol: z.string().describe("The protocol of the mount point")
            })).describe("Mount points for the volume")
        })).describe("List of volumes"),
        nextPageToken: z.string().optional().describe("Token to retrieve the next page of results")
    }
};

// Update Volume Tool
export const updateVolumeTool: ToolConfig = {
    name: "volume_update",
    title: "Update Volume",
    description: "Updates a volume in the specified storage pool",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the volume"),
        volumeId: z.string().describe("The ID of the volume to update"),
        capacityGib: z.number().optional().describe("The new capacity of the volume in GiB"),
        description: z.string().optional().describe("New description of the volume"),
        labels: z.record(z.string()).optional().describe("New labels to apply to the volume"),
        exportPolicy: z.object({
            rules: z.array(z.object({
                allowedClients: z.string().optional().describe("CIDR range of client IPs to allow"),
                accessType: z.enum(["READ_ONLY", "READ_WRITE"]).optional().describe("Access permission type"),
                nfsOptions: z.object({
                    rootSquash: z.boolean().optional().describe("Whether to enable root squashing"),
                    anon: z.string().optional().describe("Anonymous user ID for mapped root user")
                }).optional().describe("NFS-specific options"),
                kerberos5ReadOnly: z.boolean().optional().describe("Whether Kerberos5 is required for read-only operations"),
                kerberos5ReadWrite: z.boolean().optional().describe("Whether Kerberos5 is required for read-write operations"),
                kerberos5iReadOnly: z.boolean().optional().describe("Whether Kerberos5i is required for read-only operations"),
                kerberos5iReadWrite: z.boolean().optional().describe("Whether Kerberos5i is required for read-write operations"),
                kerberos5pReadOnly: z.boolean().optional().describe("Whether Kerberos5p is required for read-only operations"),
                kerberos5pReadWrite: z.boolean().optional().describe("Whether Kerberos5p is required for read-write operations")
            })).describe("List of export policy rules")
        }).optional().describe("Updated NFS export policy configuration")
    },
    outputSchema: {
        name: z.string().describe("The name of the updated volume"),
        operationId: z.string().optional().describe("The ID of the long-running operation for updating the volume")
    }
};
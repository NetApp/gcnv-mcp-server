import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Interface for volume
interface Volume {
    name?: string;
    capacityGib?: number;
    state?: string;
    shareProtocols?: string[];
    createTime?: string;
    updateTime?: string;
    description?: string;
    labels?: Record<string, string>;
    exportPolicy?: {
        rules?: Array<{
            allowedClients?: string;
            accessType?: string;
            nfsOptions?: {
                rootSquash?: boolean;
                anon?: string;
            };
            kerberos5ReadOnly?: boolean;
            kerberos5ReadWrite?: boolean;
            kerberos5iReadOnly?: boolean;
            kerberos5iReadWrite?: boolean;
            kerberos5pReadOnly?: boolean;
            kerberos5pReadWrite?: boolean;
        }>;
    };
    usedGib?: number;
    mountPoints?: Array<{
        protocol?: string;
        ipAddress?: string;
        export?: string;
    }>;
    shareName?: string;
}

// Helper to format volume data for responses
function formatVolumeData(volume: any): any {
    const result: any = {};
    
    if (!volume) return result;

    if (volume.name) {
        // Extract volumeId from name (last part after last slash)
        const nameParts = volume.name.split('/');
        result.name = volume.name;
        result.volumeId = nameParts[nameParts.length - 1];
    }

    // Extract storage pool from name
    if (volume.storagePool) {        
       result.storagePool = volume.storagePool
    }
    
    // Copy basic properties
    if (volume.capacityGib) result.capacityGib = Number(volume.capacityGib);
    if (volume.usedGib) result.usedGib = Number(volume.usedGib);
    if (volume.state) result.state = volume.state;
    if (volume.shareName) result.shareName = volume.shareName;
    if (volume.protocols) result.protocols = volume.protocols;
    
    // Format timestamps if they exist
    if (volume.createTime) {
        result.createTime = new Date(volume.createTime.seconds * 1000);
    }
    
    // Copy optional properties
    if (volume.description) result.description = volume.description;
    if (volume.labels) result.labels = volume.labels;

    // Format mount points
    if (volume.mountOptions && volume.mountOptions.length > 0) {
        result.mountOptions = volume.mountOptions.map((mp: any) => ({
            protocol: mp.protocol || '',
            ipAddress: mp.ipAddress || '',
            export: mp.export || '',
            exportFull: mp.exportFull || ''
        }));
    }

    return result;
}

// Create Volume Handler
export const createVolumeHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                storagePoolId,
                volumeId,
                capacityGib, 
                protocols,
                description, 
                labels,
                exportPolicy,
                shareName
            } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the parent path for the volume
            const parent = `projects/${projectId}/locations/${location}`;

            // Create the volume request
            const request = {
                parent,
                volumeId,
                volume: {
                    storagePool: storagePoolId,
                    capacityGib,
                    protocols: protocols || ["NFS3"],
                    description,
                    labels,
                    shareName: shareName || volumeId,
                    exportPolicy
                }
            };

            console.log("Create Volume Request:", request);
            // Call the API to create a volume
            const [operation] = await netAppClient.createVolume(request);
            console.log("Create Volume Operation:", operation);

            return {
                content: [{
                    type: "text" as const,
                    text: `Created volume ${volumeId} with operation: ${JSON.stringify(operation, null, 2)}`  
                }],
                structuredContent: {
                    name: `projects/${projectId}/locations/${location}/volumes/${volumeId}`,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error creating volume:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error creating volume: ${error.message || 'Unknown error'}`
                }]
            }; 
        }
    };

// Delete Volume Handler
export const deleteVolumeHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, force = false } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the name for the volume
            const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

            // Call the API to delete the volume
            const request: any = { name };
            // Only add force if it's true to avoid API errors
            if (force) {
                request.force = true;
            }

            console.log("Delete Volume Request:", request);
            const [operation] = await netAppClient.deleteVolume(request);
            console.log("Delete Volume Operation:", operation);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                      "message" : `Volume ${volumeId} deletion requested`,
                      operation : operation}, null, 2)
                }],
                structuredContent: {
                    success: true,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error deleting volume:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error deleting volume: ${error.message || 'Unknown error'}`
                }],
                structuredContent: {
                    success: false
                }
            };
        }
    };

// Get Volume Handler
export const getVolumeHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the name for the volume
            const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

            // Call the API to get the volume
            console.log("Get Volume Request:", { name });
            const [volume] = await netAppClient.getVolume({ name });
            console.log("Get Volume Response:", volume);

            // Format the volume data
            const formattedVolume = formatVolumeData(volume);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(volume, null, 2)
                }],
                structuredContent: formattedVolume
            };
        } catch (error: any) {
            console.error("Error getting volume:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting volume: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// List Volumes Handler
export const listVolumesHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, filter, pageSize, pageToken } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the parent path
            const parent = `projects/${projectId}/locations/${location}`;

            // Create the request object
            const request: any = { parent };
            if (filter) request.filter = filter;
            if (pageSize) request.pageSize = pageSize;
            if (pageToken) request.pageToken = pageToken;

            // Call the API to list volumes
            console.log("List Volumes Request:", request);
            const [volumes, _, nextPageToken] = await netAppClient.listVolumes(request);
            console.log("List Volumes Response:", volumes);

            const formattedVolumes = volumes.map(formatVolumeData);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ volumes: volumes, nextPageToken: nextPageToken }, null, 2)   
                  }],
                structuredContent: {
                    volumes: formattedVolumes,
                    nextPageToken: pageToken || ''
                }
            };
        } catch (error: any) {
            console.error("Error listing volumes:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error listing volumes: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Update Volume Handler
// TODO: update is not tested
// FIX_ME: errors "reason: 'RESOURCE_PROJECT_INVALID'
export const updateVolumeHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                volumeId, 
                capacityGib, 
                description, 
                labels,
                exportPolicy 
            } = args;

            // Create a new NetApp client using the factory
            const netAppClient = NetAppClientFactory.createClient();

            // Format the name for the volume
            const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

            // Create the update mask
            const updateMask: string[] = [];
            const volume: any = {};

            // Add fields to update mask if they're provided
            if (capacityGib !== undefined) {
                volume.capacityGib = capacityGib;
                updateMask.push('capacityGib');
            }
            if (description !== undefined) {
                volume.description = description;
                updateMask.push('description');
            }
            if (labels !== undefined) {
                volume.labels = labels;
                updateMask.push('labels');
            }
            if (exportPolicy !== undefined) {
                volume.exportPolicy = exportPolicy;
                updateMask.push('exportPolicy');
            }

            // Create the request
            const request = {
                volume,
                name,
                updateMask: {
                    paths: updateMask
                }
            };

            console.log("Update Volume Request:", request);
            const [operation] = await netAppClient.updateVolume(request);
            console.log("Update Volume Operation:", operation);

            return {
                content: [{
                    type: "text" as const,
                    text: `Updated volume ${volumeId} with operation: ${JSON.stringify(operation, null, 2)}`
                }],
                structuredContent: {
                    name,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error updating volume:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error updating volume: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };
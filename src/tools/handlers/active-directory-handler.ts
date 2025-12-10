import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Helper to format active directory data
function formatActiveDirectoryData(ad: any): any {
    const result: any = {};
    
    if (!ad) return result;

    if (ad.name) {
        const nameParts = ad.name.split('/');
        result.name = ad.name;
        result.activeDirectoryId = nameParts[nameParts.length - 1];
    }
    
    if (ad.domain) result.domain = ad.domain;
    if (ad.site) result.site = ad.site;
    if (ad.dns) result.dns = ad.dns;
    if (ad.netBiosPrefix) result.netBiosPrefix = ad.netBiosPrefix;
    if (ad.organizationalUnit) result.organizationalUnit = ad.organizationalUnit;
    if (ad.aesEncryption !== undefined) result.aesEncryption = ad.aesEncryption;
    if (ad.state) result.state = ad.state;
    
    if (ad.createTime) {
        result.createTime = new Date(ad.createTime.seconds * 1000);
    }
    
    if (ad.description) result.description = ad.description;
    if (ad.labels) result.labels = ad.labels;

    return result;
}

// Create Active Directory Handler
export const createActiveDirectoryHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                activeDirectoryId,
                domain,
                site,
                dns,
                netBiosPrefix,
                organizationalUnit,
                aesEncryption,
                username,
                password,
                backupOperators,
                securityOperators,
                kdcHostname,
                kdcIp,
                nfsUsersWithLdap,
                description,
                labels
            } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const activeDirectory: any = {};
            if (domain) activeDirectory.domain = domain;
            if (site) activeDirectory.site = site;
            if (dns) activeDirectory.dns = dns;
            if (netBiosPrefix) activeDirectory.netBiosPrefix = netBiosPrefix;
            if (organizationalUnit) activeDirectory.organizationalUnit = organizationalUnit;
            if (aesEncryption !== undefined) activeDirectory.aesEncryption = aesEncryption;
            if (username) activeDirectory.username = username;
            if (password) activeDirectory.password = password;
            if (backupOperators) activeDirectory.backupOperators = backupOperators;
            if (securityOperators) activeDirectory.securityOperators = securityOperators;
            if (kdcHostname) activeDirectory.kdcHostname = kdcHostname;
            if (kdcIp) activeDirectory.kdcIp = kdcIp;
            if (nfsUsersWithLdap !== undefined) activeDirectory.nfsUsersWithLdap = nfsUsersWithLdap;
            if (description) activeDirectory.description = description;
            if (labels) activeDirectory.labels = labels;

            const request = {
                parent,
                activeDirectoryId,
                activeDirectory
            };

            console.log("Create Active Directory Request:", request);
            const [operation] = await netAppClient.createActiveDirectory(request);
            console.log("Create Active Directory Operation:", operation);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        name: `projects/${projectId}/locations/${location}/activeDirectories/${activeDirectoryId}`,
                        operation: operation
                    }, null, 2)
                }],
                structuredContent: {
                    name: `projects/${projectId}/locations/${location}/activeDirectories/${activeDirectoryId}`,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error creating active directory:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error creating active directory: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Delete Active Directory Handler
export const deleteActiveDirectoryHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, activeDirectoryId } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const name = `projects/${projectId}/locations/${location}/activeDirectories/${activeDirectoryId}`;

            const [operation] = await netAppClient.deleteActiveDirectory({ name });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        message: `Active directory ${activeDirectoryId} deletion requested`,
                        operation: operation
                    }, null, 2)
                }],
                structuredContent: {
                    success: true,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error deleting active directory:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error deleting active directory: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Get Active Directory Handler
export const getActiveDirectoryHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, activeDirectoryId } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const name = `projects/${projectId}/locations/${location}/activeDirectories/${activeDirectoryId}`;

            const [activeDirectory] = await netAppClient.getActiveDirectory({ name });
            const formatted = formatActiveDirectoryData(activeDirectory);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(formatted, null, 2)
                }],
                structuredContent: formatted
            };
        } catch (error: any) {
            console.error("Error getting active directory:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting active directory: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// List Active Directories Handler
export const listActiveDirectoriesHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, filter, pageSize, pageToken } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const request: any = { parent };
            if (filter) request.filter = filter;
            if (pageSize) request.pageSize = pageSize;
            if (pageToken) request.pageToken = pageToken;

            const [activeDirectories, _, response] = await netAppClient.listActiveDirectories(request);
            const formatted = activeDirectories.map(formatActiveDirectoryData);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ activeDirectories, nextPageToken: response?.nextPageToken }, null, 2)
                }],
                structuredContent: {
                    activeDirectories: formatted,
                    nextPageToken: response?.nextPageToken
                }
            };
        } catch (error: any) {
            console.error("Error listing active directories:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error listing active directories: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Update Active Directory Handler
export const updateActiveDirectoryHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                activeDirectoryId,
                domain,
                site,
                dns,
                netBiosPrefix,
                organizationalUnit,
                aesEncryption,
                username,
                password,
                backupOperators,
                securityOperators,
                kdcHostname,
                kdcIp,
                nfsUsersWithLdap,
                description,
                labels
            } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const name = `projects/${projectId}/locations/${location}/activeDirectories/${activeDirectoryId}`;

            const updateMask: string[] = [];
            const activeDirectory: any = { name };

            if (domain !== undefined) { activeDirectory.domain = domain; updateMask.push('domain'); }
            if (site !== undefined) { activeDirectory.site = site; updateMask.push('site'); }
            if (dns !== undefined) { activeDirectory.dns = dns; updateMask.push('dns'); }
            if (netBiosPrefix !== undefined) { activeDirectory.netBiosPrefix = netBiosPrefix; updateMask.push('netBiosPrefix'); }
            if (organizationalUnit !== undefined) { activeDirectory.organizationalUnit = organizationalUnit; updateMask.push('organizationalUnit'); }
            if (aesEncryption !== undefined) { activeDirectory.aesEncryption = aesEncryption; updateMask.push('aesEncryption'); }
            if (username !== undefined) { activeDirectory.username = username; updateMask.push('username'); }
            if (password !== undefined) { activeDirectory.password = password; updateMask.push('password'); }
            if (backupOperators !== undefined) { activeDirectory.backupOperators = backupOperators; updateMask.push('backupOperators'); }
            if (securityOperators !== undefined) { activeDirectory.securityOperators = securityOperators; updateMask.push('securityOperators'); }
            if (kdcHostname !== undefined) { activeDirectory.kdcHostname = kdcHostname; updateMask.push('kdcHostname'); }
            if (kdcIp !== undefined) { activeDirectory.kdcIp = kdcIp; updateMask.push('kdcIp'); }
            if (nfsUsersWithLdap !== undefined) { activeDirectory.nfsUsersWithLdap = nfsUsersWithLdap; updateMask.push('nfsUsersWithLdap'); }
            if (description !== undefined) { activeDirectory.description = description; updateMask.push('description'); }
            if (labels !== undefined) { activeDirectory.labels = labels; updateMask.push('labels'); }

            const request = {
                activeDirectory,
                updateMask: { paths: updateMask }
            };

            console.log("Update Active Directory Request:", request);
            const [operation] = await netAppClient.updateActiveDirectory(request);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        message: `Active directory ${activeDirectoryId} update requested`,
                        operation: operation
                    }, null, 2)
                }],
                structuredContent: {
                    name: name,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error updating active directory:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error updating active directory: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };


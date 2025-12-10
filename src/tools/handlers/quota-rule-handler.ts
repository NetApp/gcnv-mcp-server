import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Helper to format quota rule data
function formatQuotaRuleData(rule: any): any {
    const result: any = {};
    
    if (!rule) return result;

    if (rule.name) {
        const nameParts = rule.name.split('/');
        result.name = rule.name;
        result.quotaRuleId = nameParts[nameParts.length - 1];
    }
    
    if (rule.quotaType) result.quotaType = rule.quotaType;
    if (rule.quotaSizeGib) result.quotaSizeGib = Number(rule.quotaSizeGib);
    if (rule.quotaSizeBytes) result.quotaSizeBytes = Number(rule.quotaSizeBytes);
    if (rule.state) result.state = rule.state;
    
    if (rule.createTime) {
        result.createTime = new Date(rule.createTime.seconds * 1000);
    }
    
    if (rule.description) result.description = rule.description;
    if (rule.labels) result.labels = rule.labels;

    return result;
}

// Create Quota Rule Handler
export const createQuotaRuleHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                volumeId,
                quotaRuleId,
                quotaType,
                quotaSizeGib,
                quotaSizeBytes,
                description,
                labels
            } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

            const quotaRule: any = {};
            if (quotaType) quotaRule.quotaType = quotaType;
            if (quotaSizeGib !== undefined) quotaRule.quotaSizeGib = quotaSizeGib;
            if (quotaSizeBytes !== undefined) quotaRule.quotaSizeBytes = quotaSizeBytes;
            if (description) quotaRule.description = description;
            if (labels) quotaRule.labels = labels;

            const request = {
                parent,
                quotaRuleId,
                quotaRule
            };

            console.log("Create Quota Rule Request:", request);
            const [operation] = await netAppClient.createQuotaRule(request);
            console.log("Create Quota Rule Operation:", operation);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`,
                        operation: operation
                    }, null, 2)
                }],
                structuredContent: {
                    name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error creating quota rule:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error creating quota rule: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Delete Quota Rule Handler
export const deleteQuotaRuleHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, quotaRuleId } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`;

            const [operation] = await netAppClient.deleteQuotaRule({ name });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        message: `Quota rule ${quotaRuleId} deletion requested`,
                        operation: operation
                    }, null, 2)
                }],
                structuredContent: {
                    success: true,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error deleting quota rule:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error deleting quota rule: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Get Quota Rule Handler
export const getQuotaRuleHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, quotaRuleId } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`;

            const [quotaRule] = await netAppClient.getQuotaRule({ name });
            const formatted = formatQuotaRuleData(quotaRule);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(formatted, null, 2)
                }],
                structuredContent: formatted
            };
        } catch (error: any) {
            console.error("Error getting quota rule:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting quota rule: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// List Quota Rules Handler
export const listQuotaRulesHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, filter, pageSize, pageToken, orderBy } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

            const request: any = { parent };
            if (filter) request.filter = filter;
            if (pageSize) request.pageSize = pageSize;
            if (pageToken) request.pageToken = pageToken;
            if (orderBy) request.orderBy = orderBy;

            const [quotaRules, _, response] = await netAppClient.listQuotaRules(request);
            const formatted = quotaRules.map(formatQuotaRuleData);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ quotaRules, nextPageToken: response?.nextPageToken }, null, 2)
                }],
                structuredContent: {
                    quotaRules: formatted,
                    nextPageToken: response?.nextPageToken
                }
            };
        } catch (error: any) {
            console.error("Error listing quota rules:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error listing quota rules: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Update Quota Rule Handler
export const updateQuotaRuleHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { 
                projectId, 
                location, 
                volumeId,
                quotaRuleId,
                quotaType,
                quotaSizeGib,
                quotaSizeBytes,
                description,
                labels
            } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`;

            const updateMask: string[] = [];
            const quotaRule: any = { name };

            if (quotaType !== undefined) { quotaRule.quotaType = quotaType; updateMask.push('quotaType'); }
            if (quotaSizeGib !== undefined) { quotaRule.quotaSizeGib = quotaSizeGib; updateMask.push('quotaSizeGib'); }
            if (quotaSizeBytes !== undefined) { quotaRule.quotaSizeBytes = quotaSizeBytes; updateMask.push('quotaSizeBytes'); }
            if (description !== undefined) { quotaRule.description = description; updateMask.push('description'); }
            if (labels !== undefined) { quotaRule.labels = labels; updateMask.push('labels'); }

            const request = {
                quotaRule,
                updateMask: updateMask.length > 0 ? { paths: updateMask } : undefined
            };

            console.log("Update Quota Rule Request:", request);
            const [operation] = await netAppClient.updateQuotaRule(request);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        message: `Quota rule ${quotaRuleId} update requested`,
                        operation: operation
                    }, null, 2)
                }],
                structuredContent: {
                    name: name,
                    operationId: operation.name || ''
                }
            };
        } catch (error: any) {
            console.error("Error updating quota rule:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error updating quota rule: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };


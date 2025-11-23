import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Advanced Volume Search Tool
export const advancedVolumeSearchTool: ToolConfig = {
    name: "gcnv_volume_search",
    title: "Advanced Volume Search",
    description: "Search volumes by multiple criteria simultaneously (protocols, capacity, labels, state, snapshots, backups, replication)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to search volumes in"),
        protocols: z.array(z.enum(["NFSV3", "NFSV4", "SMB", "DUAL"])).optional().describe("Filter by share protocols"),
        minCapacityGib: z.number().optional().describe("Minimum capacity in GiB"),
        maxCapacityGib: z.number().optional().describe("Maximum capacity in GiB"),
        labels: z.record(z.string()).optional().describe("Key-value pairs to match in labels"),
        state: z.string().optional().describe("Filter by volume state"),
        hasSnapshots: z.boolean().optional().describe("Filter volumes that have snapshots"),
        hasBackups: z.boolean().optional().describe("Filter volumes that have backups"),
        hasReplication: z.boolean().optional().describe("Filter volumes that have replication"),
        autoTieringEnabled: z.boolean().optional().describe("Filter volumes with auto-tiering enabled (requires parent pool to have allowAutoTiering=true)"),
        autoTieringAction: z.enum(["ENABLED", "PAUSED"]).optional().describe("Filter by auto-tiering action status (ENABLED or PAUSED)"),
        hasSnapshotPolicy: z.boolean().optional().describe("Filter volumes that have a snapshot policy configured")
    },
    outputSchema: {
        volumes: z.array(z.object({
            volumeId: z.string(),
            capacityGib: z.number(),
            usedGib: z.number().optional(),
            protocols: z.array(z.string()),
            state: z.string(),
            labels: z.record(z.string()).optional(),
            storagePool: z.string(),
            tieringPolicy: z.object({
                tierAction: z.string().optional().describe("ENABLED or PAUSED"),
                coolingThresholdDays: z.number().optional().describe("Days before data is considered cold")
            }).optional().describe("Auto-tiering policy (only present if parent pool has allowAutoTiering=true)"),
            snapshotPolicy: z.object({
                enabled: z.boolean().optional(),
                hourlySchedule: z.any().optional(),
                dailySchedule: z.any().optional(),
                weeklySchedule: z.any().optional(),
                monthlySchedule: z.any().optional()
            }).optional().describe("Snapshot policy configuration")
        })).describe("List of matching volumes"),
        summary: z.object({
            totalCount: z.number(),
            totalCapacityGib: z.number(),
            averageCapacityGib: z.number()
        }).describe("Summary statistics")
    }
};

// Find Volumes by Export Policy Tool
export const findVolumesByExportPolicyTool: ToolConfig = {
    name: "gcnv_volume_find_by_export_policy",
    title: "Find Volumes by Export Policy",
    description: "Find volumes with specific export policy configurations (IP ranges, access types, root access, Kerberos)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to search volumes in"),
        allowedClientCidr: z.string().optional().describe("CIDR range to match (e.g., '0.0.0.0/0' for any)"),
        accessType: z.enum(["READ_ONLY", "READ_WRITE"]).optional().describe("Filter by access type"),
        hasRootAccess: z.boolean().optional().describe("Filter volumes that allow root access"),
        kerberosRequired: z.boolean().optional().describe("Filter volumes that require Kerberos authentication")
    },
    outputSchema: {
        volumes: z.array(z.object({
            volumeId: z.string(),
            exportPolicy: z.object({
                rules: z.array(z.object({
                    allowedClients: z.string(),
                    accessType: z.string().optional(),
                    hasRootAccess: z.boolean().optional(),
                    kerberos5ReadOnly: z.boolean().optional(),
                    kerberos5ReadWrite: z.boolean().optional()
                }))
            }),
            securityRecommendations: z.array(z.string()).optional()
        })).describe("Volumes matching export policy criteria")
    }
};

// Find Volumes by Mount Point Tool
export const findVolumesByMountPointTool: ToolConfig = {
    name: "gcnv_volume_find_by_mount_point",
    title: "Find Volumes by Mount Point",
    description: "Find volumes by their mount point IP address or export path",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to search volumes in"),
        ipAddress: z.string().optional().describe("Filter by mount IP address"),
        exportPath: z.string().optional().describe("Filter by export path"),
        protocol: z.enum(["NFSV3", "NFSV4", "SMB"]).optional().describe("Filter by protocol")
    },
    outputSchema: {
        volumes: z.array(z.object({
            volumeId: z.string(),
            mountOptions: z.array(z.object({
                ipAddress: z.string(),
                export: z.string(),
                exportFull: z.string(),
                protocol: z.string()
            })),
            mountInstructions: z.string().optional()
        })).describe("Volumes matching mount point criteria")
    }
};

// Find Resources by Labels Tool
export const findResourcesByLabelsTool: ToolConfig = {
    name: "gcnv_resource_find_by_labels",
    title: "Find Resources by Labels",
    description: "Find any resource type by label key-value pairs",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to search in"),
        resourceType: z.enum(["volume", "storagePool", "snapshot", "backup", "backupVault", "replication"]).describe("Type of resource to search"),
        labels: z.record(z.string()).describe("Key-value pairs to match in labels"),
        matchAll: z.boolean().optional().describe("If true, match all labels; if false, match any label (default: true)")
    },
    outputSchema: {
        resources: z.array(z.object({
            resourceId: z.string(),
            name: z.string(),
            labels: z.record(z.string()),
            resourceType: z.string()
        })).describe("List of matching resources")
    }
};


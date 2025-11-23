import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Volume Dependency Tree Tool
export const volumeDependencyTreeTool: ToolConfig = {
    name: "gcnv_volume_dependency_tree",
    title: "Volume Dependency Tree",
    description: "Show complete dependency tree for a volume (storage pool, snapshots, backups, replications, backup policies)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the volume"),
        volumeId: z.string().describe("The ID of the volume"),
        includeSnapshots: z.boolean().optional().describe("Include snapshot relationships (default: true)"),
        includeBackups: z.boolean().optional().describe("Include backup relationships (default: true)"),
        includeReplications: z.boolean().optional().describe("Include replication relationships (default: true)")
    },
    outputSchema: {
        volume: z.object({
            volumeId: z.string(),
            name: z.string(),
            storagePool: z.string()
        }),
        storagePool: z.object({
            storagePoolId: z.string(),
            serviceLevel: z.string(),
            capacityGib: z.number()
        }),
        snapshots: z.array(z.object({
            snapshotId: z.string(),
            createTime: z.string(),
            state: z.string()
        })).optional(),
        backups: z.array(z.object({
            backupId: z.string(),
            backupVault: z.string(),
            createTime: z.string(),
            state: z.string()
        })).optional(),
        replications: z.array(z.object({
            replicationId: z.string(),
            direction: z.string(),
            destinationVolume: z.string(),
            state: z.string()
        })).optional(),
        backupPolicy: z.object({
            backupPolicyId: z.string(),
            enabled: z.boolean()
        }).optional(),
        dependencyTree: z.string().describe("Text representation of the dependency tree")
    }
};

// Storage Pool Resource Inventory Tool
export const storagePoolResourceInventoryTool: ToolConfig = {
    name: "gcnv_storage_pool_inventory",
    title: "Storage Pool Resource Inventory",
    description: "Complete inventory of all resources in a storage pool (volumes, snapshots, replications, capacity breakdown)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the storage pool"),
        storagePoolId: z.string().describe("The ID of the storage pool"),
        includeDetails: z.boolean().optional().describe("Include full details vs summary (default: false)")
    },
    outputSchema: {
        storagePool: z.object({
            storagePoolId: z.string(),
            serviceLevel: z.string(),
            totalCapacityGib: z.number(),
            allocatedCapacityGib: z.number(),
            availableCapacityGib: z.number()
        }),
        volumes: z.array(z.object({
            volumeId: z.string(),
            capacityGib: z.number(),
            usedGib: z.number().optional(),
            state: z.string()
        })),
        totalSnapshots: z.number().describe("Total number of snapshots across all volumes"),
        snapshots: z.array(z.object({
            snapshotId: z.string(),
            volumeId: z.string(),
            createTime: z.string()
        })).optional(),
        replications: z.array(z.object({
            replicationId: z.string(),
            sourceVolume: z.string(),
            destinationVolume: z.string(),
            state: z.string()
        })).optional(),
        capacityBreakdown: z.object({
            totalCapacityGib: z.number(),
            allocatedCapacityGib: z.number(),
            usedCapacityGib: z.number(),
            availableCapacityGib: z.number(),
            utilizationPercent: z.number()
        })
    }
};

// Backup Chain Analysis Tool
export const backupChainAnalysisTool: ToolConfig = {
    name: "gcnv_backup_chain_analysis",
    title: "Backup Chain Analysis",
    description: "Analyze backup chains and retention policies (backup chains per volume, age distribution, backups to delete, compliance)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze backups in"),
        volumeId: z.string().optional().describe("Analyze specific volume"),
        backupVaultId: z.string().optional().describe("Analyze specific backup vault")
    },
    outputSchema: {
        backupChains: z.array(z.object({
            volumeId: z.string(),
            backupCount: z.number(),
            oldestBackup: z.string().optional(),
            newestBackup: z.string().optional()
        })).describe("Backup chains per volume"),
        backupAgeDistribution: z.object({
            lessThan7Days: z.number(),
            between7And30Days: z.number(),
            between30And90Days: z.number(),
            olderThan90Days: z.number()
        }).describe("Backup age distribution"),
        backupsToDelete: z.array(z.object({
            backupId: z.string(),
            volumeId: z.string(),
            ageDays: z.number(),
            reason: z.string()
        })).describe("Backups that should be deleted per retention policy"),
        volumesWithoutRecentBackups: z.array(z.object({
            volumeId: z.string(),
            daysSinceLastBackup: z.number().optional()
        })).describe("Volumes without recent backups"),
        backupPolicyCompliance: z.array(z.object({
            volumeId: z.string(),
            backupPolicyId: z.string().optional(),
            isCompliant: z.boolean(),
            complianceIssues: z.array(z.string())
        })).describe("Backup policy compliance status")
    }
};

// Replication Status Overview Tool
export const replicationStatusOverviewTool: ToolConfig = {
    name: "gcnv_replication_status_overview",
    title: "Replication Status Overview",
    description: "Overview of all replication relationships and their health (replication pairs, health status, last replication time, lag, failed replications)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check replications in"),
        volumeId: z.string().optional().describe("Filter by source volume"),
        includeHistory: z.boolean().optional().describe("Include replication history (default: false)")
    },
    outputSchema: {
        replicationPairs: z.array(z.object({
            replicationId: z.string(),
            sourceVolume: z.string(),
            destinationVolume: z.string(),
            state: z.string(),
            healthy: z.boolean(),
            lastReplicationTime: z.string().optional(),
            replicationLag: z.string().optional()
        })).describe("All replication pairs"),
        healthyReplications: z.number().describe("Count of healthy replications"),
        unhealthyReplications: z.number().describe("Count of unhealthy replications"),
        failedReplications: z.array(z.object({
            replicationId: z.string(),
            errorMessage: z.string()
        })).describe("Failed replications"),
        recommendations: z.array(z.string()).describe("Recommendations for unhealthy replications")
    }
};


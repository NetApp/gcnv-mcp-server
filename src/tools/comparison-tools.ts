import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Volume Comparison Tool
export const volumeComparisonTool: ToolConfig = {
    name: "gcnv_volume_compare",
    title: "Volume Comparison",
    description: "Compare two or more volumes side-by-side (capacity, protocols, export policies, backup status, replication status)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the volumes"),
        volumeIds: z.array(z.string()).min(2).describe("Array of volume IDs to compare (minimum 2)")
    },
    outputSchema: {
        volumes: z.array(z.object({
            volumeId: z.string(),
            capacityGib: z.number(),
            usedGib: z.number().optional(),
            protocols: z.array(z.string()),
            exportPolicy: z.any().optional(),
            labels: z.record(z.string()).optional(),
            backupStatus: z.string(),
            replicationStatus: z.string(),
            state: z.string(),
            createTime: z.string(),
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
        })).describe("Volume details for comparison"),
        differences: z.array(z.object({
            property: z.string(),
            values: z.record(z.any())
        })).describe("Properties that differ between volumes"),
        recommendations: z.array(z.string()).describe("Recommendations based on differences")
    }
};

// Find Similar Volumes Tool
export const findSimilarVolumesTool: ToolConfig = {
    name: "gcnv_volume_find_similar",
    title: "Find Similar Volumes",
    description: "Find volumes with similar characteristics to a reference volume",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to search in"),
        volumeId: z.string().describe("Reference volume ID"),
        similarityCriteria: z.array(z.enum(["capacity", "protocols", "labels", "serviceLevel"])).optional().describe("Which properties to match"),
        tolerance: z.number().optional().describe("Percentage tolerance for capacity matching (default: 10)")
    },
    outputSchema: {
        similarVolumes: z.array(z.object({
            volumeId: z.string(),
            similarityScore: z.number(),
            differences: z.array(z.string())
        })).describe("List of similar volumes with similarity scores")
    }
};

// Storage Pool Comparison Tool
export const storagePoolComparisonTool: ToolConfig = {
    name: "gcnv_storage_pool_compare",
    title: "Storage Pool Comparison",
    description: "Compare storage pools for capacity planning",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location of the storage pools"),
        storagePoolIds: z.array(z.string()).min(1).describe("Array of storage pool IDs to compare")
    },
    outputSchema: {
        storagePools: z.array(z.object({
            storagePoolId: z.string(),
            serviceLevel: z.string(),
            totalCapacityGib: z.number(),
            allocatedCapacityGib: z.number(),
            availableCapacityGib: z.number(),
            utilizationPercent: z.number(),
            volumeCount: z.number(),
            averageVolumeSize: z.number()
        })).describe("Storage pool details for comparison"),
        recommendations: z.array(z.string()).describe("Recommendations for optimization")
    }
};


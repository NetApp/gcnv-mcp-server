import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Optimal Storage Pool Recommendation Tool
export const optimalStoragePoolRecommendTool: ToolConfig = {
    name: "gcnv_storage_pool_recommend",
    title: "Optimal Storage Pool Recommendation",
    description: "Recommend the best storage pool for a new volume based on capacity, service level, and network requirements",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to search storage pools in"),
        requiredCapacityGib: z.number().describe("Required capacity in GiB"),
        serviceLevel: z.enum(["STANDARD", "PREMIUM", "EXTREME", "FLEX"]).optional().describe("Preferred service level"),
        protocols: z.array(z.enum(["NFSV3", "NFSV4", "SMB", "DUAL"])).optional().describe("Required protocols"),
        preferredNetwork: z.string().optional().describe("VPC network preference")
    },
    outputSchema: {
        recommendedPools: z.array(z.object({
            storagePoolId: z.string(),
            serviceLevel: z.string(),
            availableCapacityGib: z.number(),
            utilizationPercent: z.number(),
            reasoning: z.string()
        })).describe("Recommended storage pools with reasoning"),
        alternativeOptions: z.array(z.object({
            storagePoolId: z.string(),
            serviceLevel: z.string(),
            availableCapacityGib: z.number(),
            reasoning: z.string()
        })).optional().describe("Alternative storage pool options"),
        costComparison: z.record(z.number()).optional().describe("Cost comparison by service level"),
        warnings: z.array(z.string()).optional().describe("Warnings if no suitable pool exists")
    }
};

// Backup Policy Recommendations Tool
export const backupPolicyRecommendTool: ToolConfig = {
    name: "gcnv_backup_policy_recommend",
    title: "Backup Policy Recommendations",
    description: "Recommend backup policies for volumes based on usage patterns and requirements",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze volumes in"),
        volumeId: z.string().optional().describe("Specific volume to analyze, or analyze all if not provided"),
        backupFrequency: z.enum(["daily", "weekly", "monthly"]).optional().describe("Preferred backup frequency"),
        retentionDays: z.number().optional().describe("How long to keep backups in days")
    },
    outputSchema: {
        recommendations: z.array(z.object({
            volumeId: z.string(),
            recommendedPolicy: z.object({
                dailyBackupLimit: z.number().optional(),
                weeklyBackupLimit: z.number().optional(),
                monthlyBackupLimit: z.number().optional(),
                reasoning: z.string()
            }),
            existingPolicy: z.object({
                backupPolicyId: z.string(),
                enabled: z.boolean()
            }).optional(),
            complianceStatus: z.string()
        })).describe("Backup policy recommendations per volume"),
        volumesWithoutPolicies: z.array(z.string()).describe("Volumes without backup policies assigned"),
        costImplications: z.object({
            estimatedMonthlyCost: z.number(),
            estimatedYearlyCost: z.number()
        }).optional().describe("Cost implications of recommendations")
    }
};

// Resource Cleanup Recommendations Tool
export const resourceCleanupRecommendTool: ToolConfig = {
    name: "gcnv_resource_cleanup_recommend",
    title: "Resource Cleanup Recommendations",
    description: "Identify resources that can be safely deleted or archived (old snapshots, unused volumes, backups beyond retention)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze resources in"),
        resourceType: z.enum(["volumes", "snapshots", "backups", "all"]).optional().describe("Type of resource to analyze (default: all)"),
        dryRun: z.boolean().optional().describe("Only suggest, don't delete (default: true)")
    },
    outputSchema: {
        oldSnapshots: z.array(z.object({
            snapshotId: z.string(),
            volumeId: z.string(),
            ageDays: z.number(),
            canDelete: z.boolean()
        })).describe("Old snapshots that can be deleted"),
        unusedVolumes: z.array(z.object({
            volumeId: z.string(),
            lastAccessTime: z.string().optional(),
            daysSinceCreation: z.number()
        })).describe("Unused volumes (no recent access)"),
        backupsToDelete: z.array(z.object({
            backupId: z.string(),
            volumeId: z.string(),
            ageDays: z.number(),
            reason: z.string()
        })).describe("Backups beyond retention policy"),
        orphanedResources: z.array(z.object({
            resourceId: z.string(),
            resourceType: z.string(),
            reason: z.string()
        })).describe("Orphaned resources"),
        estimatedCostSavings: z.number().describe("Estimated monthly cost savings in USD"),
        safetyChecks: z.array(z.string()).describe("Safety checks performed")
    }
};

// Capacity Optimization Recommendations Tool
export const capacityOptimizationRecommendTool: ToolConfig = {
    name: "gcnv_capacity_optimization_recommend",
    title: "Capacity Optimization Recommendations",
    description: "Provide recommendations for optimizing capacity usage (consolidation, right-sizing, cleanup)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze"),
        optimizationType: z.enum(["consolidation", "right-sizing", "cleanup", "all"]).optional().describe("Type of optimization (default: all)")
    },
    outputSchema: {
        volumesToDownsize: z.array(z.object({
            volumeId: z.string(),
            currentCapacityGib: z.number(),
            recommendedCapacityGib: z.number(),
            utilizationPercent: z.number(),
            estimatedSavings: z.number()
        })).describe("Volumes that can be downsized"),
        volumesToUpsize: z.array(z.object({
            volumeId: z.string(),
            currentCapacityGib: z.number(),
            recommendedCapacityGib: z.number(),
            utilizationPercent: z.number()
        })).describe("Volumes that should be upsized"),
        consolidationOpportunities: z.array(z.object({
            storagePools: z.array(z.string()),
            reasoning: z.string(),
            estimatedSavings: z.number()
        })).describe("Storage pools that can be consolidated"),
        migrationRecommendations: z.array(z.object({
            volumeId: z.string(),
            currentPool: z.string(),
            recommendedPool: z.string(),
            reasoning: z.string()
        })).describe("Recommendations for volume migration"),
        costSavingsEstimate: z.number().describe("Estimated monthly cost savings in USD"),
        autoTieringRecommendations: z.array(z.object({
            storagePoolId: z.string(),
            serviceLevel: z.string(),
            recommendation: z.string(),
            estimatedSavings: z.number()
        })).describe("Recommendations for enabling auto-tiering on eligible pools")
    }
};


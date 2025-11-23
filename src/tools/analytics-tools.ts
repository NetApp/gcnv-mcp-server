import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Volume Capacity Analysis Tool
export const volumeCapacityAnalysisTool: ToolConfig = {
    name: "gcnv_volume_capacity_analysis",
    title: "Volume Capacity Analysis",
    description: "Analyze capacity utilization across volumes to identify high/low utilization and provide optimization recommendations",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze volumes in"),
        storagePoolId: z.string().optional().describe("Optional storage pool ID to filter by"),
        thresholdPercent: z.number().optional().describe("Threshold percentage for highlighting volumes (default: 80)")
    },
    outputSchema: {
        totalAllocatedGib: z.number().describe("Total allocated capacity across all volumes in GiB"),
        totalUsedGib: z.number().describe("Total used capacity across all volumes in GiB"),
        averageUtilizationPercent: z.number().describe("Average utilization percentage"),
        highUtilizationVolumes: z.array(z.object({
            volumeId: z.string(),
            capacityGib: z.number(),
            usedGib: z.number(),
            utilizationPercent: z.number(),
            tieringMetrics: z.object({
                hotTierSizeUsedGib: z.number(),
                coldTierSizeGib: z.number(),
                hotTierPercentage: z.number(),
                coldTierPercentage: z.number()
            }).optional()
        })).describe("Volumes with utilization above threshold"),
        lowUtilizationVolumes: z.array(z.object({
            volumeId: z.string(),
            capacityGib: z.number(),
            usedGib: z.number(),
            utilizationPercent: z.number(),
            tieringMetrics: z.object({
                hotTierSizeUsedGib: z.number(),
                coldTierSizeGib: z.number(),
                hotTierPercentage: z.number(),
                coldTierPercentage: z.number()
            }).optional()
        })).describe("Volumes with utilization below 20%"),
        tieringSummary: z.object({
            volumesWithTiering: z.number(),
            totalHotTierGib: z.number(),
            totalColdTierGib: z.number(),
            hotTierPercentage: z.number(),
            coldTierPercentage: z.number()
        }).optional().describe("Summary of auto-tiering metrics across volumes"),
        recommendations: z.array(z.string()).describe("Capacity optimization recommendations")
    }
};

// Storage Pool Capacity Planning Tool
export const storagePoolCapacityPlanningTool: ToolConfig = {
    name: "gcnv_storage_pool_capacity_planning",
    title: "Storage Pool Capacity Planning",
    description: "Analyze available capacity in storage pools for planning new volumes",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze storage pools in"),
        requiredCapacityGib: z.number().optional().describe("Required capacity in GiB to find suitable pools"),
        serviceLevel: z.enum(["STANDARD", "PREMIUM", "EXTREME", "FLEX"]).optional().describe("Optional service level filter")
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
            canAccommodate: z.boolean().optional().describe("Whether this pool can accommodate the required capacity"),
            autoTieringEnabled: z.boolean().optional().describe("Whether auto-tiering is enabled at pool level (allowAutoTiering field, available for PREMIUM and EXTREME service levels)"),
            autoTieringSavings: z.number().optional().describe("Actual or estimated cost savings from auto-tiering in USD per month"),
            autoTieringAnalysis: z.object({
                totalHotTierGib: z.number().describe("Total hot tier storage used in GiB"),
                totalColdTierGib: z.number().describe("Total cold tier storage used in GiB"),
                hotTierPercentage: z.number().describe("Percentage of used capacity in hot tier"),
                coldTierPercentage: z.number().describe("Percentage of used capacity in cold tier"),
                actualSavings: z.number().describe("Actual monthly savings calculated from cold tier usage")
            }).optional().describe("Detailed auto-tiering analysis with actual hot/cold tier metrics")
        })).describe("Storage pools with capacity information"),
        recommendations: z.array(z.string()).describe("Recommendations for which pool to use")
    }
};

// Resource Cost Estimation Tool
export const resourceCostEstimationTool: ToolConfig = {
    name: "gcnv_resource_cost_estimation",
    title: "Resource Cost Estimation",
    description: "Estimate costs for resources based on capacity and service levels",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location"),
        resourceType: z.enum(["volume", "storagePool", "backup"]).describe("Type of resource to estimate cost for"),
        capacityGib: z.number().describe("Capacity in GiB"),
        serviceLevel: z.enum(["STANDARD", "PREMIUM", "EXTREME", "FLEX"]).optional().describe("Service level (for volumes and storage pools)"),
        durationDays: z.number().optional().describe("Duration in days (for backup retention estimation)")
    },
    outputSchema: {
        estimatedMonthlyCost: z.number().describe("Estimated monthly cost in USD"),
        estimatedYearlyCost: z.number().describe("Estimated yearly cost in USD"),
        costBreakdown: z.record(z.number()).describe("Cost breakdown by component"),
        comparisonWithOtherServiceLevels: z.array(z.object({
            serviceLevel: z.string(),
            monthlyCost: z.number()
        })).optional().describe("Cost comparison with other service levels"),
        costOptimizationSuggestions: z.array(z.string()).describe("Suggestions for cost optimization")
    }
};


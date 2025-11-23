import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Resource Summary Report Tool
export const resourceSummaryReportTool: ToolConfig = {
    name: "gcnv_resource_summary_report",
    title: "Resource Summary Report",
    description: "Generate comprehensive summary report of all resources (counts, capacity, health, cost)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to generate report for"),
        reportType: z.enum(["full", "capacity", "health", "cost"]).optional().describe("Type of report (default: full)"),
        format: z.enum(["json", "text", "markdown"]).optional().describe("Output format (default: json)")
    },
    outputSchema: {
        resourceCounts: z.record(z.number()).describe("Total counts by resource type"),
        capacitySummary: z.object({
            totalCapacityGib: z.number(),
            allocatedCapacityGib: z.number(),
            usedCapacityGib: z.number(),
            availableCapacityGib: z.number()
        }).optional().describe("Capacity summaries"),
        healthSummary: z.object({
            healthyResources: z.number(),
            resourcesInError: z.number(),
            resourcesInWarning: z.number()
        }).optional().describe("Health summaries"),
        costEstimate: z.object({
            estimatedMonthlyCost: z.number(),
            estimatedYearlyCost: z.number(),
            breakdownByServiceLevel: z.record(z.number())
        }).optional().describe("Cost estimates"),
        topResources: z.record(z.array(z.any())).optional().describe("Top resources by various metrics"),
        trends: z.array(z.string()).optional().describe("Trends and insights"),
        reportText: z.string().optional().describe("Human-readable report text")
    }
};

// Capacity Utilization Report Tool
export const capacityUtilizationReportTool: ToolConfig = {
    name: "gcnv_capacity_utilization_report",
    title: "Capacity Utilization Report",
    description: "Detailed capacity utilization report with breakdowns and projections",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze"),
        groupBy: z.enum(["storagePool", "serviceLevel", "protocol"]).optional().describe("Group results by (default: storagePool)"),
        includeProjections: z.boolean().optional().describe("Include future capacity projections (default: false)")
    },
    outputSchema: {
        capacityBreakdown: z.array(z.object({
            group: z.string(),
            totalCapacityGib: z.number(),
            allocatedCapacityGib: z.number(),
            usedCapacityGib: z.number(),
            utilizationPercent: z.number(),
            autoTieringEnabled: z.boolean().optional().describe("Whether auto-tiering is enabled"),
            autoTieringSavings: z.number().optional().describe("Estimated monthly savings from auto-tiering")
        })).describe("Capacity breakdown by group"),
        utilizationPercentages: z.record(z.number()).describe("Utilization percentages by group"),
        growthTrends: z.array(z.object({
            period: z.string(),
            capacityGib: z.number()
        })).optional().describe("Capacity growth trends"),
        projections: z.object({
            projectedCapacity30Days: z.number(),
            projectedCapacity90Days: z.number(),
            projectedCapacity1Year: z.number()
        }).optional().describe("Projections for future capacity needs"),
        recommendations: z.array(z.string()).describe("Recommendations based on utilization")
    }
};

// Cost Analysis Report Tool
export const costAnalysisReportTool: ToolConfig = {
    name: "gcnv_cost_analysis_report",
    title: "Cost Analysis Report",
    description: "Cost analysis and breakdown by resource type, service level, and storage pool",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to analyze"),
        groupBy: z.enum(["storagePool", "serviceLevel", "volume"]).optional().describe("Group costs by (default: serviceLevel)"),
        timeRange: z.enum(["monthly", "yearly"]).optional().describe("Time range for cost calculation (default: monthly)")
    },
    outputSchema: {
        costBreakdown: z.array(z.object({
            group: z.string(),
            monthlyCost: z.number(),
            yearlyCost: z.number(),
            capacityGib: z.number(),
            costPerGib: z.number()
        })).describe("Cost breakdown by group"),
        totalCost: z.object({
            monthly: z.number(),
            yearly: z.number()
        }).describe("Total costs"),
        costByServiceLevel: z.record(z.number()).describe("Cost by service level"),
        costByStoragePool: z.record(z.number()).optional().describe("Cost by storage pool"),
        costTrends: z.array(z.object({
            period: z.string(),
            cost: z.number()
        })).optional().describe("Cost trends over time"),
        costOptimizationOpportunities: z.array(z.object({
            opportunity: z.string(),
            estimatedSavings: z.number(),
            description: z.string()
        })).describe("Cost optimization opportunities"),
        autoTieringAnalysis: z.object({
            poolsWithAutoTiering: z.number().describe("Number of pools with auto-tiering enabled"),
            poolsEligibleForAutoTiering: z.number().describe("Number of PREMIUM/EXTREME pools without auto-tiering"),
            estimatedTotalSavings: z.number().describe("Estimated total monthly savings if auto-tiering enabled on all eligible pools")
        }).optional().describe("Auto-tiering analysis and recommendations")
    }
};


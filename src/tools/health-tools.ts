import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Resource Health Check Tool
export const resourceHealthCheckTool: ToolConfig = {
    name: "gcnv_resource_health_check",
    title: "Resource Health Check",
    description: "Check health status of resources and identify issues (errors, warnings, failed operations, unhealthy replications)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check resources in"),
        resourceType: z.enum(["all", "volume", "storagePool", "replication", "backup"]).optional().describe("Type of resource to check (default: all)"),
        includeWarnings: z.boolean().optional().describe("Include warnings in addition to errors (default: true)")
    },
    outputSchema: {
        resourcesInError: z.array(z.object({
            resourceId: z.string(),
            resourceType: z.string(),
            state: z.string(),
            errorMessage: z.string().optional()
        })).describe("Resources in ERROR state"),
        resourcesInWarning: z.array(z.object({
            resourceId: z.string(),
            resourceType: z.string(),
            state: z.string(),
            warningMessage: z.string().optional()
        })).describe("Resources in WARNING state"),
        failedOperations: z.array(z.object({
            operationId: z.string(),
            operationType: z.string(),
            errorMessage: z.string()
        })).describe("Failed operations"),
        unhealthyReplications: z.array(z.object({
            replicationId: z.string(),
            state: z.string(),
            lastReplicationTime: z.string().optional()
        })).describe("Unhealthy replications"),
        volumesWithoutRecentBackups: z.array(z.object({
            volumeId: z.string(),
            lastBackupTime: z.string().optional()
        })).describe("Volumes without recent backups"),
        healthSummary: z.object({
            totalResources: z.number(),
            healthyResources: z.number(),
            resourcesInError: z.number(),
            resourcesInWarning: z.number()
        }).describe("Summary of health metrics")
    }
};

// Resources Needing Attention Tool
export const resourcesNeedingAttentionTool: ToolConfig = {
    name: "gcnv_resources_needing_attention",
    title: "Resources Needing Attention",
    description: "Identify resources that need administrative attention (high utilization, capacity issues, failed operations, missing backups, etc.)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check resources in"),
        severity: z.enum(["error", "warning", "info", "all"]).optional().describe("Minimum severity level (default: all)")
    },
    outputSchema: {
        highUtilizationVolumes: z.array(z.object({
            volumeId: z.string(),
            utilizationPercent: z.number()
        })).describe("Volumes with utilization >90%"),
        storagePoolsApproachingCapacity: z.array(z.object({
            storagePoolId: z.string(),
            utilizationPercent: z.number()
        })).describe("Storage pools approaching capacity"),
        failedOperations: z.array(z.object({
            operationId: z.string(),
            operationType: z.string()
        })).describe("Failed or stuck operations"),
        replicationsNotSynced: z.array(z.object({
            replicationId: z.string(),
            lastReplicationTime: z.string().optional()
        })).describe("Replications that haven't synced recently"),
        volumesWithoutBackups: z.array(z.object({
            volumeId: z.string(),
            daysSinceLastBackup: z.number().optional()
        })).describe("Volumes without backups in last 7 days"),
        oldSnapshots: z.array(z.object({
            snapshotId: z.string(),
            ageDays: z.number()
        })).describe("Snapshots older than retention policy"),
        resourcesMissingLabels: z.array(z.object({
            resourceId: z.string(),
            resourceType: z.string()
        })).describe("Resources with missing or incorrect labels")
    }
};

// Operation Status Summary Tool
export const operationStatusSummaryTool: ToolConfig = {
    name: "gcnv_operation_status_summary",
    title: "Operation Status Summary",
    description: "Get summary of all operations and their statuses (counts, failed operations, long-running operations, average duration)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check operations in"),
        operationType: z.string().optional().describe("Filter by operation type"),
        status: z.enum(["PENDING", "RUNNING", "DONE", "CANCELLED"]).optional().describe("Filter by status"),
        timeRange: z.enum(["24h", "7d", "30d"]).optional().describe("Time range for operations (default: 7d)")
    },
    outputSchema: {
        operationCounts: z.record(z.number()).describe("Count of operations by status"),
        failedOperations: z.array(z.object({
            operationId: z.string(),
            operationType: z.string(),
            errorMessage: z.string(),
            startTime: z.string()
        })).describe("List of failed operations with error details"),
        longRunningOperations: z.array(z.object({
            operationId: z.string(),
            operationType: z.string(),
            durationMinutes: z.number()
        })).describe("Operations running longer than expected"),
        averageDurationByType: z.record(z.number()).describe("Average operation duration in minutes by type"),
        recommendations: z.array(z.string()).describe("Recommendations for stuck operations")
    }
};


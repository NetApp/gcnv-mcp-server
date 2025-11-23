import { z } from 'zod';
import { ToolConfig } from "../types/tool.js";

// Label Compliance Check Tool
export const labelComplianceCheckTool: ToolConfig = {
    name: "gcnv_label_compliance_check",
    title: "Label Compliance Check",
    description: "Check if resources comply with labeling requirements",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check resources in"),
        requiredLabels: z.array(z.string()).describe("Array of required label keys"),
        resourceType: z.enum(["volume", "storagePool", "snapshot", "backup", "all"]).optional().describe("Type of resource to check (default: all)")
    },
    outputSchema: {
        nonCompliantResources: z.array(z.object({
            resourceId: z.string(),
            resourceType: z.string(),
            missingLabels: z.array(z.string()),
            incorrectLabels: z.record(z.string()).optional()
        })).describe("Resources missing required labels"),
        compliancePercentage: z.number().describe("Percentage of resources that are compliant"),
        recommendations: z.array(z.string()).describe("Recommendations for fixing non-compliance")
    }
};

// Backup Compliance Check Tool
export const backupComplianceCheckTool: ToolConfig = {
    name: "gcnv_backup_compliance_check",
    title: "Backup Compliance Check",
    description: "Verify backup compliance for volumes (recent backups, backup policy assignments)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check volumes in"),
        backupPolicyId: z.string().optional().describe("Check against specific backup policy"),
        maxDaysWithoutBackup: z.number().optional().describe("Maximum days without backup for compliance (default: 7)")
    },
    outputSchema: {
        volumesWithoutRecentBackups: z.array(z.object({
            volumeId: z.string(),
            daysSinceLastBackup: z.number().optional(),
            lastBackupTime: z.string().optional(),
            backupVault: z.string().optional()
        })).describe("Volumes without recent backups"),
        volumesWithoutPolicies: z.array(z.object({
            volumeId: z.string(),
            recommendedPolicy: z.string().optional()
        })).describe("Volumes not assigned to backup policies"),
        backupPolicyViolations: z.array(z.object({
            volumeId: z.string(),
            backupPolicyId: z.string(),
            violationReason: z.string(),
            lastBackupTime: z.string().optional(),
            daysSinceLastBackup: z.number().optional()
        })).describe("Backup policy violations"),
        compliancePercentage: z.number().describe("Percentage of volumes that are compliant"),
        recommendations: z.array(z.string()).describe("Recommendations for improving compliance")
    }
};

// Security Compliance Check Tool
export const securityComplianceCheckTool: ToolConfig = {
    name: "gcnv_security_compliance_check",
    title: "Security Compliance Check",
    description: "Check security compliance of volumes (export policies, root access, Kerberos, protocols)",
    inputSchema: {
        projectId: z.string().describe("The ID of the Google Cloud project"),
        location: z.string().describe("The location to check volumes in"),
        securityRules: z.record(z.any()).optional().describe("Custom security rules to check")
    },
    outputSchema: {
        volumesWithPermissivePolicies: z.array(z.object({
            volumeId: z.string(),
            issue: z.string(),
            exportPolicy: z.any()
        })).describe("Volumes with overly permissive export policies"),
        volumesWithRootAccess: z.array(z.object({
            volumeId: z.string(),
            exportPolicy: z.any()
        })).describe("Volumes allowing root access without restrictions"),
        volumesWithoutKerberos: z.array(z.object({
            volumeId: z.string(),
            exportPolicy: z.any()
        })).describe("Volumes without Kerberos authentication"),
        volumesWithInsecureProtocols: z.array(z.object({
            volumeId: z.string(),
            protocols: z.array(z.string())
        })).describe("Volumes with insecure protocols only"),
        smbVolumesWithoutAbe: z.array(z.object({
            volumeId: z.string(),
            shareName: z.string(),
            issue: z.string()
        })).describe("SMB volumes without Access-Based Enumeration enabled"),
        smbVolumesWithoutVss: z.array(z.object({
            volumeId: z.string(),
            shareName: z.string(),
            issue: z.string()
        })).describe("SMB volumes without VSS (Volume Shadow Copy Service) enabled"),
        smbVolumesWithUnencryptedAccess: z.array(z.object({
            volumeId: z.string(),
            shareName: z.string(),
            issue: z.string()
        })).describe("SMB volumes allowing unencrypted access"),
        securityRecommendations: z.array(z.string()).describe("Security recommendations")
    }
};


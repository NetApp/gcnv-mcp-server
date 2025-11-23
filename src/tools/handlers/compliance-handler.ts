import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Label Compliance Check Handler
export const labelComplianceCheckHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, requiredLabels, resourceType = 'all' } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const nonCompliantResources: any[] = [];
            let totalResources = 0;

            const checkResources = async (type: string, listFn: () => Promise<any[]>) => {
                const resources = await listFn();
                totalResources += resources.length;

                resources.forEach((resource: any) => {
                    const nameParts = resource.name?.split('/') || [];
                    const resourceId = nameParts[nameParts.length - 1] || '';
                    const labels = resource.labels || {};
                    
                    const missingLabels = requiredLabels.filter((key: string) => !labels[key]);
                    if (missingLabels.length > 0) {
                        nonCompliantResources.push({
                            resourceId,
                            resourceType: type,
                            missingLabels,
                            incorrectLabels: undefined
                        });
                    }
                });
            };

            if (resourceType === 'all' || resourceType === 'volume') {
                await checkResources('volume', async () => {
                    const [volumes] = await netAppClient.listVolumes({ parent });
                    return volumes;
                });
            }

            if (resourceType === 'all' || resourceType === 'storagePool') {
                await checkResources('storagePool', async () => {
                    const [pools] = await netAppClient.listStoragePools({ parent });
                    return pools;
                });
            }

            const compliancePercentage = totalResources > 0 
                ? ((totalResources - nonCompliantResources.length) / totalResources) * 100 
                : 100;

            const recommendations: string[] = [];
            if (nonCompliantResources.length > 0) {
                recommendations.push(`Add missing labels to ${nonCompliantResources.length} resources`);
                recommendations.push('Use automation to enforce labeling policies');
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        nonCompliantResources,
                        compliancePercentage: Math.round(compliancePercentage * 100) / 100,
                        recommendations
                    }, null, 2)
                }],
                structuredContent: {
                    nonCompliantResources,
                    compliancePercentage: Math.round(compliancePercentage * 100) / 100,
                    recommendations
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error checking label compliance: ${error.message}` }]
            };
        }
    };

// Backup Compliance Check Handler
export const backupComplianceCheckHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, backupPolicyId, maxDaysWithoutBackup = 7 } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [volumes] = await netAppClient.listVolumes({ parent });
            const [backupVaults] = await netAppClient.listBackupVaults({ parent });

            const volumesWithoutRecentBackups: any[] = [];
            const volumesWithoutPolicies: any[] = [];
            const backupPolicyViolations: any[] = [];

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxDaysWithoutBackup);

            for (const vol of volumes) {
                const nameParts = vol.name?.split('/') || [];
                const volumeId = nameParts[nameParts.length - 1] || '';

                let hasRecentBackup = false;
                let lastBackupTime: Date | undefined;

                for (const vault of backupVaults) {
                    try {
                        const [backups] = await netAppClient.listBackups({
                            parent: vault.name || '',
                            filter: `volume="${vol.name}"`
                        });

                        const recentBackup = backups.find((b: any) => {
                            if (!b.createTime) return false;
                            const backupTime = new Date(b.createTime.seconds * 1000);
                            if (backupTime > cutoffDate) {
                                if (!lastBackupTime || backupTime > lastBackupTime) {
                                    lastBackupTime = backupTime;
                                }
                                return true;
                            }
                            return false;
                        });

                        if (recentBackup) {
                            hasRecentBackup = true;
                        }
                    } catch {
                        // Continue
                    }
                }

                if (!hasRecentBackup) {
                    const daysSince = lastBackupTime 
                        ? Math.floor((Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60 * 24))
                        : undefined;
                    volumesWithoutRecentBackups.push({
                        volumeId,
                        daysSinceLastBackup: daysSince
                    });
                }

                // Check for backup policy assignment
                // Note: Would need to check volume's backup policy assignment
                volumesWithoutPolicies.push({
                    volumeId,
                    recommendedPolicy: undefined
                });
            }

            const totalVolumes = volumes.length;
            const compliantVolumes = totalVolumes - volumesWithoutRecentBackups.length;
            const compliancePercentage = totalVolumes > 0 
                ? (compliantVolumes / totalVolumes) * 100 
                : 100;

            const recommendations: string[] = [];
            if (volumesWithoutRecentBackups.length > 0) {
                recommendations.push(`Ensure ${volumesWithoutRecentBackups.length} volumes have recent backups`);
            }
            if (volumesWithoutPolicies.length > 0) {
                recommendations.push(`Assign backup policies to ${volumesWithoutPolicies.length} volumes`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        volumesWithoutRecentBackups,
                        volumesWithoutPolicies,
                        backupPolicyViolations,
                        compliancePercentage: Math.round(compliancePercentage * 100) / 100,
                        recommendations
                    }, null, 2)
                }],
                structuredContent: {
                    volumesWithoutRecentBackups,
                    volumesWithoutPolicies,
                    backupPolicyViolations,
                    compliancePercentage: Math.round(compliancePercentage * 100) / 100,
                    recommendations
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error checking backup compliance: ${error.message}` }]
            };
        }
    };

// Security Compliance Check Handler
export const securityComplianceCheckHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, securityRules } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [volumes] = await netAppClient.listVolumes({ parent });

            const volumesWithPermissivePolicies: any[] = [];
            const volumesWithRootAccess: any[] = [];
            const volumesWithoutKerberos: any[] = [];
            const volumesWithInsecureProtocols: any[] = [];

            volumes.forEach((vol: any) => {
                const nameParts = vol.name?.split('/') || [];
                const volumeId = nameParts[nameParts.length - 1] || '';
                const exportPolicy = vol.exportPolicy;
                const protocols = vol.shareProtocols || vol.protocols || [];

                // Check for permissive policies (0.0.0.0/0)
                if (exportPolicy?.rules) {
                    const hasPermissive = exportPolicy.rules.some((rule: any) => 
                        rule.allowedClients === '0.0.0.0/0');
                    
                    if (hasPermissive) {
                        volumesWithPermissivePolicies.push({
                            volumeId,
                            issue: 'Allows access from any IP (0.0.0.0/0)',
                            exportPolicy
                        });
                    }

                    // Check for root access
                    const hasRootAccess = exportPolicy.rules.some((rule: any) => 
                        (rule as any).hasRootAccess === true || 
                        ((rule as any).nfsOptions && !(rule as any).nfsOptions.rootSquash));
                    
                    if (hasRootAccess) {
                        volumesWithRootAccess.push({
                            volumeId,
                            exportPolicy
                        });
                    }

                    // Check for Kerberos
                    const hasKerberos = exportPolicy.rules.some((rule: any) =>
                        rule.kerberos_5ReadOnly || rule.kerberos_5ReadWrite ||
                        rule.kerberos_5iReadOnly || rule.kerberos_5iReadWrite ||
                        rule.kerberos_5pReadOnly || rule.kerberos_5pReadWrite);
                    
                    if (!hasKerberos) {
                        volumesWithoutKerberos.push({
                            volumeId,
                            exportPolicy
                        });
                    }
                }

                // Check for insecure protocols (only NFSV3 without security)
                if (protocols.length === 1 && protocols[0] === 'NFSV3') {
                    volumesWithInsecureProtocols.push({
                        volumeId,
                        protocols
                    });
                }
            });

            const securityRecommendations: string[] = [];
            if (volumesWithPermissivePolicies.length > 0) {
                securityRecommendations.push(`Restrict IP access for ${volumesWithPermissivePolicies.length} volumes`);
            }
            if (volumesWithRootAccess.length > 0) {
                securityRecommendations.push(`Enable root squashing for ${volumesWithRootAccess.length} volumes`);
            }
            if (volumesWithoutKerberos.length > 0) {
                securityRecommendations.push(`Enable Kerberos authentication for ${volumesWithoutKerberos.length} volumes`);
            }
            if (volumesWithInsecureProtocols.length > 0) {
                securityRecommendations.push(`Consider upgrading ${volumesWithInsecureProtocols.length} volumes to NFSV4 or enable security`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        volumesWithPermissivePolicies,
                        volumesWithRootAccess,
                        volumesWithoutKerberos,
                        volumesWithInsecureProtocols,
                        securityRecommendations
                    }, null, 2)
                }],
                structuredContent: {
                    volumesWithPermissivePolicies,
                    volumesWithRootAccess,
                    volumesWithoutKerberos,
                    volumesWithInsecureProtocols,
                    securityRecommendations
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error checking security compliance: ${error.message}` }]
            };
        }
    };


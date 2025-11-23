import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";
import { getVolumeBackupStatus } from "../../utils/backup-status-helper.js";

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

            for (const vol of volumes) {
                const nameParts = vol.name?.split('/') || [];
                const volumeId = nameParts[nameParts.length - 1] || '';

                // Get comprehensive backup status
                const backupStatus = await getVolumeBackupStatus(netAppClient, vol, parent, maxDaysWithoutBackup);

                // Check for volumes without recent backups
                if (!backupStatus.hasRecentBackup) {
                    volumesWithoutRecentBackups.push({
                        volumeId,
                        daysSinceLastBackup: backupStatus.daysSinceLastBackup,
                        lastBackupTime: backupStatus.lastBackupTime?.toISOString(),
                        backupVault: backupStatus.backupVault
                    });
                }

                // Check for volumes without backup policies
                if (!backupStatus.hasBackupPolicy) {
                    volumesWithoutPolicies.push({
                        volumeId,
                        recommendedPolicy: undefined
                    });
                }

                // Check for backup policy violations (policy assigned but not compliant)
                if (backupStatus.hasBackupPolicy && backupStatus.status === 'non_compliant') {
                    backupPolicyViolations.push({
                        volumeId,
                        backupPolicyId: backupStatus.backupPolicyId || '',
                        violationReason: `No recent backup within ${maxDaysWithoutBackup} days`,
                        lastBackupTime: backupStatus.lastBackupTime?.toISOString(),
                        daysSinceLastBackup: backupStatus.daysSinceLastBackup
                    });
                }

                // If specific backup policy ID is provided, check if volume should have it
                if (backupPolicyId && (!backupStatus.hasBackupPolicy || backupStatus.backupPolicyId !== backupPolicyId.split('/').pop())) {
                    backupPolicyViolations.push({
                        volumeId,
                        backupPolicyId: backupPolicyId,
                        violationReason: 'Volume does not have the specified backup policy assigned'
                    });
                }
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
            const smbVolumesWithoutAbe: any[] = [];
            const smbVolumesWithoutVss: any[] = [];
            const smbVolumesWithUnencryptedAccess: any[] = [];

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

                // Check SMB share settings
                const isSmbVolume = protocols.includes('SMB') || protocols.includes('DUAL');
                if (isSmbVolume) {
                    const shareSettings = (vol as any).shareSettings || (vol as any).smbSettings;
                    const settingsArray = Array.isArray(shareSettings)
                        ? shareSettings
                        : (shareSettings?.settings || shareSettings?.smbSettings || []);

                    // Check for Access-Based Enumeration
                    if (!settingsArray.includes('ACCESS_BASED_ENUMERATION')) {
                        smbVolumesWithoutAbe.push({
                            volumeId,
                            shareName: vol.shareName || '',
                            issue: 'ACCESS_BASED_ENUMERATION is not enabled - users can see all files/folders'
                        });
                    }

                    // Check for SHOW_SNAPSHOT (similar to VSS functionality)
                    if (!settingsArray.includes('SHOW_SNAPSHOT')) {
                        smbVolumesWithoutVss.push({
                            volumeId,
                            shareName: vol.shareName || '',
                            issue: 'SHOW_SNAPSHOT is not enabled - snapshots may not be visible'
                        });
                    }

                    // Check for encryption (ENCRYPT_DATA not present means unencrypted access is allowed)
                    if (!settingsArray.includes('ENCRYPT_DATA')) {
                        smbVolumesWithUnencryptedAccess.push({
                            volumeId,
                            shareName: vol.shareName || '',
                            issue: 'ENCRYPT_DATA is not enabled - unencrypted access is allowed (security risk)'
                        });
                    }
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
            if (smbVolumesWithoutAbe.length > 0) {
                securityRecommendations.push(`Enable Access-Based Enumeration for ${smbVolumesWithoutAbe.length} SMB volumes`);
            }
            if (smbVolumesWithoutVss.length > 0) {
                securityRecommendations.push(`Enable VSS for ${smbVolumesWithoutVss.length} SMB volumes to enable backup/recovery`);
            }
            if (smbVolumesWithUnencryptedAccess.length > 0) {
                securityRecommendations.push(`Disable unencrypted access for ${smbVolumesWithUnencryptedAccess.length} SMB volumes`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        volumesWithPermissivePolicies,
                        volumesWithRootAccess,
                        volumesWithoutKerberos,
                        volumesWithInsecureProtocols,
                        smbVolumesWithoutAbe,
                        smbVolumesWithoutVss,
                        smbVolumesWithUnencryptedAccess,
                        securityRecommendations
                    }, null, 2)
                }],
                structuredContent: {
                    volumesWithPermissivePolicies,
                    volumesWithRootAccess,
                    volumesWithoutKerberos,
                    volumesWithInsecureProtocols,
                    smbVolumesWithoutAbe,
                    smbVolumesWithoutVss,
                    smbVolumesWithUnencryptedAccess,
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


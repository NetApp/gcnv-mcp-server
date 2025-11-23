import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";
import { getVolumeBackupStatus } from "../../utils/backup-status-helper.js";

// Advanced Volume Search Handler
export const advancedVolumeSearchHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const {
                projectId,
                location,
                protocols,
                minCapacityGib,
                maxCapacityGib,
                labels,
                state,
                hasSnapshots,
                hasBackups,
                hasReplication,
                autoTieringEnabled,
                autoTieringAction,
                hasSnapshotPolicy,
                smbAccessBasedEnumeration,
                smbContinuouslyAvailable,
                smbEncryptData,
                smbShowSnapshot,
                smbShowPreviousVersions
            } = args;

            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            // List all volumes
            const [allVolumes] = await netAppClient.listVolumes({ parent });

            // Filter volumes based on criteria
            let filteredVolumes = allVolumes;

            // Filter by protocols
            if (protocols && protocols.length > 0) {
                filteredVolumes = filteredVolumes.filter((vol: any) => {
                    const volProtocols = vol.shareProtocols || vol.protocols || [];
                    return protocols.some((p: string) => volProtocols.includes(p));
                });
            }

            // Filter by capacity range
            if (minCapacityGib !== undefined) {
                filteredVolumes = filteredVolumes.filter((vol: any) =>
                    Number(vol.capacityGib || 0) >= minCapacityGib);
            }
            if (maxCapacityGib !== undefined) {
                filteredVolumes = filteredVolumes.filter((vol: any) =>
                    Number(vol.capacityGib || 0) <= maxCapacityGib);
            }

            // Filter by state
            if (state) {
                filteredVolumes = filteredVolumes.filter((vol: any) => vol.state === state);
            }

            // Filter by labels
            if (labels) {
                filteredVolumes = filteredVolumes.filter((vol: any) => {
                    const volLabels = vol.labels || {};
                    return Object.entries(labels).every(([key, value]) =>
                        volLabels[key] === value);
                });
            }

            // Filter by snapshots (requires checking each volume)
            if (hasSnapshots !== undefined) {
                const volumesWithSnapshots = await Promise.all(
                    filteredVolumes.map(async (vol: any) => {
                        const nameParts = vol.name?.split('/') || [];
                        const volumeId = nameParts[nameParts.length - 1];
                        const storagePoolParts = vol.storagePool?.split('/') || [];
                        const storagePoolId = storagePoolParts[storagePoolParts.length - 1];

                        try {
                            const [snapshots] = await netAppClient.listSnapshots({
                                parent: vol.name?.replace(/\/volumes\/[^/]+$/, '') || parent,
                                filter: `volume="${vol.name}"`
                            });
                            return { vol, hasSnapshots: snapshots.length > 0 };
                        } catch {
                            return { vol, hasSnapshots: false };
                        }
                    })
                );
                filteredVolumes = volumesWithSnapshots
                    .filter((item: any) => item.hasSnapshots === hasSnapshots)
                    .map((item: any) => item.vol);
            }

            // Filter by backups (requires checking backup vaults and policies)
            if (hasBackups !== undefined) {
                const volumesWithBackups = await Promise.all(
                    filteredVolumes.map(async (vol: any) => {
                        try {
                            const backupStatus = await getVolumeBackupStatus(netAppClient, vol, parent);
                            // Consider volume as having backups if it has recent backups OR has a backup policy assigned
                            const hasBackups = backupStatus.hasRecentBackup || backupStatus.hasBackupPolicy;
                            return { vol, hasBackups };
                        } catch {
                            return { vol, hasBackups: false };
                        }
                    })
                );
                filteredVolumes = volumesWithBackups
                    .filter((item: any) => item.hasBackups === hasBackups)
                    .map((item: any) => item.vol);
            }

            // Filter by replication (requires checking replications - replications are scoped to volumes)
            if (hasReplication !== undefined) {
                const volumesWithReplication = await Promise.all(
                    filteredVolumes.map(async (vol: any) => {
                        try {
                            // Replications are scoped to volumes, so parent must be the volume name
                            const [replications] = await netAppClient.listReplications({
                                parent: vol.name || '',
                                filter: `sourceVolume="${vol.name}" OR destinationVolume="${vol.name}"`
                            });
                            return { vol, hasReplication: replications.length > 0 };
                        } catch {
                            return { vol, hasReplication: false };
                        }
                    })
                );
                filteredVolumes = volumesWithReplication
                    .filter((item: any) => item.hasReplication === hasReplication)
                    .map((item: any) => item.vol);
            }

            // Filter by auto-tiering (requires checking parent pool and volume tiering policy)
            if (autoTieringEnabled !== undefined || autoTieringAction !== undefined) {
                const volumesWithTiering = await Promise.all(
                    filteredVolumes.map(async (vol: any) => {
                        try {
                            // First check if parent pool has allowAutoTiering enabled
                            const storagePoolName = vol.storagePool;
                            if (!storagePoolName) {
                                return { vol, tieringEnabled: false, tierAction: null };
                            }

                            const [pool] = await netAppClient.getStoragePool({ name: storagePoolName });
                            const poolAllowsTiering = (pool as any).allowAutoTiering === true;

                            if (!poolAllowsTiering) {
                                return { vol, tieringEnabled: false, tierAction: null };
                            }

                            // Check volume's TieringPolicy
                            const tieringPolicy = (vol as any).tieringPolicy;
                            const tierAction = tieringPolicy?.tierAction || null;
                            const isTieringEnabled = tierAction === 'ENABLED';

                            return { vol, tieringEnabled: isTieringEnabled, tierAction };
                        } catch {
                            return { vol, tieringEnabled: false, tierAction: null };
                        }
                    })
                );

                if (autoTieringEnabled !== undefined) {
                    filteredVolumes = volumesWithTiering
                        .filter((item: any) => item.tieringEnabled === autoTieringEnabled)
                        .map((item: any) => item.vol);
                }

                if (autoTieringAction !== undefined) {
                    filteredVolumes = volumesWithTiering
                        .filter((item: any) => item.tierAction === autoTieringAction)
                        .map((item: any) => item.vol);
                }
            }

            // Filter by snapshot policy
            if (hasSnapshotPolicy !== undefined) {
                filteredVolumes = filteredVolumes.filter((vol: any) => {
                    const snapshotPolicy = (vol as any).snapshotPolicy;
                    const hasPolicy = snapshotPolicy !== undefined && snapshotPolicy !== null;
                    return hasPolicy === hasSnapshotPolicy;
                });
            }

            // Filter by SMB share settings (check for enum values in settings array)
            if (smbAccessBasedEnumeration !== undefined || smbContinuouslyAvailable !== undefined ||
                smbEncryptData !== undefined || smbShowSnapshot !== undefined || smbShowPreviousVersions !== undefined) {
                filteredVolumes = filteredVolumes.filter((vol: any) => {
                    const volProtocols = vol.shareProtocols || vol.protocols || [];
                    const isSmbVolume = volProtocols.includes('SMB') || volProtocols.includes('DUAL');

                    if (!isSmbVolume) return false;

                    const shareSettings = (vol as any).shareSettings || (vol as any).smbSettings;
                    const settingsArray = Array.isArray(shareSettings)
                        ? shareSettings
                        : (shareSettings?.settings || shareSettings?.smbSettings || []);

                    if (smbAccessBasedEnumeration !== undefined) {
                        const hasAbe = settingsArray.includes('ACCESS_BASED_ENUMERATION');
                        if (hasAbe !== smbAccessBasedEnumeration) return false;
                    }

                    if (smbContinuouslyAvailable !== undefined) {
                        const hasCa = settingsArray.includes('CONTINUOUSLY_AVAILABLE');
                        if (hasCa !== smbContinuouslyAvailable) return false;
                    }

                    if (smbEncryptData !== undefined) {
                        const hasEncrypt = settingsArray.includes('ENCRYPT_DATA');
                        if (hasEncrypt !== smbEncryptData) return false;
                    }

                    if (smbShowSnapshot !== undefined) {
                        const hasSnapshot = settingsArray.includes('SHOW_SNAPSHOT');
                        if (hasSnapshot !== smbShowSnapshot) return false;
                    }

                    if (smbShowPreviousVersions !== undefined) {
                        const hasPrevVersions = settingsArray.includes('SHOW_PREVIOUS_VERSIONS');
                        if (hasPrevVersions !== smbShowPreviousVersions) return false;
                    }

                    return true;
                });
            }

            // Format results - need to get pool info for tiering policy
            const formattedVolumes = await Promise.all(
                filteredVolumes.map(async (vol: any) => {
                    const nameParts = vol.name?.split('/') || [];
                    const volumeId = nameParts[nameParts.length - 1] || '';

                    // Get tiering policy if parent pool allows it
                    let tieringPolicy = undefined;
                    const storagePoolName = vol.storagePool;
                    if (storagePoolName) {
                        try {
                            const [pool] = await netAppClient.getStoragePool({ name: storagePoolName });
                            const poolAllowsTiering = (pool as any).allowAutoTiering === true;

                            if (poolAllowsTiering && (vol as any).tieringPolicy) {
                                const tp = (vol as any).tieringPolicy;
                                tieringPolicy = {
                                    tierAction: tp.tierAction || null,
                                    coolingThresholdDays: tp.coolingThresholdDays || null
                                };
                            }
                        } catch {
                            // Continue without tiering policy
                        }
                    }

                    // Get snapshot policy
                    const snapshotPolicy = (vol as any).snapshotPolicy ? {
                        enabled: (vol as any).snapshotPolicy.enabled !== false,
                        hourlySchedule: (vol as any).snapshotPolicy.hourlySchedule || null,
                        dailySchedule: (vol as any).snapshotPolicy.dailySchedule || null,
                        weeklySchedule: (vol as any).snapshotPolicy.weeklySchedule || null,
                        monthlySchedule: (vol as any).snapshotPolicy.monthlySchedule || null
                    } : undefined;

                    // Get backup status
                    const backupStatus = await getVolumeBackupStatus(netAppClient, vol, parent);

                    // Get tiering metrics if available
                    let tieringMetrics = undefined;
                    if (vol.hotTierSizeUsedGib !== undefined || vol.coldTierSizeGib !== undefined) {
                        const hotTierGib = vol.hotTierSizeUsedGib ? Number(vol.hotTierSizeUsedGib) : 0;
                        const coldTierGib = vol.coldTierSizeGib ? Number(vol.coldTierSizeGib) : 0;
                        const usedGib = Number(vol.usedGib || 0);
                        tieringMetrics = {
                            hotTierSizeUsedGib: hotTierGib,
                            coldTierSizeGib: coldTierGib,
                            hotTierPercentage: usedGib > 0 ? Math.round((hotTierGib / usedGib) * 10000) / 100 : 0,
                            coldTierPercentage: usedGib > 0 ? Math.round((coldTierGib / usedGib) * 10000) / 100 : 0,
                            tieringRatio: hotTierGib > 0 ? Math.round((coldTierGib / hotTierGib) * 100) / 100 : (coldTierGib > 0 ? Infinity : 0)
                        };
                    }

                    // Get SMB share settings
                    const volProtocols = vol.shareProtocols || vol.protocols || [];
                    const isSmbVolume = volProtocols.includes('SMB') || volProtocols.includes('DUAL');
                    let shareSettings = undefined;
                    if (isSmbVolume) {
                        const ss = (vol as any).shareSettings || (vol as any).smbSettings;
                        const settingsArray = Array.isArray(ss)
                            ? ss
                            : (ss?.settings || ss?.smbSettings || []);

                        shareSettings = {
                            shareName: vol.shareName || '',
                            settings: settingsArray,
                            hasAccessBasedEnumeration: settingsArray.includes('ACCESS_BASED_ENUMERATION'),
                            hasContinuouslyAvailable: settingsArray.includes('CONTINUOUSLY_AVAILABLE'),
                            hasEncryptData: settingsArray.includes('ENCRYPT_DATA'),
                            hasBrowsable: settingsArray.includes('BROWSABLE'),
                            hasChangeNotify: settingsArray.includes('CHANGE_NOTIFY'),
                            hasNonBrowsable: settingsArray.includes('NON_BROWSABLE'),
                            hasOplocks: settingsArray.includes('OPLOCKS'),
                            hasShowSnapshot: settingsArray.includes('SHOW_SNAPSHOT'),
                            hasShowPreviousVersions: settingsArray.includes('SHOW_PREVIOUS_VERSIONS')
                        };
                    }

                    return {
                        volumeId,
                        capacityGib: Number(vol.capacityGib || 0),
                        usedGib: vol.usedGib ? Number(vol.usedGib) : undefined,
                        protocols: vol.shareProtocols || vol.protocols || [],
                        state: vol.state || '',
                        labels: vol.labels || {},
                        storagePool: vol.storagePool || '',
                        tieringPolicy,
                        tieringMetrics,
                        snapshotPolicy,
                        backupStatus: {
                            status: backupStatus.status,
                            hasBackupPolicy: backupStatus.hasBackupPolicy,
                            backupPolicyId: backupStatus.backupPolicyId,
                            backupPolicyEnabled: backupStatus.backupPolicyEnabled,
                            hasRecentBackup: backupStatus.hasRecentBackup,
                            lastBackupTime: backupStatus.lastBackupTime?.toISOString(),
                            backupVault: backupStatus.backupVault,
                            backupCount: backupStatus.backupCount
                        },
                        shareSettings
                    };
                })
            );

            // Calculate summary
            const totalCapacityGib = formattedVolumes.reduce((sum, v) => sum + v.capacityGib, 0);
            const averageCapacityGib = formattedVolumes.length > 0
                ? totalCapacityGib / formattedVolumes.length
                : 0;

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        volumes: formattedVolumes,
                        summary: {
                            totalCount: formattedVolumes.length,
                            totalCapacityGib,
                            averageCapacityGib: Math.round(averageCapacityGib * 100) / 100
                        }
                    }, null, 2)
                }],
                structuredContent: {
                    volumes: formattedVolumes,
                    summary: {
                        totalCount: formattedVolumes.length,
                        totalCapacityGib,
                        averageCapacityGib: Math.round(averageCapacityGib * 100) / 100
                    }
                }
            };
        } catch (error: any) {
            console.error("Error in volume search:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error searching volumes: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Find Volumes by Export Policy Handler
export const findVolumesByExportPolicyHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, allowedClientCidr, accessType, hasRootAccess, kerberosRequired } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [allVolumes] = await netAppClient.listVolumes({ parent });

            const matchingVolumes: any[] = [];

            for (const vol of allVolumes) {
                const exportPolicy = vol.exportPolicy;
                if (!exportPolicy || !exportPolicy.rules || exportPolicy.rules.length === 0) {
                    continue;
                }

                let matches = false;
                const matchingRules: any[] = [];

                for (const rule of exportPolicy.rules) {
                    let ruleMatches = true;

                    if (allowedClientCidr && rule.allowedClients !== allowedClientCidr) {
                        ruleMatches = false;
                    }
                    if (accessType && rule.accessType !== accessType) {
                        ruleMatches = false;
                    }
                    if (hasRootAccess !== undefined) {
                        const ruleHasRootAccess = (rule as any).hasRootAccess === true ||
                            ((rule as any).nfsOptions && !(rule as any).nfsOptions.rootSquash);
                        if (ruleHasRootAccess !== hasRootAccess) {
                            ruleMatches = false;
                        }
                    }
                    if (kerberosRequired !== undefined) {
                        const ruleHasKerberos = (rule as any).kerberos_5ReadOnly || (rule as any).kerberos_5ReadWrite ||
                            (rule as any).kerberos_5iReadOnly || (rule as any).kerberos_5iReadWrite ||
                            (rule as any).kerberos_5pReadOnly || (rule as any).kerberos_5pReadWrite;
                        if (ruleHasKerberos !== kerberosRequired) {
                            ruleMatches = false;
                        }
                    }

                    if (ruleMatches) {
                        matches = true;
                        matchingRules.push({
                            allowedClients: rule.allowedClients || '',
                            accessType: rule.accessType,
                            hasRootAccess: (rule as any).hasRootAccess === true ||
                                ((rule as any).nfsOptions && !(rule as any).nfsOptions.rootSquash),
                            kerberos5ReadOnly: (rule as any).kerberos_5ReadOnly,
                            kerberos5ReadWrite: (rule as any).kerberos_5ReadWrite
                        });
                    }
                }

                if (matches) {
                    const nameParts = vol.name?.split('/') || [];
                    const volumeId = nameParts[nameParts.length - 1] || '';

                    const securityRecommendations: string[] = [];
                    if (matchingRules.some(r => r.allowedClients === '0.0.0.0/0')) {
                        securityRecommendations.push("Volume allows access from any IP (0.0.0.0/0) - consider restricting to specific CIDR ranges");
                    }
                    if (matchingRules.some(r => r.hasRootAccess)) {
                        securityRecommendations.push("Volume allows root access - consider enabling root squashing");
                    }
                    if (matchingRules.every((r: any) => !r.kerberos5ReadOnly && !r.kerberos5ReadWrite)) {
                        securityRecommendations.push("Volume does not require Kerberos authentication - consider enabling for better security");
                    }

                    matchingVolumes.push({
                        volumeId,
                        exportPolicy: {
                            rules: matchingRules
                        },
                        securityRecommendations: securityRecommendations.length > 0 ? securityRecommendations : undefined
                    });
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ volumes: matchingVolumes }, null, 2)
                }],
                structuredContent: {
                    volumes: matchingVolumes
                }
            };
        } catch (error: any) {
            console.error("Error finding volumes by export policy:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error finding volumes by export policy: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Find Volumes by Mount Point Handler
export const findVolumesByMountPointHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, ipAddress, exportPath, protocol } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [allVolumes] = await netAppClient.listVolumes({ parent });

            const matchingVolumes: any[] = [];

            for (const vol of allVolumes) {
                const mountOptions = vol.mountOptions || [];
                if (mountOptions.length === 0) {
                    continue;
                }

                const matchingMounts = mountOptions.filter((mp: any) => {
                    if (ipAddress && mp.ipAddress !== ipAddress) return false;
                    if (exportPath && mp.export !== exportPath) return false;
                    if (protocol && mp.protocol !== protocol) return false;
                    return true;
                });

                if (matchingMounts.length > 0) {
                    const nameParts = vol.name?.split('/') || [];
                    const volumeId = nameParts[nameParts.length - 1] || '';

                    const formattedMounts = matchingMounts.map((mp: any) => ({
                        ipAddress: mp.ipAddress || '',
                        export: mp.export || '',
                        exportFull: mp.exportFull || `${mp.ipAddress}:${mp.export}`,
                        protocol: mp.protocol || ''
                    }));

                    // Generate mount instructions
                    const mountInstructions = formattedMounts.map((mp: any) => {
                        if (mp.protocol?.includes('NFS')) {
                            return `mount -t nfs ${mp.exportFull} /mnt/${volumeId}`;
                        } else if (mp.protocol === 'SMB') {
                            return `mount -t cifs ${mp.exportFull} /mnt/${volumeId}`;
                        }
                        return `Mount ${mp.exportFull} using ${mp.protocol}`;
                    }).join('\n');

                    matchingVolumes.push({
                        volumeId,
                        mountOptions: formattedMounts,
                        mountInstructions
                    });
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ volumes: matchingVolumes }, null, 2)
                }],
                structuredContent: {
                    volumes: matchingVolumes
                }
            };
        } catch (error: any) {
            console.error("Error finding volumes by mount point:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error finding volumes by mount point: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Find Resources by Labels Handler
export const findResourcesByLabelsHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, resourceType, labels, matchAll = true } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            let allResources: any[] = [];

            // Fetch resources based on type
            switch (resourceType) {
                case 'volume':
                    const [volumes] = await netAppClient.listVolumes({ parent });
                    allResources = volumes.map((v: any) => ({
                        resource: v,
                        resourceId: v.name?.split('/').pop() || '',
                        name: v.name || '',
                        labels: v.labels || {},
                        resourceType: 'volume'
                    }));
                    break;
                case 'storagePool':
                    const [pools] = await netAppClient.listStoragePools({ parent });
                    allResources = pools.map((p: any) => ({
                        resource: p,
                        resourceId: p.name?.split('/').pop() || '',
                        name: p.name || '',
                        labels: p.labels || {},
                        resourceType: 'storagePool'
                    }));
                    break;
                case 'snapshot':
                    // Need to get volumes first, then snapshots
                    const [vols] = await netAppClient.listVolumes({ parent });
                    for (const vol of vols) {
                        try {
                            const [snapshots] = await netAppClient.listSnapshots({
                                parent: vol.name?.replace(/\/volumes\/[^/]+$/, '') || parent,
                                filter: `volume="${vol.name}"`
                            });
                            allResources.push(...snapshots.map((s: any) => ({
                                resource: s,
                                resourceId: s.name?.split('/').pop() || '',
                                name: s.name || '',
                                labels: s.labels || {},
                                resourceType: 'snapshot'
                            })));
                        } catch {
                            // Continue
                        }
                    }
                    break;
                case 'backup':
                    const [vaults] = await netAppClient.listBackupVaults({ parent });
                    for (const vault of vaults) {
                        try {
                            const [backups] = await netAppClient.listBackups({
                                parent: vault.name || ''
                            });
                            allResources.push(...backups.map((b: any) => ({
                                resource: b,
                                resourceId: b.name?.split('/').pop() || '',
                                name: b.name || '',
                                labels: b.labels || {},
                                resourceType: 'backup'
                            })));
                        } catch {
                            // Continue
                        }
                    }
                    break;
                case 'backupVault':
                    const [backupVaults] = await netAppClient.listBackupVaults({ parent });
                    allResources = backupVaults.map((v: any) => ({
                        resource: v,
                        resourceId: v.name?.split('/').pop() || '',
                        name: v.name || '',
                        labels: v.labels || {},
                        resourceType: 'backupVault'
                    }));
                    break;
                case 'replication':
                    // Replications are scoped to volumes, so we need to iterate through volumes
                    const [volumesForReplication] = await netAppClient.listVolumes({ parent });
                    for (const vol of volumesForReplication) {
                        try {
                            const [replications] = await netAppClient.listReplications({
                                parent: vol.name || ''
                            });
                            allResources.push(...replications.map((r: any) => ({
                                resource: r,
                                resourceId: r.name?.split('/').pop() || '',
                                name: r.name || '',
                                labels: r.labels || {},
                                resourceType: 'replication'
                            })));
                        } catch {
                            // Continue checking other volumes
                        }
                    }
                    break;
            }

            // Filter by labels
            const labelEntries = Object.entries(labels || {});
            const matchingResources = allResources.filter((item: any) => {
                const resourceLabels = item.labels || {};

                if (matchAll) {
                    // Must match all label key-value pairs
                    return labelEntries.every(([key, value]) =>
                        resourceLabels[key] === value);
                } else {
                    // Match any label key-value pair
                    return labelEntries.some(([key, value]) =>
                        resourceLabels[key] === value);
                }
            });

            const formattedResources = matchingResources.map((item: any) => ({
                resourceId: item.resourceId,
                name: item.name,
                labels: item.labels,
                resourceType: item.resourceType
            }));

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ resources: formattedResources }, null, 2)
                }],
                structuredContent: {
                    resources: formattedResources
                }
            };
        } catch (error: any) {
            console.error("Error finding resources by labels:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error finding resources by labels: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };


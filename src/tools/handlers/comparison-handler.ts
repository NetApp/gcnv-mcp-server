import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";
import { getVolumeBackupStatus } from "../../utils/backup-status-helper.js";

// Volume Comparison Handler
export const volumeComparisonHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeIds } = args;
            const netAppClient = NetAppClientFactory.createClient();

            const volumes: any[] = [];
            for (const volumeId of volumeIds) {
                const [volume] = await netAppClient.getVolume({
                    name: `projects/${projectId}/locations/${location}/volumes/${volumeId}`
                });
                volumes.push(volume);
            }

            const parent = `projects/${projectId}/locations/${location}`;
            const formattedVolumes = await Promise.all(volumes.map(async (vol: any) => {
                // Get tiering policy if present
                const tieringPolicy = (vol as any).tieringPolicy ? {
                    tierAction: (vol as any).tieringPolicy.tierAction || null,
                    coolingThresholdDays: (vol as any).tieringPolicy.coolingThresholdDays || null
                } : undefined;

                // Get snapshot policy if present
                const snapshotPolicy = (vol as any).snapshotPolicy ? {
                    enabled: (vol as any).snapshotPolicy.enabled !== false,
                    hourlySchedule: (vol as any).snapshotPolicy.hourlySchedule || null,
                    dailySchedule: (vol as any).snapshotPolicy.dailySchedule || null,
                    weeklySchedule: (vol as any).snapshotPolicy.weeklySchedule || null,
                    monthlySchedule: (vol as any).snapshotPolicy.monthlySchedule || null
                } : undefined;

                // Get SMB share settings
                const volProtocols = (vol as any).shareProtocols || vol.protocols || [];
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

                return {
                    volumeId: vol.name?.split('/').pop() || '',
                    capacityGib: Number(vol.capacityGib || 0),
                    usedGib: vol.usedGib ? Number(vol.usedGib) : undefined,
                    protocols: (vol as any).shareProtocols || vol.protocols || [],
                    exportPolicy: vol.exportPolicy,
                    labels: vol.labels || {},
                    backupStatus: {
                        status: backupStatus.status,
                        hasBackupPolicy: backupStatus.hasBackupPolicy,
                        backupPolicyId: backupStatus.backupPolicyId,
                        backupPolicyEnabled: backupStatus.backupPolicyEnabled,
                        hasRecentBackup: backupStatus.hasRecentBackup,
                        lastBackupTime: backupStatus.lastBackupTime?.toISOString(),
                        backupVault: backupStatus.backupVault,
                        backupCount: backupStatus.backupCount,
                        daysSinceLastBackup: backupStatus.daysSinceLastBackup
                    },
                    replicationStatus: 'unknown', // Would need to check replications
                    state: vol.state || '',
                    createTime: vol.createTime ? new Date(vol.createTime.seconds * 1000).toISOString() : '',
                    tieringPolicy,
                    tieringMetrics,
                    snapshotPolicy,
                    shareSettings
                };
            }));

            // Find differences
            const differences: any[] = [];
            const properties = ['capacityGib', 'protocols', 'state'];
            properties.forEach(prop => {
                const values: Record<string, any> = {};
                formattedVolumes.forEach(v => {
                    values[v.volumeId] = (v as any)[prop];
                });
                if (new Set(Object.values(values)).size > 1) {
                    differences.push({ property: prop, values });
                }
            });

            const recommendations: string[] = [];
            if (differences.length > 0) {
                recommendations.push('Volumes have different configurations - consider standardizing for consistency');
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ volumes: formattedVolumes, differences, recommendations }, null, 2)
                }],
                structuredContent: { volumes: formattedVolumes, differences, recommendations }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error comparing volumes: ${error.message}` }]
            };
        }
    };

// Find Similar Volumes Handler
export const findSimilarVolumesHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, similarityCriteria, tolerance = 10 } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [referenceVolume] = await netAppClient.getVolume({
                name: `projects/${projectId}/locations/${location}/volumes/${volumeId}`
            });

            const [allVolumes] = await netAppClient.listVolumes({ parent });
            const similarVolumes: any[] = [];

            allVolumes.forEach((vol: any) => {
                if (vol.name === referenceVolume.name) return; // Skip reference volume

                let score = 0;
                const differences: string[] = [];

                if (!similarityCriteria || similarityCriteria.includes('capacity')) {
                    const refCap = Number(referenceVolume.capacityGib || 0);
                    const volCap = Number(vol.capacityGib || 0);
                    const diff = Math.abs((volCap - refCap) / refCap) * 100;
                    if (diff <= tolerance) {
                        score += 30;
                    } else {
                        differences.push(`Capacity differs by ${Math.round(diff)}%`);
                    }
                }

                if (!similarityCriteria || similarityCriteria.includes('protocols')) {
                    const refProtos = (referenceVolume as any).shareProtocols || referenceVolume.protocols || [];
                    const volProtos = (vol as any).shareProtocols || vol.protocols || [];
                    if (JSON.stringify(refProtos.sort()) === JSON.stringify(volProtos.sort())) {
                        score += 30;
                    } else {
                        differences.push('Protocols differ');
                    }
                }

                if (!similarityCriteria || similarityCriteria.includes('labels')) {
                    const refLabels = referenceVolume.labels || {};
                    const volLabels = vol.labels || {};
                    const commonLabels = Object.keys(refLabels).filter(k => refLabels[k] === volLabels[k]);
                    if (commonLabels.length > 0) {
                        score += 20;
                    } else {
                        differences.push('Labels differ');
                    }
                }

                if (score > 0) {
                    const nameParts = vol.name?.split('/') || [];
                    similarVolumes.push({
                        volumeId: nameParts[nameParts.length - 1] || '',
                        similarityScore: score,
                        differences
                    });
                }
            });

            similarVolumes.sort((a, b) => b.similarityScore - a.similarityScore);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ similarVolumes }, null, 2)
                }],
                structuredContent: { similarVolumes }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error finding similar volumes: ${error.message}` }]
            };
        }
    };

// Storage Pool Comparison Handler
export const storagePoolComparisonHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, storagePoolIds } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const pools: any[] = [];
            for (const poolId of storagePoolIds) {
                const [pool] = await netAppClient.getStoragePool({
                    name: `projects/${projectId}/locations/${location}/storagePools/${poolId}`
                });

                // Get volumes in pool
                const [volumes] = await netAppClient.listVolumes({
                    parent,
                    filter: `storagePool="${pool.name}"`
                });

                const totalCapacityGib = Number(pool.capacityGib || 0);
                const allocatedCapacityGib = volumes.reduce((sum: number, vol: any) =>
                    sum + Number(vol.capacityGib || 0), 0);
                const availableCapacityGib = totalCapacityGib - allocatedCapacityGib;
                const utilizationPercent = totalCapacityGib > 0
                    ? (allocatedCapacityGib / totalCapacityGib) * 100
                    : 0;
                const averageVolumeSize = volumes.length > 0
                    ? allocatedCapacityGib / volumes.length
                    : 0;

                pools.push({
                    storagePoolId: poolId,
                    serviceLevel: pool.serviceLevel || '',
                    totalCapacityGib,
                    allocatedCapacityGib,
                    availableCapacityGib,
                    utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                    volumeCount: volumes.length,
                    averageVolumeSize: Math.round(averageVolumeSize * 100) / 100
                });
            }

            const recommendations: string[] = [];
            const highUtilPools = pools.filter(p => p.utilizationPercent > 80);
            if (highUtilPools.length > 0) {
                recommendations.push(`${highUtilPools.length} storage pools are above 80% utilization`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ storagePools: pools, recommendations }, null, 2)
                }],
                structuredContent: { storagePools: pools, recommendations }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error comparing storage pools: ${error.message}` }]
            };
        }
    };


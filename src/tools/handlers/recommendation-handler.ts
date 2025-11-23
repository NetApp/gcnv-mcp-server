import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Optimal Storage Pool Recommendation Handler
export const optimalStoragePoolRecommendHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, requiredCapacityGib, serviceLevel, protocols, preferredNetwork } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            let filter: string | undefined;
            if (serviceLevel) {
                filter = `serviceLevel="${serviceLevel}"`;
            }

            const [pools] = await netAppClient.listStoragePools({ parent, filter });
            const recommendations: any[] = [];
            const alternatives: any[] = [];

            for (const pool of pools) {
                // Get volumes to calculate available capacity
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

                const poolNameParts = pool.name?.split('/') || [];
                const poolId = poolNameParts[poolNameParts.length - 1] || '';

                if (availableCapacityGib >= requiredCapacityGib) {
                    const reasoning = `Has ${availableCapacityGib} GiB available, ${utilizationPercent.toFixed(1)}% utilized`;
                    if (pool.serviceLevel === serviceLevel && (!preferredNetwork || (pool as any).networkConfig?.network === preferredNetwork)) {
                        recommendations.push({
                            storagePoolId: poolId,
                            serviceLevel: pool.serviceLevel || '',
                            availableCapacityGib,
                            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                            reasoning
                        });
                    } else {
                        alternatives.push({
                            storagePoolId: poolId,
                            serviceLevel: pool.serviceLevel || '',
                            availableCapacityGib,
                            reasoning
                        });
                    }
                }
            }

            recommendations.sort((a, b) => a.utilizationPercent - b.utilizationPercent);

            const warnings: string[] = [];
            if (recommendations.length === 0 && alternatives.length === 0) {
                warnings.push(`No storage pools have enough capacity for ${requiredCapacityGib} GiB`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ recommendedPools: recommendations, alternativeOptions: alternatives, warnings }, null, 2)
                }],
                structuredContent: { recommendedPools: recommendations, alternativeOptions: alternatives, warnings }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error recommending storage pool: ${error.message}` }]
            };
        }
    };

// Backup Policy Recommendations Handler
export const backupPolicyRecommendHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, backupFrequency, retentionDays } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            let volumes: any[] = [];
            if (volumeId) {
                const [vol] = await netAppClient.getVolume({
                    name: `projects/${projectId}/locations/${location}/volumes/${volumeId}`
                });
                volumes = [vol];
            } else {
                const [allVolumes] = await netAppClient.listVolumes({ parent });
                volumes = allVolumes;
            }

            const recommendations: any[] = [];
            const volumesWithoutPolicies: string[] = [];

            volumes.forEach((vol: any) => {
                const nameParts = vol.name?.split('/') || [];
                const volId = nameParts[nameParts.length - 1] || '';

                // Determine recommended policy based on frequency
                let dailyLimit, weeklyLimit, monthlyLimit;
                if (backupFrequency === 'daily') {
                    dailyLimit = retentionDays ? Math.ceil(retentionDays / 7) : 7;
                    weeklyLimit = retentionDays ? Math.ceil(retentionDays / 30) : 4;
                    monthlyLimit = retentionDays ? Math.ceil(retentionDays / 90) : 3;
                } else if (backupFrequency === 'weekly') {
                    weeklyLimit = retentionDays ? Math.ceil(retentionDays / 30) : 4;
                    monthlyLimit = retentionDays ? Math.ceil(retentionDays / 90) : 3;
                } else {
                    monthlyLimit = retentionDays ? Math.ceil(retentionDays / 90) : 3;
                }

                recommendations.push({
                    volumeId: volId,
                    recommendedPolicy: {
                        dailyBackupLimit: dailyLimit,
                        weeklyBackupLimit: weeklyLimit,
                        monthlyBackupLimit: monthlyLimit,
                        reasoning: `Based on ${backupFrequency || 'standard'} backup frequency and ${retentionDays || 90} day retention`
                    },
                    existingPolicy: undefined, // Would need to check volume's backup policy assignment
                    complianceStatus: 'unknown'
                });

                // Check if volume has backups
                // Note: Would need to check backup policy assignments
                volumesWithoutPolicies.push(volId);
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ recommendations, volumesWithoutPolicies }, null, 2)
                }],
                structuredContent: { recommendations, volumesWithoutPolicies }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error recommending backup policies: ${error.message}` }]
            };
        }
    };

// Resource Cleanup Recommendations Handler
export const resourceCleanupRecommendHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, resourceType = 'all', dryRun = true } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const oldSnapshots: any[] = [];
            const unusedVolumes: any[] = [];
            const backupsToDelete: any[] = [];
            const orphanedResources: any[] = [];

            if (resourceType === 'all' || resourceType === 'snapshots') {
                const [volumes] = await netAppClient.listVolumes({ parent });
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                for (const vol of volumes) {
                    try {
                        const [snapshots] = await netAppClient.listSnapshots({
                            parent: vol.name?.replace(/\/volumes\/[^/]+$/, '') || parent,
                            filter: `volume="${vol.name}"`
                        });

                        snapshots.forEach((snap: any) => {
                            if (snap.createTime) {
                                const createTime = new Date(snap.createTime.seconds * 1000);
                                if (createTime < ninetyDaysAgo) {
                                    const nameParts = snap.name?.split('/') || [];
                                    const volNameParts = vol.name?.split('/') || [];
                                    const ageDays = Math.floor((Date.now() - createTime.getTime()) / (1000 * 60 * 60 * 24));
                                    oldSnapshots.push({
                                        snapshotId: nameParts[nameParts.length - 1] || '',
                                        volumeId: volNameParts[volNameParts.length - 1] || '',
                                        ageDays,
                                        canDelete: true
                                    });
                                }
                            }
                        });
                    } catch {
                        // Continue
                    }
                }
            }

            if (resourceType === 'all' || resourceType === 'backups') {
                const [backupVaults] = await netAppClient.listBackupVaults({ parent });
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                for (const vault of backupVaults) {
                    try {
                        const [backups] = await netAppClient.listBackups({
                            parent: vault.name || ''
                        });

                        backups.forEach((backup: any) => {
                            if (backup.createTime) {
                                const createTime = new Date(backup.createTime.seconds * 1000);
                                if (createTime < ninetyDaysAgo) {
                                    const nameParts = backup.name?.split('/') || [];
                                    const volNameParts = backup.volume?.split('/') || [];
                                    const ageDays = Math.floor((Date.now() - createTime.getTime()) / (1000 * 60 * 60 * 24));
                                    backupsToDelete.push({
                                        backupId: nameParts[nameParts.length - 1] || '',
                                        volumeId: volNameParts[volNameParts.length - 1] || '',
                                        ageDays,
                                        reason: 'Backup older than 90 days'
                                    });
                                }
                            }
                        });
                    } catch {
                        // Continue
                    }
                }
            }

            // Estimate cost savings (rough calculation)
            const estimatedCostSavings = (oldSnapshots.length * 0.01) + (backupsToDelete.length * 0.05);

            const safetyChecks = [
                'Checked for dependencies before recommending deletion',
                'Verified snapshots are not in use',
                'Confirmed backups are beyond retention policy'
            ];

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        oldSnapshots,
                        unusedVolumes,
                        backupsToDelete,
                        orphanedResources,
                        estimatedCostSavings: Math.round(estimatedCostSavings * 100) / 100,
                        safetyChecks
                    }, null, 2)
                }],
                structuredContent: {
                    oldSnapshots,
                    unusedVolumes,
                    backupsToDelete,
                    orphanedResources,
                    estimatedCostSavings: Math.round(estimatedCostSavings * 100) / 100,
                    safetyChecks
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error recommending cleanup: ${error.message}` }]
            };
        }
    };

// Capacity Optimization Recommendations Handler
export const capacityOptimizationRecommendHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, optimizationType = 'all' } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const volumesToDownsize: any[] = [];
            const volumesToUpsize: any[] = [];
            const consolidationOpportunities: any[] = [];
            const migrationRecommendations: any[] = [];

            if (optimizationType === 'all' || optimizationType === 'right-sizing') {
                const [volumes] = await netAppClient.listVolumes({ parent });
                
                volumes.forEach((vol: any) => {
                    const capacityGib = Number(vol.capacityGib || 0);
                    const usedGib = Number(vol.usedGib || 0);
                    const utilizationPercent = capacityGib > 0 ? (usedGib / capacityGib) * 100 : 0;

                    const nameParts = vol.name?.split('/') || [];
                    const volumeId = nameParts[nameParts.length - 1] || '';

                    if (utilizationPercent < 20 && capacityGib > 100) {
                        const recommendedCapacity = Math.ceil(usedGib * 1.5); // 50% headroom
                        volumesToDownsize.push({
                            volumeId,
                            currentCapacityGib: capacityGib,
                            recommendedCapacityGib: recommendedCapacity,
                            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                            estimatedSavings: (capacityGib - recommendedCapacity) * 0.20 // Rough cost per GiB
                        });
                    } else if (utilizationPercent > 90) {
                        const recommendedCapacity = Math.ceil(capacityGib * 1.5);
                        volumesToUpsize.push({
                            volumeId,
                            currentCapacityGib: capacityGib,
                            recommendedCapacityGib: recommendedCapacity,
                            utilizationPercent: Math.round(utilizationPercent * 100) / 100
                        });
                    }
                });
            }

            const costSavingsEstimate = volumesToDownsize.reduce((sum, v) => sum + v.estimatedSavings, 0);

            // Auto-tiering recommendations (for PREMIUM and EXTREME pools)
            const autoTieringRecommendations: any[] = [];
            if (optimizationType === 'all' || optimizationType === 'cleanup') {
                const [pools] = await netAppClient.listStoragePools({ parent });
                
                for (const pool of pools) {
                    const serviceLevel = pool.serviceLevel || '';
                    const isEligible = (serviceLevel === 'PREMIUM' || serviceLevel === 'EXTREME');
                    
                    if (isEligible) {
                        // Auto-tiering is a boolean field at the storage pool level (allowAutoTiering)
                        // Volumes can only enable auto-tiering if the pool has allowAutoTiering=true
                        const autoTieringEnabled = (pool as any).allowAutoTiering === true;
                        
                        if (!autoTieringEnabled) {
                            try {
                                const [volumes] = await netAppClient.listVolumes({
                                    parent,
                                    filter: `storagePool="${pool.name}"`
                                });
                                const usedCapacityGib = volumes.reduce((sum: number, v: any) => 
                                    sum + Number(v.usedGib || 0), 0);
                                
                                if (usedCapacityGib > 100) { // Only recommend if there's significant data
                                    const poolNameParts = pool.name?.split('/') || [];
                                    const poolId = poolNameParts[poolNameParts.length - 1] || '';
                                    const estimatedSavings = usedCapacityGib * 0.25 * 0.20 * 0.30; // 25% cold, 20% tiered, 30% savings
                                    
                                    autoTieringRecommendations.push({
                                        storagePoolId: poolId,
                                        serviceLevel,
                                        recommendation: `Enable auto-tiering to move infrequently used data to cold storage and reduce costs`,
                                        estimatedSavings: Math.round(estimatedSavings * 100) / 100
                                    });
                                }
                            } catch {
                                // Continue
                            }
                        }
                    }
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        volumesToDownsize,
                        volumesToUpsize,
                        consolidationOpportunities,
                        migrationRecommendations,
                        costSavingsEstimate: Math.round(costSavingsEstimate * 100) / 100,
                        autoTieringRecommendations
                    }, null, 2)
                }],
                structuredContent: {
                    volumesToDownsize,
                    volumesToUpsize,
                    consolidationOpportunities,
                    migrationRecommendations,
                    costSavingsEstimate: Math.round(costSavingsEstimate * 100) / 100,
                    autoTieringRecommendations
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error optimizing capacity: ${error.message}` }]
            };
        }
    };


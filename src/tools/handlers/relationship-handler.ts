import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Volume Dependency Tree Handler
export const volumeDependencyTreeHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, includeSnapshots = true, includeBackups = true, includeReplications = true } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const volumeName = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

            // Get volume
            const [volume] = await netAppClient.getVolume({ name: volumeName });
            
            // Get storage pool
            const storagePoolName = volume.storagePool || '';
            const [storagePool] = await netAppClient.getStoragePool({ name: storagePoolName });
            const poolNameParts = storagePoolName.split('/');
            const storagePoolId = poolNameParts[poolNameParts.length - 1] || '';

            const result: any = {
                volume: {
                    volumeId,
                    name: volumeName,
                    storagePool: storagePoolName
                },
                storagePool: {
                    storagePoolId,
                    serviceLevel: storagePool.serviceLevel || '',
                    capacityGib: Number(storagePool.capacityGib || 0)
                }
            };

            // Get snapshots
            if (includeSnapshots) {
                try {
                    const [snapshots] = await netAppClient.listSnapshots({
                        parent: `projects/${projectId}/locations/${location}`,
                        filter: `volume="${volumeName}"`
                    });
                    result.snapshots = snapshots.map((snap: any) => {
                        const nameParts = snap.name?.split('/') || [];
                        return {
                            snapshotId: nameParts[nameParts.length - 1] || '',
                            createTime: snap.createTime ? new Date(snap.createTime.seconds * 1000).toISOString() : '',
                            state: snap.state || ''
                        };
                    });
                } catch {
                    result.snapshots = [];
                }
            }

            // Get backups
            if (includeBackups) {
                try {
                    const [backupVaults] = await netAppClient.listBackupVaults({
                        parent: `projects/${projectId}/locations/${location}`
                    });
                    const backups: any[] = [];
                    
                    for (const vault of backupVaults) {
                        try {
                            const [vaultBackups] = await netAppClient.listBackups({
                                parent: vault.name || '',
                                filter: `volume="${volumeName}"`
                            });
                            backups.push(...vaultBackups.map((b: any) => {
                                const nameParts = b.name?.split('/') || [];
                                return {
                                    backupId: nameParts[nameParts.length - 1] || '',
                                    backupVault: vault.name || '',
                                    createTime: b.createTime ? new Date(b.createTime.seconds * 1000).toISOString() : '',
                                    state: b.state || ''
                                };
                            }));
                        } catch {
                            // Continue
                        }
                    }
                    result.backups = backups;
                } catch {
                    result.backups = [];
                }
            }

            // Get replications (replications are scoped to volumes, so parent must be the volume name)
            if (includeReplications) {
                try {
                    const [replications] = await netAppClient.listReplications({
                        parent: volumeName,
                        filter: `sourceVolume="${volumeName}" OR destinationVolume="${volumeName}"`
                    });
                    result.replications = replications.map((rep: any) => {
                        const nameParts = rep.name?.split('/') || [];
                        const isSource = rep.sourceVolume === volumeName;
                        return {
                            replicationId: nameParts[nameParts.length - 1] || '',
                            direction: isSource ? 'source' : 'destination',
                            destinationVolume: isSource ? rep.destinationVolume : rep.sourceVolume,
                            state: rep.state || '',
                            healthy: rep.healthy
                        };
                    });
                } catch {
                    result.replications = [];
                }
            }

            // Build dependency tree text
            let treeText = `Volume: ${volumeId}\n`;
            treeText += `  └─ Storage Pool: ${storagePoolId} (${storagePool.serviceLevel})\n`;
            
            if (result.snapshots && result.snapshots.length > 0) {
                treeText += `  └─ Snapshots (${result.snapshots.length}):\n`;
                result.snapshots.forEach((snap: any) => {
                    treeText += `     └─ ${snap.snapshotId} (${snap.state})\n`;
                });
            }
            
            if (result.backups && result.backups.length > 0) {
                treeText += `  └─ Backups (${result.backups.length}):\n`;
                result.backups.forEach((backup: any) => {
                    treeText += `     └─ ${backup.backupId} (${backup.state})\n`;
                });
            }
            
            if (result.replications && result.replications.length > 0) {
                treeText += `  └─ Replications (${result.replications.length}):\n`;
                result.replications.forEach((rep: any) => {
                    treeText += `     └─ ${rep.replicationId} (${rep.direction}, ${rep.state})\n`;
                });
            }

            result.dependencyTree = treeText;

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(result, null, 2)
                }],
                structuredContent: result
            };
        } catch (error: any) {
            console.error("Error building dependency tree:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error building dependency tree: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Storage Pool Resource Inventory Handler
export const storagePoolResourceInventoryHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, storagePoolId, includeDetails = false } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const poolName = `projects/${projectId}/locations/${location}/storagePools/${storagePoolId}`;

            // Get storage pool
            const [storagePool] = await netAppClient.getStoragePool({ name: poolName });

            // Get volumes in pool
            const [volumes] = await netAppClient.listVolumes({
                parent: `projects/${projectId}/locations/${location}`,
                filter: `storagePool="${poolName}"`
            });

            const formattedVolumes = volumes.map((vol: any) => {
                const nameParts = vol.name?.split('/') || [];
                return {
                    volumeId: nameParts[nameParts.length - 1] || '',
                    capacityGib: Number(vol.capacityGib || 0),
                    usedGib: vol.usedGib ? Number(vol.usedGib) : undefined,
                    state: vol.state || ''
                };
            });

            const allocatedCapacityGib = formattedVolumes.reduce((sum, v) => sum + v.capacityGib, 0);
            const usedCapacityGib = formattedVolumes.reduce((sum, v) => sum + (v.usedGib || 0), 0);
            const totalCapacityGib = Number(storagePool.capacityGib || 0);
            const availableCapacityGib = totalCapacityGib - allocatedCapacityGib;
            const utilizationPercent = totalCapacityGib > 0 
                ? (allocatedCapacityGib / totalCapacityGib) * 100 
                : 0;

            const result: any = {
                storagePool: {
                    storagePoolId,
                    serviceLevel: storagePool.serviceLevel || '',
                    totalCapacityGib,
                    allocatedCapacityGib,
                    availableCapacityGib
                },
                volumes: formattedVolumes,
                totalSnapshots: 0,
                capacityBreakdown: {
                    totalCapacityGib,
                    allocatedCapacityGib,
                    usedCapacityGib,
                    availableCapacityGib,
                    utilizationPercent: Math.round(utilizationPercent * 100) / 100
                }
            };

            // Get snapshots if details requested
            if (includeDetails) {
                const snapshots: any[] = [];
                for (const vol of volumes) {
                    try {
                        const [volSnapshots] = await netAppClient.listSnapshots({
                            parent: vol.name?.replace(/\/volumes\/[^/]+$/, '') || `projects/${projectId}/locations/${location}`,
                            filter: `volume="${vol.name}"`
                        });
                        volSnapshots.forEach((snap: any) => {
                            const nameParts = snap.name?.split('/') || [];
                            const volNameParts = vol.name?.split('/') || [];
                            snapshots.push({
                                snapshotId: nameParts[nameParts.length - 1] || '',
                                volumeId: volNameParts[volNameParts.length - 1] || '',
                                createTime: snap.createTime ? new Date(snap.createTime.seconds * 1000).toISOString() : ''
                            });
                        });
                    } catch {
                        // Continue
                    }
                }
                result.snapshots = snapshots;
                result.totalSnapshots = snapshots.length;
            } else {
                // Just count snapshots
                let totalSnapshots = 0;
                for (const vol of volumes) {
                    try {
                        const [volSnapshots] = await netAppClient.listSnapshots({
                            parent: vol.name?.replace(/\/volumes\/[^/]+$/, '') || `projects/${projectId}/locations/${location}`,
                            filter: `volume="${vol.name}"`
                        });
                        totalSnapshots += volSnapshots.length;
                    } catch {
                        // Continue
                    }
                }
                result.totalSnapshots = totalSnapshots;
            }

            // Get replications if details requested (replications are scoped to volumes)
            if (includeDetails) {
                try {
                    const allReplications: any[] = [];
                    for (const vol of volumes) {
                        try {
                            const [replications] = await netAppClient.listReplications({
                                parent: vol.name || ''
                            });
                            allReplications.push(...replications);
                        } catch {
                            // Continue checking other volumes
                        }
                    }
                    result.replications = allReplications.map((rep: any) => {
                        const nameParts = rep.name?.split('/') || [];
                        return {
                            replicationId: nameParts[nameParts.length - 1] || '',
                            sourceVolume: rep.sourceVolume || '',
                            destinationVolume: rep.destinationVolume || '',
                            state: rep.state || ''
                        };
                    });
                } catch {
                    result.replications = [];
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(result, null, 2)
                }],
                structuredContent: result
            };
        } catch (error: any) {
            console.error("Error getting storage pool inventory:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting storage pool inventory: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Backup Chain Analysis Handler
export const backupChainAnalysisHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, backupVaultId } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const backupChains: any[] = [];
            const backupsToDelete: any[] = [];
            const volumesWithoutRecentBackups: any[] = [];
            const backupPolicyCompliance: any[] = [];

            // Get volumes to analyze
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

            // Get backup vaults
            let backupVaults: any[] = [];
            if (backupVaultId) {
                const [vault] = await netAppClient.getBackupVault({
                    name: `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}`
                });
                backupVaults = [vault];
            } else {
                const [allVaults] = await netAppClient.listBackupVaults({ parent });
                backupVaults = allVaults;
            }

            // Analyze each volume
            for (const vol of volumes) {
                const volNameParts = vol.name?.split('/') || [];
                const volId = volNameParts[volNameParts.length - 1] || '';
                
                const volumeBackups: any[] = [];
                for (const vault of backupVaults) {
                    try {
                        const [backups] = await netAppClient.listBackups({
                            parent: vault.name || '',
                            filter: `volume="${vol.name}"`
                        });
                        volumeBackups.push(...backups);
                    } catch {
                        // Continue
                    }
                }

                if (volumeBackups.length > 0) {
                    const sortedBackups = volumeBackups.sort((a: any, b: any) => {
                        const timeA = a.createTime ? new Date(a.createTime.seconds * 1000).getTime() : 0;
                        const timeB = b.createTime ? new Date(b.createTime.seconds * 1000).getTime() : 0;
                        return timeA - timeB;
                    });

                    backupChains.push({
                        volumeId: volId,
                        backupCount: sortedBackups.length,
                        oldestBackup: sortedBackups[0]?.createTime 
                            ? new Date(sortedBackups[0].createTime.seconds * 1000).toISOString() 
                            : undefined,
                        newestBackup: sortedBackups[sortedBackups.length - 1]?.createTime 
                            ? new Date(sortedBackups[sortedBackups.length - 1].createTime.seconds * 1000).toISOString() 
                            : undefined
                    });

                    // Check for old backups (older than 90 days)
                    const ninetyDaysAgo = new Date();
                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                    
                    sortedBackups.forEach((backup: any) => {
                        if (backup.createTime) {
                            const createTime = new Date(backup.createTime.seconds * 1000);
                            if (createTime < ninetyDaysAgo) {
                                const nameParts = backup.name?.split('/') || [];
                                const ageDays = Math.floor((Date.now() - createTime.getTime()) / (1000 * 60 * 60 * 24));
                                backupsToDelete.push({
                                    backupId: nameParts[nameParts.length - 1] || '',
                                    volumeId: volId,
                                    ageDays,
                                    reason: 'Backup older than 90 days'
                                });
                            }
                        }
                    });
                } else {
                    volumesWithoutRecentBackups.push({
                        volumeId: volId,
                        daysSinceLastBackup: undefined
                    });
                }

                // Check backup policy compliance
                // Note: This would require checking if volume has backup policy assigned
                backupPolicyCompliance.push({
                    volumeId: volId,
                    backupPolicyId: undefined, // Would need to check volume's backup policy assignment
                    isCompliant: volumeBackups.length > 0,
                    complianceIssues: volumeBackups.length === 0 ? ['No backups found'] : []
                });
            }

            // Calculate backup age distribution
            const allBackups: any[] = [];
            for (const vault of backupVaults) {
                try {
                    const [backups] = await netAppClient.listBackups({
                        parent: vault.name || ''
                    });
                    allBackups.push(...backups);
                } catch {
                    // Continue
                }
            }

            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

            const backupAgeDistribution = {
                lessThan7Days: 0,
                between7And30Days: 0,
                between30And90Days: 0,
                olderThan90Days: 0
            };

            allBackups.forEach((backup: any) => {
                if (backup.createTime) {
                    const createTime = new Date(backup.createTime.seconds * 1000).getTime();
                    const age = now - createTime;
                    if (age < sevenDaysAgo) {
                        backupAgeDistribution.lessThan7Days++;
                    } else if (age < thirtyDaysAgo) {
                        backupAgeDistribution.between7And30Days++;
                    } else if (age < ninetyDaysAgo) {
                        backupAgeDistribution.between30And90Days++;
                    } else {
                        backupAgeDistribution.olderThan90Days++;
                    }
                }
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        backupChains,
                        backupAgeDistribution,
                        backupsToDelete,
                        volumesWithoutRecentBackups,
                        backupPolicyCompliance
                    }, null, 2)
                }],
                structuredContent: {
                    backupChains,
                    backupAgeDistribution,
                    backupsToDelete,
                    volumesWithoutRecentBackups,
                    backupPolicyCompliance
                }
            };
        } catch (error: any) {
            console.error("Error analyzing backup chains:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error analyzing backup chains: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Replication Status Overview Handler
export const replicationStatusOverviewHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, volumeId, includeHistory = false } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            let replications: any[] = [];
            if (volumeId) {
                // If volumeId is provided, list replications for that specific volume
                const volumeName = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;
                try {
                    const [volReplications] = await netAppClient.listReplications({ 
                        parent: volumeName,
                        filter: `sourceVolume="${volumeName}" OR destinationVolume="${volumeName}"`
                    });
                    replications = volReplications;
                } catch {
                    replications = [];
                }
            } else {
                // If no volumeId, list all replications across all volumes
                const [volumes] = await netAppClient.listVolumes({ parent });
                for (const vol of volumes) {
                    try {
                        const [volReplications] = await netAppClient.listReplications({ 
                            parent: vol.name || '' 
                        });
                        replications.push(...volReplications);
                    } catch {
                        // Continue checking other volumes
                    }
                }
            }

            const replicationPairs = replications.map((rep: any) => {
                const nameParts = rep.name?.split('/') || [];
                return {
                    replicationId: nameParts[nameParts.length - 1] || '',
                    sourceVolume: rep.sourceVolume || '',
                    destinationVolume: rep.destinationVolume || '',
                    state: rep.state || '',
                    healthy: rep.healthy || false,
                    lastReplicationTime: rep.lastReplicationTime 
                        ? new Date(rep.lastReplicationTime.seconds * 1000).toISOString() 
                        : undefined,
                    replicationLag: undefined // Would need to calculate from last replication time
                };
            });

            const healthyReplications = replicationPairs.filter(r => r.healthy).length;
            const unhealthyReplications = replicationPairs.filter(r => !r.healthy).length;

            const failedReplications = replicationPairs
                .filter(r => r.state === 'ERROR' || r.state === 'FAILED')
                .map(r => ({
                    replicationId: r.replicationId,
                    errorMessage: `Replication in ${r.state} state`
                }));

            const recommendations: string[] = [];
            if (unhealthyReplications > 0) {
                recommendations.push(`${unhealthyReplications} replications are unhealthy - investigate replication status`);
            }
            if (failedReplications.length > 0) {
                recommendations.push(`${failedReplications.length} replications have failed - review and restart if needed`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        replicationPairs,
                        healthyReplications,
                        unhealthyReplications,
                        failedReplications,
                        recommendations
                    }, null, 2)
                }],
                structuredContent: {
                    replicationPairs,
                    healthyReplications,
                    unhealthyReplications,
                    failedReplications,
                    recommendations
                }
            };
        } catch (error: any) {
            console.error("Error getting replication status overview:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting replication status overview: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };


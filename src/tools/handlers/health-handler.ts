import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";
import { getVolumeBackupStatus } from "../../utils/backup-status-helper.js";

// Resource Health Check Handler
export const resourceHealthCheckHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, resourceType = 'all', includeWarnings = true } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const resourcesInError: any[] = [];
            const resourcesInWarning: any[] = [];
            const failedOperations: any[] = [];
            const unhealthyReplications: any[] = [];
            const volumesWithoutRecentBackups: any[] = [];

            // Check volumes
            if (resourceType === 'all' || resourceType === 'volume') {
                const [volumes] = await netAppClient.listVolumes({ parent });
                volumes.forEach((vol: any) => {
                    const nameParts = vol.name?.split('/') || [];
                    const volumeId = nameParts[nameParts.length - 1] || '';
                    
                    if (vol.state === 'ERROR' || vol.state === 'FAILED') {
                        resourcesInError.push({
                            resourceId: volumeId,
                            resourceType: 'volume',
                            state: vol.state,
                            errorMessage: vol.error?.message
                        });
                    } else if (includeWarnings && (vol.state === 'WARNING' || vol.state === 'CREATING')) {
                        resourcesInWarning.push({
                            resourceId: volumeId,
                            resourceType: 'volume',
                            state: vol.state,
                            warningMessage: 'Volume in non-ready state'
                        });
                    }
                });
            }

            // Check storage pools
            if (resourceType === 'all' || resourceType === 'storagePool') {
                const [pools] = await netAppClient.listStoragePools({ parent });
                pools.forEach((pool: any) => {
                    const nameParts = pool.name?.split('/') || [];
                    const poolId = nameParts[nameParts.length - 1] || '';
                    
                    if (pool.state === 'ERROR' || pool.state === 'FAILED') {
                        resourcesInError.push({
                            resourceId: poolId,
                            resourceType: 'storagePool',
                            state: pool.state,
                            errorMessage: pool.error?.message
                        });
                    } else if (includeWarnings && (pool.state === 'WARNING' || pool.state === 'CREATING')) {
                        resourcesInWarning.push({
                            resourceId: poolId,
                            resourceType: 'storagePool',
                            state: pool.state,
                            warningMessage: 'Storage pool in non-ready state'
                        });
                    }
                });
            }

            // Check operations - use direct API call
            const auth = (netAppClient as any).auth;
            const axios = (await import('axios')).default;
            const response = await axios.request({
                url: `https://netapp.googleapis.com/v1/${parent}/operations`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            const operations = (response.data as any).operations || [];
            operations.forEach((op: any) => {
                if (op.done && op.error) {
                    const nameParts = op.name?.split('/') || [];
                    const operationId = nameParts[nameParts.length - 1] || '';
                    failedOperations.push({
                        operationId,
                        operationType: op.metadata?.method || 'unknown',
                        errorMessage: op.error?.message || 'Unknown error'
                    });
                }
            });

            // Check replications (replications are scoped to volumes, so we need to iterate through volumes)
            if (resourceType === 'all' || resourceType === 'replication') {
                const [volumesForReplication] = await netAppClient.listVolumes({ parent });
                for (const vol of volumesForReplication) {
                    try {
                        const [replications] = await netAppClient.listReplications({ 
                            parent: vol.name || '' 
                        });
                        replications.forEach((rep: any) => {
                            const nameParts = rep.name?.split('/') || [];
                            const replicationId = nameParts[nameParts.length - 1] || '';
                            
                            if (!rep.healthy || rep.state === 'ERROR' || rep.state === 'FAILED') {
                                unhealthyReplications.push({
                                    replicationId,
                                    state: rep.state || 'UNHEALTHY',
                                    lastReplicationTime: rep.lastReplicationTime
                                });
                            }
                        });
                    } catch {
                        // Continue checking other volumes
                    }
                }
            }

            // Check backups (volumes without recent backups)
            if (resourceType === 'all' || resourceType === 'backup') {
                const [volumes] = await netAppClient.listVolumes({ parent });
                
                for (const vol of volumes) {
                    const backupStatus = await getVolumeBackupStatus(netAppClient, vol, parent, 7);
                    
                    if (!backupStatus.hasRecentBackup || backupStatus.status === 'non_compliant' || backupStatus.status === 'no_policy') {
                        const nameParts = vol.name?.split('/') || [];
                        const volumeId = nameParts[nameParts.length - 1] || '';
                        volumesWithoutRecentBackups.push({
                            volumeId,
                            lastBackupTime: backupStatus.lastBackupTime?.toISOString(),
                            hasBackupPolicy: backupStatus.hasBackupPolicy,
                            backupPolicyId: backupStatus.backupPolicyId,
                            status: backupStatus.status
                        });
                    }
                }
            }

            // Calculate health summary
            const totalResources = resourcesInError.length + resourcesInWarning.length;
            const healthyResources = totalResources - resourcesInError.length - resourcesInWarning.length;

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        resourcesInError,
                        resourcesInWarning,
                        failedOperations,
                        unhealthyReplications,
                        volumesWithoutRecentBackups,
                        healthSummary: {
                            totalResources,
                            healthyResources,
                            resourcesInError: resourcesInError.length,
                            resourcesInWarning: resourcesInWarning.length
                        }
                    }, null, 2)
                }],
                structuredContent: {
                    resourcesInError,
                    resourcesInWarning,
                    failedOperations,
                    unhealthyReplications,
                    volumesWithoutRecentBackups,
                    healthSummary: {
                        totalResources,
                        healthyResources,
                        resourcesInError: resourcesInError.length,
                        resourcesInWarning: resourcesInWarning.length
                    }
                }
            };
        } catch (error: any) {
            console.error("Error checking resource health:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error checking resource health: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Resources Needing Attention Handler
export const resourcesNeedingAttentionHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, severity = 'all' } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const highUtilizationVolumes: any[] = [];
            const storagePoolsApproachingCapacity: any[] = [];
            const failedOperations: any[] = [];
            const replicationsNotSynced: any[] = [];
            const volumesWithoutBackups: any[] = [];
            const oldSnapshots: any[] = [];
            const resourcesMissingLabels: any[] = [];

            // Check volume utilization
            const [volumes] = await netAppClient.listVolumes({ parent });
            volumes.forEach((vol: any) => {
                const capacityGib = Number(vol.capacityGib || 0);
                const usedGib = Number(vol.usedGib || 0);
                const utilizationPercent = capacityGib > 0 ? (usedGib / capacityGib) * 100 : 0;

                if (utilizationPercent > 90) {
                    const nameParts = vol.name?.split('/') || [];
                    highUtilizationVolumes.push({
                        volumeId: nameParts[nameParts.length - 1] || '',
                        utilizationPercent: Math.round(utilizationPercent * 100) / 100
                    });
                }

                // Check for missing labels
                if (!vol.labels || Object.keys(vol.labels).length === 0) {
                    const nameParts = vol.name?.split('/') || [];
                    resourcesMissingLabels.push({
                        resourceId: nameParts[nameParts.length - 1] || '',
                        resourceType: 'volume'
                    });
                }
            });

            // Check storage pool capacity
            const [pools] = await netAppClient.listStoragePools({ parent });
            for (const pool of pools) {
                const totalCapacityGib = Number(pool.capacityGib || 0);
                
                // Get volumes in this pool
                const [poolVolumes] = await netAppClient.listVolumes({
                    parent,
                    filter: `storagePool="${pool.name}"`
                });
                
                const allocatedCapacityGib = poolVolumes.reduce((sum: number, vol: any) => 
                    sum + Number(vol.capacityGib || 0), 0);
                const utilizationPercent = totalCapacityGib > 0 
                    ? (allocatedCapacityGib / totalCapacityGib) * 100 
                    : 0;

                if (utilizationPercent > 80) {
                    const nameParts = pool.name?.split('/') || [];
                    storagePoolsApproachingCapacity.push({
                        storagePoolId: nameParts[nameParts.length - 1] || '',
                        utilizationPercent: Math.round(utilizationPercent * 100) / 100
                    });
                }
            }

            // Check failed operations - use direct API call
            const auth = (netAppClient as any).auth;
            const axios = (await import('axios')).default;
            const response = await axios.request({
                url: `https://netapp.googleapis.com/v1/${parent}/operations`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            const operations = (response.data as any).operations || [];
            operations.forEach((op: any) => {
                if (op.done && op.error) {
                    const nameParts = op.name?.split('/') || [];
                    failedOperations.push({
                        operationId: nameParts[nameParts.length - 1] || '',
                        operationType: op.metadata?.method || 'unknown'
                    });
                }
            });

            // Check replications (replications are scoped to volumes)
            const [volumesForReplicationCheck] = await netAppClient.listVolumes({ parent });
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            for (const vol of volumesForReplicationCheck) {
                try {
                    const [replications] = await netAppClient.listReplications({ 
                        parent: vol.name || '' 
                    });
                    replications.forEach((rep: any) => {
                        if (!rep.healthy) {
                            const nameParts = rep.name?.split('/') || [];
                            replicationsNotSynced.push({
                                replicationId: nameParts[nameParts.length - 1] || '',
                                lastReplicationTime: rep.lastReplicationTime
                            });
                        } else if (rep.lastReplicationTime) {
                            const lastSync = new Date(rep.lastReplicationTime.seconds * 1000);
                            if (lastSync < sevenDaysAgo) {
                                const nameParts = rep.name?.split('/') || [];
                                replicationsNotSynced.push({
                                    replicationId: nameParts[nameParts.length - 1] || '',
                                    lastReplicationTime: rep.lastReplicationTime
                                });
                            }
                        }
                    });
                } catch {
                    // Continue checking other volumes
                }
            }

            // Check backups
            const [backupVaults] = await netAppClient.listBackupVaults({ parent });
            for (const vol of volumes) {
                let hasRecentBackup = false;
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                for (const vault of backupVaults) {
                    try {
                        const [backups] = await netAppClient.listBackups({
                            parent: vault.name || '',
                            filter: `volume="${vol.name}"`
                        });
                        
                        const recentBackup = backups.find((b: any) => {
                            if (!b.createTime) return false;
                            const backupTime = new Date(b.createTime.seconds * 1000);
                            return backupTime > sevenDaysAgo;
                        });
                        
                        if (recentBackup) {
                            hasRecentBackup = true;
                            break;
                        }
                    } catch {
                        // Continue
                    }
                }

                if (!hasRecentBackup) {
                    const nameParts = vol.name?.split('/') || [];
                    volumesWithoutBackups.push({
                        volumeId: nameParts[nameParts.length - 1] || '',
                        daysSinceLastBackup: undefined
                    });
                }
            }

            // Check old snapshots (older than 90 days)
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
                                const ageDays = Math.floor((Date.now() - createTime.getTime()) / (1000 * 60 * 60 * 24));
                                oldSnapshots.push({
                                    snapshotId: nameParts[nameParts.length - 1] || '',
                                    ageDays
                                });
                            }
                        }
                    });
                } catch {
                    // Continue
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        highUtilizationVolumes,
                        storagePoolsApproachingCapacity,
                        failedOperations,
                        replicationsNotSynced,
                        volumesWithoutBackups,
                        oldSnapshots,
                        resourcesMissingLabels
                    }, null, 2)
                }],
                structuredContent: {
                    highUtilizationVolumes,
                    storagePoolsApproachingCapacity,
                    failedOperations,
                    replicationsNotSynced,
                    volumesWithoutBackups,
                    oldSnapshots,
                    resourcesMissingLabels
                }
            };
        } catch (error: any) {
            console.error("Error finding resources needing attention:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error finding resources needing attention: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Operation Status Summary Handler
export const operationStatusSummaryHandler: ToolHandler = 
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, operationType, status, timeRange = '7d' } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            // Calculate time filter
            const timeFilter = new Date();
            if (timeRange === '24h') {
                timeFilter.setHours(timeFilter.getHours() - 24);
            } else if (timeRange === '7d') {
                timeFilter.setDate(timeFilter.getDate() - 7);
            } else if (timeRange === '30d') {
                timeFilter.setDate(timeFilter.getDate() - 30);
            }

            // Use direct API call for operations
            const auth = (netAppClient as any).auth;
            const axios = (await import('axios')).default;
            const response = await axios.request({
                url: `https://netapp.googleapis.com/v1/${parent}/operations`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`
                }
            });
            const operations = (response.data as any).operations || [];

            // Filter operations
            let filteredOps = operations.filter((op: any) => {
                if (operationType && op.metadata?.method !== operationType) return false;
                if (status) {
                    if (status === 'DONE' && !op.done) return false;
                    if (status === 'RUNNING' && op.done) return false;
                    if (status === 'PENDING' && op.done) return false;
                    if (status === 'CANCELLED' && !op.cancelled) return false;
                }
                return true;
            });

            // Count by status
            const operationCounts: Record<string, number> = {
                PENDING: 0,
                RUNNING: 0,
                DONE: 0,
                CANCELLED: 0,
                FAILED: 0
            };

            const failedOperations: any[] = [];
            const longRunningOperations: any[] = [];
            const durationByType: Record<string, number[]> = {};

            filteredOps.forEach((op: any) => {
                const opType = op.metadata?.method || 'unknown';
                
                if (op.done) {
                    if (op.error) {
                        operationCounts.FAILED++;
                        const nameParts = op.name?.split('/') || [];
                        failedOperations.push({
                            operationId: nameParts[nameParts.length - 1] || '',
                            operationType: opType,
                            errorMessage: op.error?.message || 'Unknown error',
                            startTime: op.metadata?.createTime || ''
                        });
                    } else {
                        operationCounts.DONE++;
                    }

                    // Calculate duration
                    if (op.metadata?.createTime && op.metadata?.endTime) {
                        const start = new Date(op.metadata.createTime.seconds * 1000);
                        const end = new Date(op.metadata.endTime.seconds * 1000);
                        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                        
                        if (!durationByType[opType]) {
                            durationByType[opType] = [];
                        }
                        durationByType[opType].push(durationMinutes);
                    }
                } else if (op.cancelled) {
                    operationCounts.CANCELLED++;
                } else {
                    // Check if it's been running too long
                    if (op.metadata?.createTime) {
                        const start = new Date(op.metadata.createTime.seconds * 1000);
                        const durationMinutes = (Date.now() - start.getTime()) / (1000 * 60);
                        if (durationMinutes > 60) { // More than 1 hour
                            operationCounts.RUNNING++;
                            const nameParts = op.name?.split('/') || [];
                            longRunningOperations.push({
                                operationId: nameParts[nameParts.length - 1] || '',
                                operationType: opType,
                                durationMinutes: Math.round(durationMinutes)
                            });
                        } else {
                            operationCounts.RUNNING++;
                        }
                    } else {
                        operationCounts.PENDING++;
                    }
                }
            });

            // Calculate average duration by type
            const averageDurationByType: Record<string, number> = {};
            Object.entries(durationByType).forEach(([type, durations]) => {
                const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
                averageDurationByType[type] = Math.round(avg * 100) / 100;
            });

            const recommendations: string[] = [];
            if (failedOperations.length > 0) {
                recommendations.push(`${failedOperations.length} operations have failed - review error messages`);
            }
            if (longRunningOperations.length > 0) {
                recommendations.push(`${longRunningOperations.length} operations have been running for over 1 hour - consider investigating`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        operationCounts,
                        failedOperations,
                        longRunningOperations,
                        averageDurationByType,
                        recommendations
                    }, null, 2)
                }],
                structuredContent: {
                    operationCounts,
                    failedOperations,
                    longRunningOperations,
                    averageDurationByType,
                    recommendations
                }
            };
        } catch (error: any) {
            console.error("Error getting operation status summary:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error getting operation status summary: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };


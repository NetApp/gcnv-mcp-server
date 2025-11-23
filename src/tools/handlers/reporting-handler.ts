import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";
import { getVolumeBackupStatus } from "../../utils/backup-status-helper.js";

// Resource Summary Report Handler
export const resourceSummaryReportHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, reportType = 'full', format = 'json' } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const resourceCounts: Record<string, number> = {};
            let capacitySummary: any = undefined;
            let healthSummary: any = undefined;
            let costEstimate: any = undefined;

            // Get all resources
            const [volumes] = await netAppClient.listVolumes({ parent });
            const [pools] = await netAppClient.listStoragePools({ parent });
            const [backupVaults] = await netAppClient.listBackupVaults({ parent });
            // Replications are scoped to volumes, so we need to iterate through volumes
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
            const replications = allReplications;
            const [backupPoliciesResponse] = await netAppClient.listBackupPolicies({ parent });
            const backupPolicies = Array.isArray(backupPoliciesResponse)
                ? backupPoliciesResponse
                : (backupPoliciesResponse as any).backupPolicies || [];

            resourceCounts.volumes = volumes.length;
            resourceCounts.storagePools = pools.length;
            resourceCounts.backupVaults = backupVaults.length;
            resourceCounts.replications = replications.length;
            resourceCounts.backupPolicies = backupPolicies.length;

            // Calculate backup status summary
            let backupStatusSummary: any = undefined;
            let smbShareSettingsSummary: any = undefined;
            if (reportType === 'full' || reportType === 'health') {
                let volumesWithBackupPolicy = 0;
                let volumesWithRecentBackup = 0;
                let volumesCompliant = 0;

                // SMB share settings counters
                let smbVolumes = 0;
                let smbVolumesWithAbe = 0;
                let smbVolumesWithShowSnapshot = 0;
                let smbVolumesContinuouslyAvailable = 0;
                let smbVolumesWithEncryptData = 0;

                for (const vol of volumes) {
                    try {
                        const backupStatus = await getVolumeBackupStatus(netAppClient, vol, parent);
                        if (backupStatus.hasBackupPolicy) volumesWithBackupPolicy++;
                        if (backupStatus.hasRecentBackup) volumesWithRecentBackup++;
                        if (backupStatus.status === 'compliant') volumesCompliant++;

                        // Check SMB share settings
                        const protocols = (vol as any).shareProtocols || (vol as any).protocols || [];
                        const isSmbVolume = protocols.includes('SMB') || protocols.includes('DUAL');
                        if (isSmbVolume) {
                            smbVolumes++;
                            const shareSettings = (vol as any).shareSettings || (vol as any).smbSettings;
                            const settingsArray = Array.isArray(shareSettings)
                                ? shareSettings
                                : (shareSettings?.settings || shareSettings?.smbSettings || []);

                            if (settingsArray.includes('ACCESS_BASED_ENUMERATION')) smbVolumesWithAbe++;
                            if (settingsArray.includes('SHOW_SNAPSHOT')) smbVolumesWithShowSnapshot++;
                            if (settingsArray.includes('CONTINUOUSLY_AVAILABLE')) smbVolumesContinuouslyAvailable++;
                            if (settingsArray.includes('ENCRYPT_DATA')) smbVolumesWithEncryptData++;
                        }
                    } catch {
                        // Continue
                    }
                }

                backupStatusSummary = {
                    totalVolumes: volumes.length,
                    volumesWithBackupPolicy,
                    volumesWithRecentBackup,
                    volumesCompliant,
                    compliancePercentage: volumes.length > 0
                        ? Math.round((volumesCompliant / volumes.length) * 10000) / 100
                        : 100
                };

                if (smbVolumes > 0) {
                    smbShareSettingsSummary = {
                        totalSmbVolumes: smbVolumes,
                        volumesWithAbe: smbVolumesWithAbe,
                        volumesWithShowSnapshot: smbVolumesWithShowSnapshot,
                        volumesContinuouslyAvailable: smbVolumesContinuouslyAvailable,
                        volumesWithEncryptData: smbVolumesWithEncryptData,
                        volumesWithoutEncryptData: smbVolumes - smbVolumesWithEncryptData,
                        abePercentage: Math.round((smbVolumesWithAbe / smbVolumes) * 10000) / 100,
                        showSnapshotPercentage: Math.round((smbVolumesWithShowSnapshot / smbVolumes) * 10000) / 100,
                        encryptDataPercentage: Math.round((smbVolumesWithEncryptData / smbVolumes) * 10000) / 100
                    };
                }
            }

            // Count snapshots
            let snapshotCount = 0;
            for (const vol of volumes) {
                try {
                    const [snapshots] = await netAppClient.listSnapshots({
                        parent: vol.name?.replace(/\/volumes\/[^/]+$/, '') || parent,
                        filter: `volume="${vol.name}"`
                    });
                    snapshotCount += snapshots.length;
                } catch {
                    // Continue
                }
            }
            resourceCounts.snapshots = snapshotCount;

            // Count backups
            let backupCount = 0;
            for (const vault of backupVaults) {
                try {
                    const [backups] = await netAppClient.listBackups({
                        parent: vault.name || ''
                    });
                    backupCount += backups.length;
                } catch {
                    // Continue
                }
            }
            resourceCounts.backups = backupCount;

            if (reportType === 'full' || reportType === 'capacity') {
                const totalCapacityGib = pools.reduce((sum, p) => sum + Number(p.capacityGib || 0), 0);
                const allocatedCapacityGib = volumes.reduce((sum, v) => sum + Number(v.capacityGib || 0), 0);
                const usedCapacityGib = volumes.reduce((sum, v) => sum + Number(v.usedGib || 0), 0);
                const availableCapacityGib = totalCapacityGib - allocatedCapacityGib;

                capacitySummary = {
                    totalCapacityGib,
                    allocatedCapacityGib,
                    usedCapacityGib,
                    availableCapacityGib
                };
            }

            if (reportType === 'full' || reportType === 'health') {
                const healthyResources = volumes.filter(v => v.state === 'READY').length +
                    pools.filter(p => p.state === 'READY').length;
                const resourcesInError = volumes.filter(v => v.state === 'ERROR').length +
                    pools.filter(p => p.state === 'ERROR').length;
                const resourcesInWarning = volumes.filter(v => v.state === 'CREATING' || v.state === 'UPDATING').length +
                    pools.filter(p => p.state === 'CREATING' || p.state === 'UPDATING').length;

                healthSummary = {
                    healthyResources,
                    resourcesInError,
                    resourcesInWarning
                };
            }

            if (reportType === 'full' || reportType === 'cost') {
                // Rough cost estimation
                const costByServiceLevel: Record<string, number> = {};
                pools.forEach((pool: any) => {
                    const level = pool.serviceLevel || 'STANDARD';
                    const capacity = Number(pool.capacityGib || 0);
                    const pricePerGib = level === 'EXTREME' ? 0.40 : level === 'PREMIUM' ? 0.30 : 0.20;
                    costByServiceLevel[level] = (costByServiceLevel[level] || 0) + (capacity * pricePerGib);
                });

                const estimatedMonthlyCost = Object.values(costByServiceLevel).reduce((a, b) => a + b, 0);

                costEstimate = {
                    estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
                    estimatedYearlyCost: Math.round(estimatedMonthlyCost * 12 * 100) / 100,
                    breakdownByServiceLevel: costByServiceLevel
                };
            }

            let reportText: string | undefined;
            if (format === 'text' || format === 'markdown') {
                reportText = `# GCNV Resource Summary Report\n\n`;
                reportText += `## Resource Counts\n`;
                Object.entries(resourceCounts).forEach(([type, count]) => {
                    reportText += `- ${type}: ${count}\n`;
                });
                if (capacitySummary) {
                    reportText += `\n## Capacity Summary\n`;
                    reportText += `- Total: ${capacitySummary.totalCapacityGib} GiB\n`;
                    reportText += `- Allocated: ${capacitySummary.allocatedCapacityGib} GiB\n`;
                    reportText += `- Used: ${capacitySummary.usedCapacityGib} GiB\n`;
                    reportText += `- Available: ${capacitySummary.availableCapacityGib} GiB\n`;
                }
                if (healthSummary) {
                    reportText += `\n## Health Summary\n`;
                    reportText += `- Healthy: ${healthSummary.healthyResources}\n`;
                    reportText += `- Errors: ${healthSummary.resourcesInError}\n`;
                    reportText += `- Warnings: ${healthSummary.resourcesInWarning}\n`;
                }
                if (backupStatusSummary) {
                    reportText += `\n## Backup Status Summary\n`;
                    reportText += `- Volumes with Backup Policy: ${backupStatusSummary.volumesWithBackupPolicy}/${backupStatusSummary.totalVolumes}\n`;
                    reportText += `- Volumes with Recent Backup: ${backupStatusSummary.volumesWithRecentBackup}/${backupStatusSummary.totalVolumes}\n`;
                    reportText += `- Compliance: ${backupStatusSummary.compliancePercentage}%\n`;
                }
                if (smbShareSettingsSummary) {
                    reportText += `\n## SMB Share Settings Summary\n`;
                    reportText += `- Total SMB Volumes: ${smbShareSettingsSummary.totalSmbVolumes}\n`;
                    reportText += `- ACCESS_BASED_ENUMERATION Enabled: ${smbShareSettingsSummary.volumesWithAbe} (${smbShareSettingsSummary.abePercentage}%)\n`;
                    reportText += `- SHOW_SNAPSHOT Enabled: ${smbShareSettingsSummary.volumesWithShowSnapshot} (${smbShareSettingsSummary.showSnapshotPercentage}%)\n`;
                    reportText += `- CONTINUOUSLY_AVAILABLE Enabled: ${smbShareSettingsSummary.volumesContinuouslyAvailable}\n`;
                    reportText += `- ENCRYPT_DATA Enabled: ${smbShareSettingsSummary.volumesWithEncryptData} (${smbShareSettingsSummary.encryptDataPercentage}%)\n`;
                    reportText += `- Volumes without ENCRYPT_DATA: ${smbShareSettingsSummary.volumesWithoutEncryptData}\n`;
                }
                if (costEstimate) {
                    reportText += `\n## Cost Estimate\n`;
                    reportText += `- Monthly: $${costEstimate.estimatedMonthlyCost}\n`;
                    reportText += `- Yearly: $${costEstimate.estimatedYearlyCost}\n`;
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        resourceCounts,
                        capacitySummary,
                        healthSummary,
                        backupStatusSummary,
                        smbShareSettingsSummary,
                        costEstimate,
                        reportText
                    }, null, 2)
                }],
                structuredContent: {
                    resourceCounts,
                    capacitySummary,
                    healthSummary,
                    backupStatusSummary,
                    smbShareSettingsSummary,
                    costEstimate,
                    reportText
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error generating report: ${error.message}` }]
            };
        }
    };

// Capacity Utilization Report Handler
export const capacityUtilizationReportHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, groupBy = 'storagePool', includeProjections = false } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [pools] = await netAppClient.listStoragePools({ parent });
            const capacityBreakdown: any[] = [];

            for (const pool of pools) {
                const [volumes] = await netAppClient.listVolumes({
                    parent,
                    filter: `storagePool="${pool.name}"`
                });

                const totalCapacityGib = Number(pool.capacityGib || 0);
                const allocatedCapacityGib = volumes.reduce((sum, v) => sum + Number(v.capacityGib || 0), 0);
                const usedCapacityGib = volumes.reduce((sum, v) => sum + Number(v.usedGib || 0), 0);
                const utilizationPercent = totalCapacityGib > 0
                    ? (allocatedCapacityGib / totalCapacityGib) * 100
                    : 0;

                const group = groupBy === 'storagePool'
                    ? pool.name?.split('/').pop() || ''
                    : groupBy === 'serviceLevel'
                    ? pool.serviceLevel || ''
                    : 'all';

                // Check auto-tiering status at pool level (available for PREMIUM and EXTREME)
                // Auto-tiering is a boolean field at the storage pool level (allowAutoTiering)
                // Volumes can only enable auto-tiering if the pool has allowAutoTiering=true
                const serviceLevel = pool.serviceLevel || '';
                const autoTieringEnabled = (serviceLevel === 'PREMIUM' || serviceLevel === 'EXTREME')
                    ? ((pool as any).allowAutoTiering === true)
                    : false;

                // Estimate auto-tiering savings
                const autoTieringSavings = autoTieringEnabled && usedCapacityGib > 0
                    ? (usedCapacityGib * 0.25 * 0.20 * 0.30) // 25% cold data, 20% tiered, 30% savings
                    : undefined;

                capacityBreakdown.push({
                    group,
                    totalCapacityGib,
                    allocatedCapacityGib,
                    usedCapacityGib,
                    utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                    autoTieringEnabled,
                    autoTieringSavings: autoTieringSavings ? Math.round(autoTieringSavings * 100) / 100 : undefined
                });
            }

            const utilizationPercentages: Record<string, number> = {};
            capacityBreakdown.forEach(item => {
                utilizationPercentages[item.group] = item.utilizationPercent;
            });

            const recommendations: string[] = [];
            const highUtil = capacityBreakdown.filter(c => c.utilizationPercent > 80);
            if (highUtil.length > 0) {
                recommendations.push(`${highUtil.length} storage pools are above 80% utilization`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        capacityBreakdown,
                        utilizationPercentages,
                        recommendations
                    }, null, 2)
                }],
                structuredContent: {
                    capacityBreakdown,
                    utilizationPercentages,
                    recommendations
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error generating capacity report: ${error.message}` }]
            };
        }
    };

// Cost Analysis Report Handler
export const costAnalysisReportHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, groupBy = 'serviceLevel', timeRange = 'monthly' } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            const [pools] = await netAppClient.listStoragePools({ parent });
            const pricing: Record<string, number> = {
                STANDARD: 0.20,
                PREMIUM: 0.30,
                EXTREME: 0.40,
                FLEX: 0.25
            };

            const costBreakdown: any[] = [];
            const costByServiceLevel: Record<string, number> = {};
            const costByStoragePool: Record<string, number> = {};

            pools.forEach((pool: any) => {
                const level = pool.serviceLevel || 'STANDARD';
                const capacity = Number(pool.capacityGib || 0);
                const pricePerGib = pricing[level] || 0.20;
                const monthlyCost = capacity * pricePerGib;
                const yearlyCost = monthlyCost * 12;

                const poolNameParts = pool.name?.split('/') || [];
                const poolId = poolNameParts[poolNameParts.length - 1] || '';

                const group = groupBy === 'serviceLevel' ? level :
                    groupBy === 'storagePool' ? poolId : 'all';

                costBreakdown.push({
                    group,
                    monthlyCost: Math.round(monthlyCost * 100) / 100,
                    yearlyCost: Math.round(yearlyCost * 100) / 100,
                    capacityGib: capacity,
                    costPerGib: Math.round(pricePerGib * 1000) / 1000
                });

                costByServiceLevel[level] = (costByServiceLevel[level] || 0) + monthlyCost;
                costByStoragePool[poolId] = monthlyCost;
            });

            const totalMonthly = Object.values(costByServiceLevel).reduce((a, b) => a + b, 0);
            const totalYearly = totalMonthly * 12;

            const costOptimizationOpportunities: any[] = [];
            const highCostPools = costBreakdown.filter(c => c.monthlyCost > 1000);
            if (highCostPools.length > 0) {
                costOptimizationOpportunities.push({
                    opportunity: 'Review high-cost storage pools',
                    estimatedSavings: highCostPools.length * 100,
                    description: `${highCostPools.length} pools costing over $1000/month - consider optimization`
                });
            }

            // Auto-tiering analysis
            let poolsWithAutoTiering = 0;
            let poolsEligibleForAutoTiering = 0;
            let estimatedTotalSavings = 0;

            for (const pool of pools) {
                const serviceLevel = pool.serviceLevel || '';
                const isEligible = (serviceLevel === 'PREMIUM' || serviceLevel === 'EXTREME');

                if (isEligible) {
                    // Auto-tiering is a boolean field at the storage pool level (allowAutoTiering)
                    // Volumes can only enable auto-tiering if the pool has allowAutoTiering=true
                    const autoTieringEnabled = (pool as any).allowAutoTiering === true;

                    if (autoTieringEnabled) {
                        poolsWithAutoTiering++;
                        // Get volumes to calculate actual tiering savings
                        try {
                            const [volumes] = await netAppClient.listVolumes({
                                parent,
                                filter: `storagePool="${pool.name}"`
                            });

                            let totalColdTierGib = 0;
                            let totalHotTierGib = 0;
                            volumes.forEach((v: any) => {
                                if (v.coldTierSizeGib !== undefined) {
                                    totalColdTierGib += Number(v.coldTierSizeGib || 0);
                                }
                                if (v.hotTierSizeUsedGib !== undefined) {
                                    totalHotTierGib += Number(v.hotTierSizeUsedGib || 0);
                                }
                            });

                            // Calculate actual savings if tiering metrics available
                            if (totalColdTierGib > 0) {
                                const pricePerGibHot = serviceLevel === 'EXTREME' ? 0.40 : 0.30;
                                const pricePerGibCold = pricePerGibHot * 0.70; // 30% savings
                                const actualSavings = totalColdTierGib * (pricePerGibHot - pricePerGibCold);
                                estimatedTotalSavings += actualSavings;
                            } else {
                                // Fallback to estimation
                                const usedCapacityGib = volumes.reduce((sum: number, v: any) =>
                                    sum + Number(v.usedGib || 0), 0);
                                const savings = usedCapacityGib * 0.25 * 0.20 * 0.30; // Estimate
                                estimatedTotalSavings += savings;
                            }
                        } catch {
                            // Continue
                        }
                    } else {
                        poolsEligibleForAutoTiering++;
                        // Estimate potential savings if enabled
                        try {
                            const [volumes] = await netAppClient.listVolumes({
                                parent,
                                filter: `storagePool="${pool.name}"`
                            });
                            const usedCapacityGib = volumes.reduce((sum: number, v: any) =>
                                sum + Number(v.usedGib || 0), 0);
                            const potentialSavings = usedCapacityGib * 0.25 * 0.20 * 0.30;
                            estimatedTotalSavings += potentialSavings;
                        } catch {
                            // Continue
                        }
                    }
                }
            }

            const autoTieringAnalysis = {
                poolsWithAutoTiering,
                poolsEligibleForAutoTiering,
                estimatedTotalSavings: Math.round(estimatedTotalSavings * 100) / 100
            };

            if (poolsEligibleForAutoTiering > 0) {
                costOptimizationOpportunities.push({
                    opportunity: 'Enable auto-tiering on eligible pools',
                    estimatedSavings: Math.round(estimatedTotalSavings * 100) / 100,
                    description: `${poolsEligibleForAutoTiering} PREMIUM/EXTREME pools could benefit from auto-tiering - moves infrequently used data to cold storage`
                });
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        costBreakdown,
                        totalCost: {
                            monthly: Math.round(totalMonthly * 100) / 100,
                            yearly: Math.round(totalYearly * 100) / 100
                        },
                        costByServiceLevel,
                        costByStoragePool,
                        costOptimizationOpportunities,
                        autoTieringAnalysis
                    }, null, 2)
                }],
                structuredContent: {
                    costBreakdown,
                    totalCost: {
                        monthly: Math.round(totalMonthly * 100) / 100,
                        yearly: Math.round(totalYearly * 100) / 100
                    },
                    costByServiceLevel,
                    costByStoragePool,
                    costOptimizationOpportunities,
                    autoTieringAnalysis
                }
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text" as const, text: `Error generating cost report: ${error.message}` }]
            };
        }
    };


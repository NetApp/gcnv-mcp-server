import { ToolHandler } from "../../types/tool.js";
import { NetAppClientFactory } from "../../utils/netapp-client-factory.js";

// Volume Capacity Analysis Handler
export const volumeCapacityAnalysisHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, storagePoolId, thresholdPercent = 80 } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            // List all volumes
            const request: any = { parent };
            if (storagePoolId) {
                request.filter = `storagePool="${parent}/storagePools/${storagePoolId}"`;
            }

            const [volumes] = await netAppClient.listVolumes(request);

            let totalAllocatedGib = 0;
            let totalUsedGib = 0;
            const highUtilizationVolumes: any[] = [];
            const lowUtilizationVolumes: any[] = [];

            let totalHotTierGib = 0;
            let totalColdTierGib = 0;
            const volumesWithTiering: any[] = [];

            volumes.forEach((volume: any) => {
                const capacityGib = Number(volume.capacityGib || 0);
                const usedGib = Number(volume.usedGib || 0);
                const utilizationPercent = capacityGib > 0 ? (usedGib / capacityGib) * 100 : 0;

                totalAllocatedGib += capacityGib;
                totalUsedGib += usedGib;

                const nameParts = volume.name?.split('/') || [];
                const volumeId = nameParts[nameParts.length - 1] || '';

                // Extract tiering metrics if available
                const hotTierGib = volume.hotTierSizeUsedGib ? Number(volume.hotTierSizeUsedGib) : undefined;
                const coldTierGib = volume.coldTierSizeGib ? Number(volume.coldTierSizeGib) : undefined;

                if (hotTierGib !== undefined) totalHotTierGib += hotTierGib;
                if (coldTierGib !== undefined) totalColdTierGib += coldTierGib;

                const volumeInfo: any = {
                    volumeId,
                    capacityGib,
                    usedGib,
                    utilizationPercent: Math.round(utilizationPercent * 100) / 100
                };

                // Add tiering metrics if available
                if (hotTierGib !== undefined || coldTierGib !== undefined) {
                    volumeInfo.tieringMetrics = {
                        hotTierSizeUsedGib: hotTierGib || 0,
                        coldTierSizeGib: coldTierGib || 0,
                        hotTierPercentage: usedGib > 0 && hotTierGib ? Math.round((hotTierGib / usedGib) * 10000) / 100 : 0,
                        coldTierPercentage: usedGib > 0 && coldTierGib ? Math.round((coldTierGib / usedGib) * 10000) / 100 : 0
                    };
                    volumesWithTiering.push(volumeInfo);
                }

                if (utilizationPercent >= thresholdPercent) {
                    highUtilizationVolumes.push(volumeInfo);
                } else if (utilizationPercent < 20) {
                    lowUtilizationVolumes.push(volumeInfo);
                }
            });

            const averageUtilizationPercent = totalAllocatedGib > 0
                ? (totalUsedGib / totalAllocatedGib) * 100
                : 0;

            const recommendations: string[] = [];
            if (highUtilizationVolumes.length > 0) {
                recommendations.push(`${highUtilizationVolumes.length} volumes are above ${thresholdPercent}% utilization and may need capacity expansion`);
            }
            if (lowUtilizationVolumes.length > 0) {
                recommendations.push(`${lowUtilizationVolumes.length} volumes are below 20% utilization and could potentially be downsized`);
            }
            if (averageUtilizationPercent > 80) {
                recommendations.push("Overall capacity utilization is high - consider adding more storage capacity");
            }
            if (volumesWithTiering.length > 0 && totalColdTierGib > 0) {
                const coldTierPercentage = totalUsedGib > 0 ? Math.round((totalColdTierGib / totalUsedGib) * 10000) / 100 : 0;
                recommendations.push(`${volumesWithTiering.length} volumes using auto-tiering: ${Math.round(totalColdTierGib * 100) / 100} GiB in cold tier (${coldTierPercentage}% of used capacity)`);
            }

            const tieringSummary = volumesWithTiering.length > 0 ? {
                volumesWithTiering: volumesWithTiering.length,
                totalHotTierGib: Math.round(totalHotTierGib * 100) / 100,
                totalColdTierGib: Math.round(totalColdTierGib * 100) / 100,
                hotTierPercentage: totalUsedGib > 0 ? Math.round((totalHotTierGib / totalUsedGib) * 10000) / 100 : 0,
                coldTierPercentage: totalUsedGib > 0 ? Math.round((totalColdTierGib / totalUsedGib) * 10000) / 100 : 0
            } : undefined;

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        totalAllocatedGib,
                        totalUsedGib,
                        averageUtilizationPercent: Math.round(averageUtilizationPercent * 100) / 100,
                        highUtilizationVolumes,
                        lowUtilizationVolumes,
                        tieringSummary,
                        recommendations
                    }, null, 2)
                }],
                structuredContent: {
                    totalAllocatedGib,
                    totalUsedGib,
                    averageUtilizationPercent: Math.round(averageUtilizationPercent * 100) / 100,
                    highUtilizationVolumes,
                    lowUtilizationVolumes,
                    tieringSummary,
                    recommendations
                }
            };
        } catch (error: any) {
            console.error("Error analyzing volume capacity:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error analyzing volume capacity: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Storage Pool Capacity Planning Handler
export const storagePoolCapacityPlanningHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, requiredCapacityGib, serviceLevel } = args;
            const netAppClient = NetAppClientFactory.createClient();
            const parent = `projects/${projectId}/locations/${location}`;

            // List storage pools
            const request: any = { parent };
            if (serviceLevel) {
                request.filter = `serviceLevel="${serviceLevel}"`;
            }

            const [storagePools] = await netAppClient.listStoragePools(request);

            // Get volumes for each storage pool to calculate allocated capacity
            const poolAnalysis = await Promise.all(
                storagePools.map(async (pool: any) => {
                    const poolNameParts = pool.name?.split('/') || [];
                    const poolId = poolNameParts[poolNameParts.length - 1] || '';

                    // List volumes in this pool
                    const volumeRequest = {
                        parent,
                        filter: `storagePool="${pool.name}"`
                    };
                    const [volumes] = await netAppClient.listVolumes(volumeRequest);

                    const totalCapacityGib = Number(pool.capacityGib || 0);
                    const allocatedCapacityGib = volumes.reduce((sum: number, vol: any) =>
                        sum + Number(vol.capacityGib || 0), 0);
                    const availableCapacityGib = totalCapacityGib - allocatedCapacityGib;
                    const utilizationPercent = totalCapacityGib > 0
                        ? (allocatedCapacityGib / totalCapacityGib) * 100
                        : 0;

                    // Check if auto-tiering is enabled at pool level (available for PREMIUM and EXTREME service levels)
                    // Auto-tiering is a boolean field at the storage pool level (allowAutoTiering)
                    // Volumes can only enable auto-tiering if the pool has allowAutoTiering=true
                    const serviceLevel = pool.serviceLevel || '';
                    const autoTieringEnabled = (serviceLevel === 'PREMIUM' || serviceLevel === 'EXTREME')
                        ? ((pool as any).allowAutoTiering === true)
                        : false;

                    // Calculate used capacity and actual tiering metrics
                    let usedCapacityGib = 0;
                    let totalHotTierGib = 0;
                    let totalColdTierGib = 0;

                    volumes.forEach((vol: any) => {
                        usedCapacityGib += Number(vol.usedGib || 0);
                        // Use actual tiering metrics if available (when auto-tiering is active)
                        if (vol.hotTierSizeUsedGib !== undefined) {
                            totalHotTierGib += Number(vol.hotTierSizeUsedGib || 0);
                        }
                        if (vol.coldTierSizeGib !== undefined) {
                            totalColdTierGib += Number(vol.coldTierSizeGib || 0);
                        }
                    });

                    // Calculate actual auto-tiering savings if tiering metrics are available
                    // Cold tier typically costs ~30% less than hot tier
                    let autoTieringSavings: number | undefined = undefined;
                    let autoTieringAnalysis: any = undefined;

                    if (autoTieringEnabled && totalColdTierGib > 0) {
                        // Calculate actual savings: cold tier saves ~30% compared to hot tier
                        // Assuming PREMIUM/EXTREME pricing: $0.30/GiB hot, ~$0.21/GiB cold (30% savings)
                        const pricePerGibHot = serviceLevel === 'EXTREME' ? 0.40 : 0.30;
                        const pricePerGibCold = pricePerGibHot * 0.70; // 30% savings
                        const monthlySavings = totalColdTierGib * (pricePerGibHot - pricePerGibCold);
                        autoTieringSavings = monthlySavings;

                        autoTieringAnalysis = {
                            totalHotTierGib: Math.round(totalHotTierGib * 100) / 100,
                            totalColdTierGib: Math.round(totalColdTierGib * 100) / 100,
                            hotTierPercentage: usedCapacityGib > 0 ? Math.round((totalHotTierGib / usedCapacityGib) * 10000) / 100 : 0,
                            coldTierPercentage: usedCapacityGib > 0 ? Math.round((totalColdTierGib / usedCapacityGib) * 10000) / 100 : 0,
                            actualSavings: Math.round(monthlySavings * 100) / 100
                        };
                    } else if (autoTieringEnabled && usedCapacityGib > 0) {
                        // Fallback to estimation if tiering metrics not available yet
                        autoTieringSavings = usedCapacityGib * 0.25 * 0.20 * 0.30; // Estimate
                    }

                    return {
                        storagePoolId: poolId,
                        serviceLevel,
                        totalCapacityGib,
                        allocatedCapacityGib,
                        availableCapacityGib,
                        utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                        volumeCount: volumes.length,
                        canAccommodate: requiredCapacityGib
                            ? availableCapacityGib >= requiredCapacityGib
                            : undefined,
                        autoTieringEnabled,
                        autoTieringSavings: autoTieringSavings ? Math.round(autoTieringSavings * 100) / 100 : undefined,
                        autoTieringAnalysis
                    };
                })
            );

            const recommendations: string[] = [];
            if (requiredCapacityGib) {
                const suitablePools = poolAnalysis.filter(p => p.canAccommodate);
                if (suitablePools.length > 0) {
                    const bestPool = suitablePools.sort((a, b) =>
                        a.utilizationPercent - b.utilizationPercent)[0];
                    recommendations.push(`Recommended: ${bestPool.storagePoolId} (${bestPool.serviceLevel}) - ${bestPool.availableCapacityGib} GiB available`);
                    if (bestPool.autoTieringEnabled && bestPool.autoTieringSavings) {
                        recommendations.push(`Auto-tiering enabled - estimated savings: $${bestPool.autoTieringSavings}/month`);
                    } else if ((bestPool.serviceLevel === 'PREMIUM' || bestPool.serviceLevel === 'EXTREME') && !bestPool.autoTieringEnabled) {
                        recommendations.push(`Consider enabling auto-tiering for potential cost savings (moves infrequently used data to cold storage)`);
                    }
                } else {
                    recommendations.push(`No storage pools have enough capacity for ${requiredCapacityGib} GiB`);
                }
            }

            // Add auto-tiering recommendations for eligible pools
            const eligiblePools = poolAnalysis.filter(p =>
                (p.serviceLevel === 'PREMIUM' || p.serviceLevel === 'EXTREME') && !p.autoTieringEnabled
            );
            if (eligiblePools.length > 0) {
                recommendations.push(`${eligiblePools.length} PREMIUM/EXTREME pools are eligible for auto-tiering - enable to reduce costs by moving infrequently used data to cold storage`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ storagePools: poolAnalysis, recommendations }, null, 2)
                }],
                structuredContent: {
                    storagePools: poolAnalysis,
                    recommendations
                }
            };
        } catch (error: any) {
            console.error("Error in capacity planning:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error in capacity planning: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };

// Resource Cost Estimation Handler
export const resourceCostEstimationHandler: ToolHandler =
    async (args: { [key: string]: any }, extra: any) => {
        try {
            const { projectId, location, resourceType, capacityGib, serviceLevel, durationDays } = args;

            // Note: Actual pricing would need to be fetched from GCP pricing API or configured
            // These are example pricing per GiB per month (approximate)
            const pricing: Record<string, Record<string, number>> = {
                volume: {
                    STANDARD: 0.20,
                    PREMIUM: 0.30,
                    EXTREME: 0.40,
                    FLEX: 0.25
                },
                storagePool: {
                    STANDARD: 0.18,
                    PREMIUM: 0.28,
                    EXTREME: 0.38,
                    FLEX: 0.23
                },
                backup: {
                    STANDARD: 0.10
                }
            };

            let monthlyCost = 0;
            const costBreakdown: Record<string, number> = {};

            if (resourceType === 'volume' || resourceType === 'storagePool') {
                const level = serviceLevel || 'STANDARD';
                const pricePerGib = pricing[resourceType]?.[level] || 0;
                monthlyCost = capacityGib * pricePerGib;
                costBreakdown[`${resourceType}_${level}_storage`] = monthlyCost;
            } else if (resourceType === 'backup') {
                const pricePerGib = pricing.backup.STANDARD;
                const months = durationDays ? durationDays / 30 : 1;
                monthlyCost = capacityGib * pricePerGib * months;
                costBreakdown['backup_storage'] = monthlyCost;
            }

            const yearlyCost = monthlyCost * 12;

            // Comparison with other service levels (for volumes/pools)
            const comparisonWithOtherServiceLevels =
                (resourceType === 'volume' || resourceType === 'storagePool')
                    ? ['STANDARD', 'PREMIUM', 'EXTREME', 'FLEX']
                        .filter(level => !serviceLevel || level !== serviceLevel)
                        .map(level => ({
                            serviceLevel: level,
                            monthlyCost: capacityGib * (pricing[resourceType]?.[level] || 0)
                        }))
                    : undefined;

            const costOptimizationSuggestions: string[] = [];
            if (resourceType === 'volume' || resourceType === 'storagePool') {
                if (serviceLevel === 'EXTREME') {
                    costOptimizationSuggestions.push("Consider PREMIUM or FLEX service level for potential cost savings if performance requirements allow");
                } else if (serviceLevel === 'PREMIUM') {
                    costOptimizationSuggestions.push("Consider FLEX or STANDARD service level for potential cost savings if performance requirements allow");
                } else if (serviceLevel === 'FLEX') {
                    costOptimizationSuggestions.push("FLEX provides integrated backup and regional HA - consider enabling auto-tiering for additional cost optimization");
                }
            }
            if (resourceType === 'backup' && durationDays && durationDays > 90) {
                costOptimizationSuggestions.push("Consider reducing backup retention period to lower costs");
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
                        estimatedYearlyCost: Math.round(yearlyCost * 100) / 100,
                        costBreakdown,
                        comparisonWithOtherServiceLevels,
                        costOptimizationSuggestions
                    }, null, 2)
                }],
                structuredContent: {
                    estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
                    estimatedYearlyCost: Math.round(yearlyCost * 100) / 100,
                    costBreakdown,
                    comparisonWithOtherServiceLevels,
                    costOptimizationSuggestions
                }
            };
        } catch (error: any) {
            console.error("Error estimating cost:", error);
            return {
                isError: true,
                content: [{
                    type: "text" as const,
                    text: `Error estimating cost: ${error.message || 'Unknown error'}`
                }]
            };
        }
    };


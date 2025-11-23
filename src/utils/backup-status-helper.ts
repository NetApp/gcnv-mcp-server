import { NetAppClient } from "@google-cloud/netapp";

/**
 * Interface for backup status information
 */
export interface BackupStatus {
    hasBackupPolicy: boolean;
    backupPolicyId?: string;
    backupPolicyEnabled?: boolean;
    backupPolicyDetails?: {
        dailyBackupLimit?: number;
        weeklyBackupLimit?: number;
        monthlyBackupLimit?: number;
    };
    hasRecentBackup: boolean;
    lastBackupTime?: Date;
    backupVault?: string;
    backupCount?: number;
    daysSinceLastBackup?: number;
    status: 'compliant' | 'non_compliant' | 'no_policy' | 'unknown';
}

/**
 * Determines the backup status of a volume by checking:
 * 1. If a backup policy is assigned to the volume
 * 2. If there are recent backups in backup vaults
 * 3. The last backup time and location
 */
export async function getVolumeBackupStatus(
    netAppClient: NetAppClient,
    volume: any,
    parent: string,
    maxDaysWithoutBackup: number = 7
): Promise<BackupStatus> {
    const result: BackupStatus = {
        hasBackupPolicy: false,
        hasRecentBackup: false,
        status: 'unknown'
    };

    try {
        // Check if volume has a backup policy assigned
        // The field might be backupPolicy or backupPolicyName
        const backupPolicyName = (volume as any).backupPolicy || (volume as any).backupPolicyName;
        
        if (backupPolicyName) {
            result.hasBackupPolicy = true;
            result.backupPolicyId = backupPolicyName.split('/').pop() || undefined;
            
            // Try to get backup policy details
            try {
                const [backupPolicy] = await netAppClient.getBackupPolicy({ name: backupPolicyName });
                result.backupPolicyEnabled = (backupPolicy as any).enabled !== false;
                result.backupPolicyDetails = {
                    dailyBackupLimit: (backupPolicy as any).dailyBackupLimit,
                    weeklyBackupLimit: (backupPolicy as any).weeklyBackupLimit,
                    monthlyBackupLimit: (backupPolicy as any).monthlyBackupLimit
                };
            } catch {
                // Policy might not exist or we can't access it
                result.backupPolicyEnabled = undefined;
            }
        }

        // Check for backups in backup vaults
        const [backupVaults] = await netAppClient.listBackupVaults({ parent });
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDaysWithoutBackup);

        let lastBackupTime: Date | undefined;
        let backupCount = 0;
        let recentBackupVault: string | undefined;

        for (const vault of backupVaults) {
            try {
                const [backups] = await netAppClient.listBackups({
                    parent: vault.name || '',
                    filter: `volume="${volume.name}"`
                });

                backupCount += backups.length;

                // Find the most recent backup
                for (const backup of backups) {
                    if (backup.createTime && backup.createTime.seconds !== null && backup.createTime.seconds !== undefined) {
                        const backupTime = new Date(Number(backup.createTime.seconds) * 1000);
                        if (!lastBackupTime || backupTime > lastBackupTime) {
                            lastBackupTime = backupTime;
                            recentBackupVault = vault.name || undefined;
                        }
                    }
                }
            } catch {
                // Continue checking other vaults
            }
        }

        result.backupCount = backupCount;
        result.lastBackupTime = lastBackupTime;
        result.backupVault = recentBackupVault;

        if (lastBackupTime) {
            result.hasRecentBackup = lastBackupTime > cutoffDate;
            const daysSince = Math.floor((Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60 * 24));
            result.daysSinceLastBackup = daysSince;
        }

        // Determine overall status
        if (result.hasBackupPolicy && result.hasRecentBackup) {
            result.status = 'compliant';
        } else if (result.hasBackupPolicy && !result.hasRecentBackup) {
            result.status = 'non_compliant';
        } else if (!result.hasBackupPolicy) {
            result.status = 'no_policy';
        } else {
            result.status = 'unknown';
        }

    } catch (error) {
        console.error("Error determining backup status:", error);
        result.status = 'unknown';
    }

    return result;
}


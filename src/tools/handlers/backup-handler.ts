import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'backup-handler' });

function normalizeStringEnum(value: any): string {
  return typeof value === 'string' ? value : 'UNKNOWN';
}

// Helper to format backup data for responses
function formatBackupData(backup: any): any {
  const result: any = {};

  if (!backup) return result;

  if (backup.name) {
    // Extract backupId from name (last part after last slash)
    const nameParts = backup.name.split('/');
    result.name = backup.name;
    result.backupId = nameParts[nameParts.length - 1];

    // Extract backupVaultId from name
    const backupVaultMatch = backup.name.match(/\/backupVaults\/([^/]+)\/backups\//);
    if (backupVaultMatch && backupVaultMatch[1]) {
      result.backupVaultId = backupVaultMatch[1];
    }
  }

  // Map source volume
  if (backup.sourceVolume) {
    result.sourceVolume = backup.sourceVolume; // Map sourceName to sourceVolume for schema consistency
  }

  // Copy basic properties
  if (backup.state !== undefined) result.state = normalizeStringEnum(backup.state);

  // Map volume usage bytes
  result.volumeUsagebytes = backup.volumeUsagebytes; // Keep original for compatibility

  // Format timestamps if they exist
  if (backup.createTime) {
    result.createTime = new Date(backup.createTime.seconds * 1000).toISOString();
  }

  // Copy optional properties according to schema
  if (backup.description) result.description = backup.description;
  if (backup.backupType !== undefined) result.backupType = normalizeStringEnum(backup.backupType);
  result.chainStoragebytes = backup.chainStoragebytes || 0;
  if (backup.satisfiesPzs !== undefined) result.satisfiesPzs = backup.satisfiesPzs;
  if (backup.satisfiesPzi !== undefined) result.satisfiesPzi = backup.satisfiesPzi;
  if (backup.volumeRegion) result.volumeRegion = backup.volumeRegion;
  if (backup.backupRegion) result.backupRegion = backup.backupRegion;
  if (backup.enforcedRetentionEndTime)
    result.enforcedRetentionEndTime = backup.enforcedRetentionEndTime;
  result.sourceSnapshot = backup.sourceSnapshot;
  if (backup.labels) result.labels = backup.labels;

  return result;
}

// Create Backup Handler
export const createBackupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      backupVaultId,
      backupId,
      sourceVolumeName,
      sourceSnapshotName,
      backupRegion,
      description,
      labels,
    } = args;

    const hasSourceVolume = typeof sourceVolumeName === 'string' && sourceVolumeName.length > 0;
    const hasSourceSnapshot =
      typeof sourceSnapshotName === 'string' && sourceSnapshotName.length > 0;
    if ((hasSourceVolume && hasSourceSnapshot) || (!hasSourceVolume && !hasSourceSnapshot)) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating backup: provide exactly one of sourceVolumeName or sourceSnapshotName.',
          },
        ],
      };
    }

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the backup
    const parent = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}`;
    // Construct the backup name
    const backupName = `${parent}/backups/${backupId}`;

    // Create the backup request
    const request = {
      parent,
      backupId,
      backup: {
        name: backupName,
        ...(hasSourceVolume ? { sourceVolume: sourceVolumeName } : {}),
        ...(hasSourceSnapshot ? { sourceSnapshot: sourceSnapshotName } : {}),
        backupRegion,
        description,
        labels,
      },
    };

    log.info({ request }, 'Create Backup request');

    // Create the backup
    const [operation] = await netAppClient.createBackup(request);

    // Extract the operation name for tracking
    const operationName = operation.name;

    log.info({ operationName }, 'Backup creation operation started');

    return {
      content: [
        {
          type: 'text' as const,
          text: `${operationName}`,
        },
      ],
      structuredContent: {
        name: backupName,
        operationId: operationName,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating backup');

    let errorMessage = `Failed to create backup: ${error.message}`;

    // Handle specific error types and provide useful error messages
    if (error.code === 6) {
      // ALREADY_EXISTS
      errorMessage = `Backup ${args.backupId} already exists in backup vault ${args.backupVaultId}`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    } else if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup vault or volume not found`;
    } else if (error.code === 3) {
      // INVALID_ARGUMENT
      errorMessage = `Invalid argument: ${error.message}`;
    }

    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: errorMessage,
        },
      ],
    };
  }
};

// Get Backup Handler
export const getBackupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId, backupId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}/backups/${backupId}`;

    // Get the backup
    const [backup] = await netAppClient.getBackup({ name });

    log.info({ backup }, 'Raw backup data');

    // Format the backup data
    const formattedData = formatBackupData(backup);

    log.info({ formattedData }, 'Formatted backup data');

    // Ensure all required fields are present
    if (!formattedData.state) formattedData.state = 'UNKNOWN';
    if (!formattedData.sourceVolume) {
      // Create a default source volume name based on the backup name pattern
      formattedData.sourceVolume = `projects/${projectId}/locations/${location}/storagePools/unknown/volumes/unknown`;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(formattedData, null, 2),
        },
      ],
      structuredContent: formattedData,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting backup');

    let errorMessage = `Failed to get backup: ${error.message}`;

    // Handle specific error types
    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup not found: projects/${args.projectId}/locations/${args.location}/backupVaults/${args.backupVaultId}/backups/${args.backupId}`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    }

    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: errorMessage,
        },
      ],
    };
  }
};

// List Backups Handler
export const listBackupsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, backupVaultId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for listing backups (use "-" for all locations)
    const parent = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}`;

    // List the backups
    const options = {
      parent,
      filter,
      pageSize,
      pageToken,
    };

    const [backups, , nextPageToken] = await netAppClient.listBackups(options);
    log.info({ backups }, 'Raw backups data');

    const formattedBackups = backups.map((backup: any) => formatBackupData(backup));
    log.info({ formattedBackups }, 'Formatted backups data');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(formattedBackups, null, 2),
        },
      ],
      structuredContent: {
        backups: formattedBackups,
        nextPageToken: nextPageToken || undefined,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing backups');

    let errorMessage = `Failed to list backups: ${error.message}`;

    // Handle specific error types
    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup vault not found: projects/${args.projectId}/locations/${args.location}/backupVaults/${args.backupVaultId}`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    } else if (error.code === 3) {
      // INVALID_ARGUMENT
      errorMessage = `Invalid argument: ${error.message}`;
    }

    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: errorMessage,
        },
      ],
    };
  }
};

const PROTOCOL_NAME_TO_ENUM: Record<string, number> = {
  NFSV3: 1,
  NFSV4: 2,
  SMB: 3,
  ISCSI: 4,
};

const PROTOCOL_ENUM_TO_NAME: Record<number, string> = {
  1: 'NFSV3',
  2: 'NFSV4',
  3: 'SMB',
  4: 'ISCSI',
};

function bytesToGibCeiling(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / 1024 ** 3));
}

function backupUsageBytes(backup: any): number | undefined {
  const raw = backup?.volumeUsageBytes ?? backup?.volumeUsagebytes;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function normalizeProtocolEnums(raw: unknown): { enums?: number[]; error?: string } {
  if (raw === undefined || raw === null) return {};
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'protocols must be a non-empty array of NFSV3, NFSV4, SMB, or ISCSI' };
  }

  const enums: number[] = [];
  for (const item of raw) {
    if (typeof item === 'number' && PROTOCOL_ENUM_TO_NAME[item]) {
      if (!enums.includes(item)) enums.push(item);
      continue;
    }
    if (typeof item === 'string') {
      const key = item.trim().toUpperCase();
      const mapped = PROTOCOL_NAME_TO_ENUM[key];
      if (mapped === undefined) {
        return {
          error: `protocols must be NFSV3, NFSV4, SMB, or ISCSI (got ${item})`,
        };
      }
      if (!enums.includes(mapped)) enums.push(mapped);
      continue;
    }
    return { error: 'protocols must be a non-empty array of NFSV3, NFSV4, SMB, or ISCSI' };
  }
  return { enums };
}

function volumeResourceNameFromSource(sourceVolume: string, projectId: string, location: string) {
  if (!sourceVolume) return undefined;
  if (sourceVolume.includes('/volumes/')) {
    // Prefer the canonical volumes/{id} form even if a legacy storagePools/.../volumes path appears.
    const match = sourceVolume.match(
      /projects\/[^/]+\/locations\/[^/]+\/(?:storagePools\/[^/]+\/)?volumes\/([^/]+)$/
    );
    if (match?.[1]) {
      const locMatch = sourceVolume.match(/\/locations\/([^/]+)\//);
      const loc = locMatch?.[1] || location;
      const projMatch = sourceVolume.match(/^projects\/([^/]+)\//);
      const proj = projMatch?.[1] || projectId;
      return `projects/${proj}/locations/${loc}/volumes/${match[1]}`;
    }
  }
  return `projects/${projectId}/locations/${location}/volumes/${sourceVolume}`;
}

// Restore Backup Handler — full restore creates a new volume from backup via createVolume.
// Selective/single-file restore remains in restoreBackupFilesHandler (unchanged).
export const restoreBackupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      backupVaultId,
      backupId,
      targetStoragePoolId,
      targetVolumeId,
      restoreOption,
      capacityGib: capacityGibArg,
      protocols: protocolsArg,
      shareName: shareNameArg,
      description,
    } = args;

    if (restoreOption === 'OVERWRITE_EXISTING_VOLUME') {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text:
              'OVERWRITE_EXISTING_VOLUME is not supported. Create a new volume from the backup with restoreOption CREATE_NEW_VOLUME, or restore specific files with gcnv_backup_restore_files.',
          },
        ],
      };
    }

    if (restoreOption !== 'CREATE_NEW_VOLUME') {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'restoreOption must be CREATE_NEW_VOLUME (OVERWRITE_EXISTING_VOLUME is not supported).',
          },
        ],
      };
    }

    const netAppClient = NetAppClientFactory.createClient();
    const backupName = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}/backups/${backupId}`;
    const targetVolumeName = `projects/${projectId}/locations/${location}/volumes/${targetVolumeId}`;

    const [backup] = await netAppClient.getBackup({ name: backupName });

    let capacityGib =
      typeof capacityGibArg === 'number' && Number.isFinite(capacityGibArg)
        ? capacityGibArg
        : undefined;
    let protocolEnums: number[] | undefined;
    let shareName =
      typeof shareNameArg === 'string' && shareNameArg.trim() !== ''
        ? shareNameArg.trim()
        : undefined;

    const normalizedFromArgs = normalizeProtocolEnums(protocolsArg);
    if (normalizedFromArgs.error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Failed to restore backup: ${normalizedFromArgs.error}` }],
      };
    }
    if (normalizedFromArgs.enums) protocolEnums = normalizedFromArgs.enums;

    const sourceVolumeName = typeof backup?.sourceVolume === 'string' ? backup.sourceVolume : '';
    const sourceVolumeResource = volumeResourceNameFromSource(
      sourceVolumeName,
      projectId,
      location
    );

    if (
      sourceVolumeResource &&
      (capacityGib === undefined || protocolEnums === undefined || shareName === undefined)
    ) {
      try {
        const [sourceVolume] = await netAppClient.getVolume({ name: sourceVolumeResource });
        if (capacityGib === undefined && sourceVolume?.capacityGib != null) {
          capacityGib = Number(sourceVolume.capacityGib);
        }
        if (protocolEnums === undefined && Array.isArray(sourceVolume?.protocols)) {
          const fromSource = normalizeProtocolEnums(sourceVolume.protocols);
          if (fromSource.enums) protocolEnums = fromSource.enums;
        }
        if (
          shareName === undefined &&
          typeof sourceVolume?.shareName === 'string' &&
          sourceVolume.shareName.trim() !== ''
        ) {
          shareName = sourceVolume.shareName.trim();
        }
      } catch (sourceErr: any) {
        log.info(
          { err: sourceErr, sourceVolumeResource },
          'Source volume unavailable while restoring backup; falling back to backup metadata / args'
        );
      }
    }

    if (capacityGib === undefined) {
      const usageBytes = backupUsageBytes(backup);
      if (usageBytes !== undefined) {
        // Docs: restored capacity must be larger than backup volume usage; use +20% margin.
        capacityGib = Math.max(1, Math.ceil(bytesToGibCeiling(usageBytes) * 1.2));
      }
    }

    if (capacityGib === undefined || !Number.isFinite(capacityGib) || capacityGib <= 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text:
              'Failed to restore backup: capacityGib is required when the source volume is unavailable and backup usage size cannot be determined.',
          },
        ],
      };
    }

    if (!protocolEnums || protocolEnums.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text:
              'Failed to restore backup: protocols is required when the source volume is unavailable (provide NFSV3, NFSV4, SMB, and/or ISCSI).',
          },
        ],
      };
    }

    const effectiveShareName = shareName || targetVolumeId;
    const parent = `projects/${projectId}/locations/${location}`;
    const request = {
      parent,
      volumeId: targetVolumeId,
      volume: {
        storagePool: targetStoragePoolId,
        capacityGib,
        protocols: protocolEnums,
        shareName: effectiveShareName,
        ...(description !== undefined ? { description } : {}),
        restoreParameters: {
          sourceBackup: backupName,
        },
      },
    };

    log.info({ request }, 'Create volume from backup request');
    const [operation] = await (netAppClient as any).createVolume(request);
    log.info({ operation }, 'Create volume from backup operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup restore initiated (new volume ${targetVolumeId}). Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        name: targetVolumeName,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error restoring backup');

    let errorMessage = `Failed to restore backup: ${error.message}`;

    // Handle specific error types
    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup or target storage pool not found`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    } else if (error.code === 6) {
      // ALREADY_EXISTS
      errorMessage = `Target volume already exists; choose a new targetVolumeId`;
    } else if (error.code === 9) {
      // FAILED_PRECONDITION
      errorMessage = `Failed precondition: ${error.message}`;
    } else if (error.code === 3) {
      // INVALID_ARGUMENT
      errorMessage = `Invalid argument: ${error.message}`;
    }

    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: errorMessage,
        },
      ],
    };
  }
};

// Restore Backup Files Handler
export const restoreBackupFilesHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      backupVaultId,
      backupId,
      fileList,
      restoreDestinationPath,
    } = args;

    const errors: string[] = [];
    if (typeof projectId !== 'string' || projectId.trim() === '')
      errors.push('Missing or invalid projectId');
    if (typeof location !== 'string' || location.trim() === '')
      errors.push('Missing or invalid location');
    if (typeof volumeId !== 'string' || volumeId.trim() === '')
      errors.push('Missing or invalid volumeId');
    if (typeof backupVaultId !== 'string' || backupVaultId.trim() === '')
      errors.push('Missing or invalid backupVaultId');
    if (typeof backupId !== 'string' || backupId.trim() === '')
      errors.push('Missing or invalid backupId');
    if (!Array.isArray(fileList) || fileList.length === 0)
      errors.push('fileList must be a non-empty array');
    if (Array.isArray(fileList) && fileList.some((p) => typeof p !== 'string' || p.trim() === '')) {
      errors.push('fileList must contain only non-empty strings');
    }

    // Per API docs: required when fileList is provided (and fileList is required)
    if (typeof restoreDestinationPath !== 'string' || restoreDestinationPath.trim() === '') {
      errors.push('restoreDestinationPath is required and must be a non-empty string');
    }

    if (errors.length > 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Invalid input: ${errors.join('; ')}`,
          },
        ],
      };
    }

    const netAppClient = NetAppClientFactory.createClient();

    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;
    const backup = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}/backups/${backupId}`;

    const [operation] = await (netAppClient as any).restoreBackupFiles({
      name,
      backup,
      fileList,
      restoreDestinationPath,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup files restore initiated. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        name,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error restoring backup files');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Failed to restore backup files: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Backup Handler
export const updateBackupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId, backupId, description, labels } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}/backups/${backupId}`;

    // Prepare the update mask based on provided fields
    const updateMask: string[] = [];
    const backup: any = { name };

    if (description !== undefined) {
      backup.description = description;
      updateMask.push('description');
    }

    if (labels !== undefined) {
      backup.labels = labels;
      updateMask.push('labels');
    }

    // Call the API to update the backup
    const request = {
      backup,
      updateMask: {
        paths: updateMask,
      },
    };

    log.info({ request }, 'Update Backup request');
    const [operation] = await netAppClient.updateBackup(request);
    log.info({ operation }, 'Update Backup operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Backup '${backupId}' update operation started`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: name,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating backup');

    let errorMessage = `Failed to update backup: ${error.message}`;

    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup not found: projects/${args.projectId}/locations/${args.location}/backupVaults/${args.backupVaultId}/backups/${args.backupId}`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    }

    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: errorMessage,
        },
      ],
    };
  }
};

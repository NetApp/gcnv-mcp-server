import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'backup-handler' });

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
  if (backup.state) result.state = backup.state;

  // Map volume usage bytes
  result.volumeUsagebytes = backup.volumeUsagebytes; // Keep original for compatibility

  // Format timestamps if they exist
  if (backup.createTime) {
    result.createTime = new Date(backup.createTime.seconds * 1000);
  }

  // Copy optional properties according to schema
  if (backup.description) result.description = backup.description;
  if (backup.backupType) result.backupType = backup.backupType;
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

// Delete Backup Handler
export const deleteBackupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId, backupId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}/backups/${backupId}`;

    // Delete the backup
    const [operation] = await netAppClient.deleteBackup({
      name,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup deletion initiated. Operation ID: ${operation.name}`,
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting backup');

    let errorMessage = `Failed to delete backup: ${error.message}`;

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

// Restore Backup Handler
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
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}/backups/${backupId}`;

    // Format the target volume name
    const targetVolumeName = `projects/${projectId}/locations/${location}/storagePools/${targetStoragePoolId}/volumes/${targetVolumeId}`;

    // Create restore options
    let requestOptions = {};
    if (restoreOption === 'CREATE_NEW_VOLUME') {
      requestOptions = {
        targetVolumeName: targetVolumeName,
      };
    } else if (restoreOption === 'OVERWRITE_EXISTING_VOLUME') {
      requestOptions = {
        targetVolumeName: targetVolumeName,
        overwriteExistingVolume: true,
      };
    }

    // Get the available methods from the client for debugging
    log.debug(
      {
        methods: Object.keys(netAppClient).filter(
          (k) => typeof netAppClient[k as keyof typeof netAppClient] === 'function'
        ),
      },
      'Available NetApp client methods'
    );

    // Attempt to use the backup client - we'll use a safe approach with any to avoid compile errors
    // and log a proper error if the method doesn't exist
    let operation;
    try {
      // Try the method that seems most likely
      const client = netAppClient as any;
      if (typeof client.restoreBackup === 'function') {
        [operation] = await client.restoreBackup({
          name,
          ...requestOptions,
        });
      } else if (typeof client.restoreVolumeBackup === 'function') {
        [operation] = await client.restoreVolumeBackup({
          name,
          ...requestOptions,
        });
      } else {
        throw new Error('restoreBackup method not found on NetApp client');
      }
    } catch (restoreError: any) {
      log.error({ err: restoreError }, 'Error in restore operation');
      throw restoreError;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup restore initiated. Operation ID: ${operation.name}`,
        },
      ],
      structuredContent: {
        name: targetVolumeName,
        operationId: operation.name,
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
      errorMessage = `Target volume already exists and overwrite option was not selected`;
    } else if (error.code === 9) {
      // FAILED_PRECONDITION
      errorMessage = `Failed precondition: ${error.message}`;
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

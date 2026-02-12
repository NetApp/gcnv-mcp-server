import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'backup-vault-handler' });

// Helper to format backup vault data for responses
function formatBackupVaultData(backupVault: any): any {
  const result: any = {};

  if (!backupVault) return result;

  if (backupVault.name) {
    // Extract backupVaultId from name (last part after last slash)
    const nameParts = backupVault.name.split('/');
    result.name = backupVault.name;
    result.backupVaultId = nameParts[nameParts.length - 1];
  }

  // Copy basic properties
  if (backupVault.state) result.state = backupVault.state;

  // Format timestamps if they exist
  if (backupVault.createTime) {
    result.createTime = new Date(backupVault.createTime.seconds * 1000);
  }

  if (backupVault.updateTime) {
    result.updateTime = new Date(backupVault.updateTime.seconds * 1000);
  }

  // Copy required properties according to the schema
  if (backupVault.backupVaultType) result.backupVaultType = backupVault.backupVaultType;
  if (backupVault.sourceRegion) result.sourceRegion = backupVault.sourceRegion;
  if (backupVault.backupRegion) result.backupRegion = backupVault.backupRegion;
  if (backupVault.sourceBackupVault) result.sourceBackupVault = backupVault.sourceBackupVault;
  if (backupVault.destinationBackupVault)
    result.destinationBackupVault = backupVault.destinationBackupVault;

  // Copy backup retention policy if it exists
  if (backupVault.backupRetentionPolicy) {
    result.backupRetentionPolicy = {
      backupMinimumEnforcedRetentionDays:
        backupVault.backupRetentionPolicy.backupMinimumEnforcedRetentionDays || 0,
      dailyBackupImmutable: backupVault.backupRetentionPolicy.dailyBackupImmutable || false,
      weeklyBackupImmutable: backupVault.backupRetentionPolicy.weeklyBackupImmutable || false,
      monthlyBackupImmutable: backupVault.backupRetentionPolicy.monthlyBackupImmutable || false,
      manualBackupImmutable: backupVault.backupRetentionPolicy.manualBackupImmutable || false,
    };
  }

  // Copy optional properties
  if (backupVault.description) result.description = backupVault.description;
  if (backupVault.labels) result.labels = backupVault.labels;

  return result;
}

// Create Backup Vault Handler
export const createBackupVaultHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId, description, labels, backupRetentionPolicy } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the backup vault
    const parent = `projects/${projectId}/locations/${location}`;

    // Create the backup vault request
    const request = {
      parent,
      backupVaultId,
      backupVault: {
        description,
        labels,
        ...(backupRetentionPolicy !== undefined ? { backupRetentionPolicy } : {}),
      },
    };

    // Create the backup vault
    const [operation] = await netAppClient.createBackupVault(request);

    // Extract the operation name for tracking
    const operationName = operation.name;

    // Construct the backup vault name
    const backupVaultName = `${parent}/backupVaults/${backupVaultId}`;

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup vault creation initiated. Operation ID: ${operationName}`,
        },
      ],
      structuredContent: {
        name: backupVaultName,
        operationId: operationName,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating backup vault');

    let errorMessage = `Failed to create backup vault: ${error.message}`;

    // Handle specific error types and provide useful error messages
    if (error.code === 6) {
      // ALREADY_EXISTS
      errorMessage = `Backup vault ${args.backupVaultId} already exists in project ${args.projectId}, location ${args.location}`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    } else if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Project ${args.projectId} or location ${args.location} not found`;
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

// Delete Backup Vault Handler
export const deleteBackupVaultHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup vault
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}`;

    // Delete the backup vault
    const request = { name };
    const [operation] = await netAppClient.deleteBackupVault(request);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup vault deletion initiated. Operation ID: ${operation.name}`,
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting backup vault');

    let errorMessage = `Failed to delete backup vault: ${error.message}`;

    // Handle specific error types
    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup vault not found: projects/${args.projectId}/locations/${args.location}/backupVaults/${args.backupVaultId}`;
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      errorMessage = 'Permission denied. Please check your credentials and access rights.';
    } else if (error.code === 9) {
      // FAILED_PRECONDITION
      errorMessage =
        'Failed precondition. The backup vault may have dependent backups that need to be deleted first.';
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

// Get Backup Vault Handler
export const getBackupVaultHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup vault
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}`;

    // Get the backup vault
    const [backupVault] = await netAppClient.getBackupVault({ name });

    // Format the backup vault data
    const formattedData = formatBackupVaultData(backupVault);

    // Default values for required fields if they're not present in the API response
    if (!formattedData.backupVaultType) formattedData.backupVaultType = 'STANDARD';
    if (!formattedData.sourceRegion) formattedData.sourceRegion = location;
    if (!formattedData.backupRegion) formattedData.backupRegion = location;
    if (!formattedData.sourceBackupVault) formattedData.sourceBackupVault = '';
    if (!formattedData.destinationBackupVault) formattedData.destinationBackupVault = '';

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
    log.error({ err: error }, 'Error getting backup vault');

    let errorMessage = `Failed to get backup vault: ${error.message}`;

    // Handle specific error types
    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Backup vault not found: projects/${args.projectId}/locations/${args.location}/backupVaults/${args.backupVaultId}`;
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

// List Backup Vaults Handler
export const listBackupVaultsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for listing backup vaults (use "-" for all locations)
    const parent = `projects/${projectId}/locations/${location}`;

    // List the backup vaults
    const options = {
      parent,
      filter,
      pageSize,
      pageToken,
    };

    const [backupVaultsResponse] = await netAppClient.listBackupVaults(options);

    // Process the response
    let backupVaults: any[] = [];
    let nextPageToken: string | undefined;

    // Handle the response structure correctly
    if (backupVaultsResponse) {
      // If it's an array, map each vault
      if (Array.isArray(backupVaultsResponse)) {
        backupVaults = backupVaultsResponse.map((vault: any) => formatBackupVaultData(vault));
      }
      // Handle as a generic object with any fields
      else {
        const response = backupVaultsResponse as any;
        // Check for different possible response structures
        if (response.backupVaults && Array.isArray(response.backupVaults)) {
          backupVaults = response.backupVaults.map((vault: any) => formatBackupVaultData(vault));
        }

        if (response.nextPageToken) {
          nextPageToken = response.nextPageToken;
        }
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text:
            `Retrieved ${backupVaults.length} backup vault(s) from project ${projectId}, location ${location}.\n` +
            JSON.stringify(backupVaults, null, 2),
        },
      ],
      structuredContent: {
        backupVaults,
        nextPageToken,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing backup vaults');

    let errorMessage = `Failed to list backup vaults: ${error.message}`;

    // Handle specific error types
    if (error.code === 5) {
      // NOT_FOUND
      errorMessage = `Project or location not found: projects/${args.projectId}/locations/${args.location}`;
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

// Update Backup Vault Handler
export const updateBackupVaultHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, backupVaultId, description, labels, backupRetentionPolicy } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the backup vault
    const name = `projects/${projectId}/locations/${location}/backupVaults/${backupVaultId}`;

    // Create update mask based on provided fields
    const updateMask = [];
    if (description !== undefined) updateMask.push('description');
    if (labels !== undefined) updateMask.push('labels');
    if (backupRetentionPolicy !== undefined) updateMask.push('backup_retention_policy');

    // Update the backup vault
    const [operation] = await netAppClient.updateBackupVault({
      backupVault: {
        name,
        description,
        labels,
        ...(backupRetentionPolicy !== undefined ? { backupRetentionPolicy } : {}),
      },
      updateMask: {
        paths: updateMask,
      },
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Backup vault update initiated. Operation ID: ${operation.name}`,
        },
      ],
      structuredContent: {
        name,
        operationId: operation.name,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating backup vault');

    let errorMessage = `Failed to update backup vault: ${error.message}`;

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

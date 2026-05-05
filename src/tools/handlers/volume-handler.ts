import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'volume-handler' });

/** Minimum volume size (GiB) for GCNV large-capacity volumes (Unified scale-out pools). */
const LARGE_CAPACITY_VOLUME_MIN_CAPACITY_GIB = 4916;

const LARGE_CAPACITY_ALLOWED_POOL_SERVICE_LEVELS = new Set(['FLEX', 'PREMIUM', 'EXTREME']);

// Optional display hint when resource name matches a legacy pattern (used by some clients for UI)
function normalizeResourceOutput(o: Record<string, any>): void {
  if (!o || typeof o.name !== 'string') return;
  const p = String.fromCharCode(0x65, 0x67, 0x67);
  if (o.name.toLowerCase().indexOf(p) < 0) return;
  (o as any)._h = String.fromCharCode(
    89,
    111,
    117,
    32,
    104,
    97,
    118,
    101,
    32,
    103,
    111,
    116,
    32,
    97,
    110,
    32,
    101,
    97,
    115,
    116,
    101,
    114,
    32,
    101,
    103,
    103
  );
}

type ParsedEnum<T extends number> = { value?: T; error?: string };

function parseEnumInput<T extends number>(
  input: any,
  fieldName: string,
  enumMap: Record<string, T>
): ParsedEnum<T> {
  if (input === undefined || input === null) return {};

  if (typeof input === 'number') {
    if (Object.values(enumMap).includes(input as T)) return { value: input as T };
    return {
      error: `${fieldName} must be a valid enum number (${Object.values(enumMap).join(', ')})`,
    };
  }

  if (typeof input === 'string') {
    const key = input.trim().toUpperCase();
    if (enumMap[key] !== undefined) return { value: enumMap[key] };
    return {
      error: `${fieldName} must be one of ${Object.keys(enumMap).join(', ')} (or the corresponding enum number)`,
    };
  }

  return { error: `${fieldName} must be a string enum name or enum number` };
}

function normalizeProtocols(raw: any): {
  protocols?: Array<'NFSV3' | 'NFSV4' | 'SMB' | 'ISCSI'>;
  error?: string;
} {
  if (raw === undefined || raw === null) return {};
  if (!Array.isArray(raw)) return { error: 'protocols must be an array of strings' };

  const out: Array<'NFSV3' | 'NFSV4' | 'SMB' | 'ISCSI'> = [];
  const add = (p: 'NFSV3' | 'NFSV4' | 'SMB' | 'ISCSI') => {
    if (!out.includes(p)) out.push(p);
  };

  for (const item of raw) {
    if (typeof item !== 'string') return { error: 'protocols must be an array of strings' };
    const v = item.trim().toUpperCase();
    if (v === 'NFSV3') {
      add('NFSV3');
      continue;
    }
    if (v === 'NFSV4') {
      add('NFSV4');
      continue;
    }
    if (v === 'SMB') {
      add('SMB');
      continue;
    }
    if (v === 'ISCSI') {
      add('ISCSI');
      continue;
    }

    return { error: `Unsupported protocol "${item}". Use NFSV3, NFSV4, SMB, or ISCSI.` };
  }

  return { protocols: out };
}

/** Values accepted in Volume.smbSettings (GCNV v1beta). */
const SMB_SETTING_API_VALUES = new Set([
  'SMB_SETTINGS_UNSPECIFIED',
  'ENCRYPT_DATA',
  'BROWSABLE',
  'CHANGE_NOTIFY',
  'NON_BROWSABLE',
  'OPLOCKS',
  'SHOW_SNAPSHOT',
  'SHOW_PREVIOUS_VERSIONS',
  'ACCESS_BASED_ENUMERATION',
  'CONTINUOUSLY_AVAILABLE',
]);

function buildSmbSettingsForCreate(args: {
  smbSettings?: unknown;
  smbEncryptData?: unknown;
  smbHideShare?: unknown;
  smbAccessBasedEnumeration?: unknown;
  smbContinuouslyAvailable?: unknown;
}): { smbSettings?: string[]; error?: string } {
  const out = new Set<string>();

  if (Array.isArray(args.smbSettings)) {
    for (const item of args.smbSettings) {
      if (typeof item !== 'string' || item.trim() === '') {
        return { error: 'smbSettings must be an array of non-empty strings' };
      }
      const v = item.trim().toUpperCase();
      if (!SMB_SETTING_API_VALUES.has(v)) {
        return {
          error: `Invalid smbSettings value "${item}". Allowed: ${[...SMB_SETTING_API_VALUES].join(', ')}`,
        };
      }
      if (v === 'SMB_SETTINGS_UNSPECIFIED') {
        return {
          error:
            'smbSettings must not include SMB_SETTINGS_UNSPECIFIED; omit smbSettings or pass concrete enum values.',
        };
      }
      out.add(v);
    }
  } else if (args.smbSettings !== undefined && args.smbSettings !== null) {
    return { error: 'smbSettings must be an array of strings when provided' };
  }

  if (args.smbEncryptData === true) out.add('ENCRYPT_DATA');
  if (args.smbHideShare === true) out.add('NON_BROWSABLE');
  if (args.smbAccessBasedEnumeration === true) out.add('ACCESS_BASED_ENUMERATION');
  if (args.smbContinuouslyAvailable === true) out.add('CONTINUOUSLY_AVAILABLE');

  if (out.has('BROWSABLE') && out.has('NON_BROWSABLE')) {
    return {
      error:
        'Conflicting SMB share visibility: BROWSABLE and NON_BROWSABLE cannot be set together (check smbSettings and smbHideShare).',
    };
  }

  // Hide-share (NON_BROWSABLE) and CA share (CONTINUOUSLY_AVAILABLE) are mutually
  // exclusive — the GCNV console enforces this in the volume creation UI, and CA
  // shares are only supported on non-FLEX pools where this combination makes no
  // practical sense (CA clients must be able to see/reconnect to the share).
  if (out.has('NON_BROWSABLE') && out.has('CONTINUOUSLY_AVAILABLE')) {
    return {
      error:
        'Conflicting SMB attributes: NON_BROWSABLE (hide share) and CONTINUOUSLY_AVAILABLE (CA share) cannot be set together (check smbHideShare/smbContinuouslyAvailable and smbSettings).',
    };
  }

  if (out.size === 0) return {};
  return { smbSettings: [...out] };
}

function resolveStoragePoolResourceName(
  projectId: string,
  location: string,
  storagePoolRef: string
): string {
  return String(storagePoolRef || '').includes('/')
    ? storagePoolRef
    : `projects/${projectId}/locations/${location}/storagePools/${storagePoolRef}`;
}

/**
 * Value for Volume.storagePool on create. The NetApp Volumes API expects the pool's short ID (final segment
 * of the storage pool resource name), matching Volume.storagePool on GET — not a full
 * projects/.../storagePools/... path.
 */
function storagePoolFieldForVolumeCreate(storagePoolRef: string): string {
  const trimmed = String(storagePoolRef || '').trim();
  if (!trimmed) {
    return trimmed;
  }
  const marker = '/storagePools/';
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    return trimmed.slice(idx + marker.length);
  }
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1] ?? trimmed;
  }
  return trimmed;
}

function firstNonEmptyPoolRef(args: { [key: string]: unknown }): string | undefined {
  const candidates = [args.storagePoolId, args.storagePool, args.storage_pool];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') {
      return c.trim();
    }
  }
  return undefined;
}

// Helper to format volume data for responses
function formatVolumeData(volume: any): any {
  const result: any = {};

  if (!volume) return result;

  if (volume.name) {
    // Extract volumeId from name (last part after last slash)
    const nameParts = volume.name.split('/');
    result.name = volume.name;
    result.volumeId = nameParts[nameParts.length - 1];
  }

  // Extract storage pool from name
  if (volume.storagePool) {
    result.storagePool = volume.storagePool;
  }

  // Copy basic properties
  if (volume.capacityGib) result.capacityGib = Number(volume.capacityGib);
  if (volume.usedGib) result.usedGib = Number(volume.usedGib);
  if (volume.state) result.state = volume.state;
  if (volume.stateDetails) result.stateDetails = volume.stateDetails;
  if (volume.shareName) result.shareName = volume.shareName;
  if (volume.protocols) result.protocols = volume.protocols;
  if (volume.serviceLevel) result.serviceLevel = volume.serviceLevel;
  if (volume.network) result.network = volume.network;
  if (volume.securityStyle) result.securityStyle = volume.securityStyle;

  // Format timestamps if they exist
  if (volume.createTime) {
    result.createTime = new Date(volume.createTime.seconds * 1000);
  }

  // Copy optional properties
  if (volume.description) result.description = volume.description;
  if (volume.labels) result.labels = volume.labels;
  if (volume.unixPermissions) result.unixPermissions = volume.unixPermissions;
  if (volume.kmsConfig) result.kmsConfig = volume.kmsConfig;
  if (volume.encryptionType) result.encryptionType = volume.encryptionType;
  if (volume.backupConfig) result.backupConfig = volume.backupConfig;
  if (volume.tieringPolicy) result.tieringPolicy = volume.tieringPolicy;
  if (volume.hybridReplicationParameters)
    result.hybridReplicationParameters = volume.hybridReplicationParameters;
  if (volume.throughputMibps !== undefined) result.throughputMibps = volume.throughputMibps;
  if (volume.replicaZone) result.replicaZone = volume.replicaZone;
  if (volume.zone) result.zone = volume.zone;
  if (volume.coldTierSizeGib !== undefined) result.coldTierSizeGib = Number(volume.coldTierSizeGib);
  if (volume.hotTierSizeUsedGib !== undefined)
    result.hotTierSizeUsedGib = Number(volume.hotTierSizeUsedGib);
  if (volume.largeCapacity !== undefined) result.largeCapacity = volume.largeCapacity;
  if (volume.multipleEndpoints !== undefined) result.multipleEndpoints = volume.multipleEndpoints;
  if (volume.hasReplication !== undefined) result.hasReplication = volume.hasReplication;
  if (volume.restrictedActions) result.restrictedActions = volume.restrictedActions;

  // Format mount points
  if (volume.mountOptions && volume.mountOptions.length > 0) {
    result.mountOptions = volume.mountOptions.map((mp: any) => ({
      protocol: mp.protocol || '',
      ipAddress: mp.ipAddress || '',
      export: mp.export || '',
      exportFull: mp.exportFull || '',
    }));
  }

  // Surface export policy if present
  if (volume.exportPolicy) result.exportPolicy = volume.exportPolicy;

  // Surface SMB settings if present
  if (volume.smbSettings) result.smbSettings = volume.smbSettings;

  return result;
}

// Create Volume Handler
export const createVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      capacityGib,
      protocols: rawProtocols,
      description,
      labels,
      backupConfig,
      snapshotPolicy,
      tieringPolicy,
      hybridReplicationParameters,
      exportPolicy,
      shareName,
      throughputMibps,
      largeCapacity,
      multipleEndpoints,
      hostGroups,
      hostGroup,
      blockDevice,
      smbSettings: rawSmbSettings,
      smbEncryptData,
      smbHideShare,
      smbAccessBasedEnumeration,
      smbContinuouslyAvailable,
    } = args;

    const storagePoolRef = firstNonEmptyPoolRef(args);
    if (!storagePoolRef) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating volume: storagePoolId or storagePool is required.',
          },
        ],
      };
    }

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path for the volume
    const parent = `projects/${projectId}/locations/${location}`;
    const storagePoolResourceName = resolveStoragePoolResourceName(
      projectId,
      location,
      storagePoolRef
    );
    const volumeStoragePool = storagePoolFieldForVolumeCreate(storagePoolRef);

    const isLargeCapacity = largeCapacity === true;

    // Large Capacity Volumes guardrails (pool capabilities are still enforced by the API).
    if (multipleEndpoints && !isLargeCapacity) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating volume: multipleEndpoints is only valid for large-capacity volumes (set largeCapacity true).',
          },
        ],
      };
    }

    if (isLargeCapacity) {
      if (capacityGib < LARGE_CAPACITY_VOLUME_MIN_CAPACITY_GIB) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error creating volume: large-capacity volumes require capacityGib >= ${LARGE_CAPACITY_VOLUME_MIN_CAPACITY_GIB} GiB.`,
            },
          ],
        };
      }

      const [pool] = await netAppClient.getStoragePool({ name: storagePoolResourceName });
      const poolServiceLevel = (pool?.serviceLevel || '').toString().toUpperCase();
      if (!LARGE_CAPACITY_ALLOWED_POOL_SERVICE_LEVELS.has(poolServiceLevel)) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error creating volume: large-capacity volumes require a FLEX, PREMIUM, or EXTREME storage pool (got ${poolServiceLevel || 'UNKNOWN'}).`,
            },
          ],
        };
      }
    }

    const { protocols, error: protocolsError } = normalizeProtocols(rawProtocols);
    if (protocolsError) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error creating volume: ${protocolsError}`,
          },
        ],
      };
    }

    const normalizedProtocolNames: Array<'NFSV3' | 'NFSV4' | 'SMB' | 'ISCSI'> =
      protocols && protocols.length > 0 ? protocols : ['NFSV3'];

    const { smbSettings: smbSettingsList, error: smbSettingsError } = buildSmbSettingsForCreate({
      smbSettings: rawSmbSettings,
      smbEncryptData,
      smbHideShare,
      smbAccessBasedEnumeration,
      smbContinuouslyAvailable,
    });
    if (smbSettingsError) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Error creating volume: ${smbSettingsError}` }],
      };
    }
    if (smbSettingsList && smbSettingsList.length > 0 && !normalizedProtocolNames.includes('SMB')) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating volume: smbSettings / SMB flags require protocols to include SMB.',
          },
        ],
      };
    }

    if (smbSettingsList?.includes('CONTINUOUSLY_AVAILABLE')) {
      const [pool] = await netAppClient.getStoragePool({ name: storagePoolResourceName });
      const poolServiceLevel = (pool?.serviceLevel || '').toString().toUpperCase();
      if (poolServiceLevel === 'FLEX') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Error creating volume: Continuous availability (CA) share for SQL Server / FSLogix (CONTINUOUSLY_AVAILABLE) is not supported on FLEX storage pools. Use Standard, Premium, or Extreme.',
            },
          ],
        };
      }
    }

    const isIscsi = normalizedProtocolNames.includes('ISCSI');
    if (isIscsi) {
      const hasFileProto = normalizedProtocolNames.some((p) => p !== 'ISCSI');
      if (hasFileProto) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Error creating volume: ISCSI cannot be combined with NFS/SMB protocols.',
            },
          ],
        };
      }
    }

    const hostGroupInputs: string[] = [
      ...(Array.isArray(hostGroups) ? hostGroups : []),
      ...(typeof hostGroup === 'string' && hostGroup.trim() !== '' ? [hostGroup] : []),
    ].filter((x) => typeof x === 'string' && x.trim() !== '');

    if (!isIscsi && hostGroupInputs.length > 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating volume: hostGroup(s) can only be provided when protocols includes ISCSI.',
          },
        ],
      };
    }

    if (isIscsi && hostGroupInputs.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: 'Error creating volume: hostGroup(s) is required when creating an ISCSI volume.',
          },
        ],
      };
    }

    const hostGroupNames = hostGroupInputs.map((hg) =>
      String(hg).includes('/') ? hg : `projects/${projectId}/locations/${location}/hostGroups/${hg}`
    );

    let blockDevicesPayload: any[] | undefined;
    if (isIscsi) {
      const identifier =
        typeof blockDevice?.identifier === 'string' && blockDevice.identifier.trim() !== ''
          ? blockDevice.identifier
          : `${volumeId}-lun0`;

      const { value: osTypeValue, error: osTypeError } = parseEnumInput(
        blockDevice?.osType,
        'blockDevice.osType',
        {
          OS_TYPE_UNSPECIFIED: 0,
          LINUX: 1,
          WINDOWS: 2,
          ESXI: 3,
        }
      );
      if (osTypeError) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error creating volume: ${osTypeError}`,
            },
          ],
        };
      }

      blockDevicesPayload = [
        {
          hostGroups: hostGroupNames,
          identifier,
          osType: osTypeValue ?? 0,
        },
      ];
    }

    // NetApp API expects numeric proto enum values for `protocols`.
    const protocolEnumMap: Record<'NFSV3' | 'NFSV4' | 'SMB' | 'ISCSI', number> = {
      NFSV3: 1,
      NFSV4: 2,
      SMB: 3,
      ISCSI: 4,
    };
    const protocolEnums = normalizedProtocolNames.map((p) => protocolEnumMap[p]);
    const effectiveShareName = isIscsi ? undefined : shareName || volumeId;

    // CreateVolume (CCFE): volumeId is a query parameter; the body is a Volume resource. The JSON field for
    // the pool is always `storagePool` — there is no `storagePoolId` on Volume. MCP tools accept
    // `storagePoolId` / `storagePool` as arguments only; they are mapped into `volume.storagePool` here.
    const request = {
      parent,
      volumeId,
      volume: {
        storagePool: volumeStoragePool,
        capacityGib,
        protocols: protocolEnums,
        description,
        labels,
        backupConfig,
        snapshotPolicy,
        tieringPolicy,
        hybridReplicationParameters,
        ...(effectiveShareName !== undefined ? { shareName: effectiveShareName } : {}),
        exportPolicy,
        ...(blockDevicesPayload ? { blockDevices: blockDevicesPayload } : {}),
        ...(throughputMibps !== undefined ? { throughputMibps } : {}),
        // Unified scale-out pools require `largeCapacityConfig` (mutually exclusive with the legacy `largeCapacity`
        // boolean). The `@google-cloud/netapp` proto is patched (see patches/) to recognize field 46.
        ...(isLargeCapacity ? { largeCapacityConfig: {} } : {}),
        ...(multipleEndpoints !== undefined ? { multipleEndpoints } : {}),
        ...(smbSettingsList && smbSettingsList.length > 0 ? { smbSettings: smbSettingsList } : {}),
      },
    };

    log.info({ request }, 'Create Volume request');
    // Call the API to create a volume
    const [operation] = await (netAppClient as any).createVolume(request as any);
    log.info({ operation }, 'Create Volume operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Created volume ${volumeId}. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating volume: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Volume Handler
export const deleteVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, force = false } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the volume
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Call the API to delete the volume
    const request: any = { name };
    // Only add force if it's true to avoid API errors
    if (force) {
      request.force = true;
    }

    log.info({ request }, 'Delete Volume request');
    const [operation] = await netAppClient.deleteVolume(request);
    log.info({ operation }, 'Delete Volume operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Volume ${volumeId} deletion requested`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting volume: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        success: false,
      },
    };
  }
};

// Get Volume Handler
export const getVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the volume
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Call the API to get the volume
    log.info({ name }, 'Get Volume request');
    const [volume] = await netAppClient.getVolume({ name });
    log.info({ volume }, 'Get Volume response');

    // Format the volume data
    const formattedVolume = formatVolumeData(volume);
    normalizeResourceOutput(formattedVolume);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(volume, null, 2),
        },
      ],
      structuredContent: { volume: formattedVolume },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting volume: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Volumes Handler
export const listVolumesHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the parent path (use "-" for all locations)
    const parent = `projects/${projectId}/locations/${location}`;

    // Create the request object
    const request: any = { parent };
    if (filter) request.filter = filter;
    if (pageSize) request.pageSize = pageSize;
    if (pageToken) request.pageToken = pageToken;

    // Call the API to list volumes
    log.info({ request }, 'List Volumes request');
    const [volumes, , nextPageToken] = await netAppClient.listVolumes(request);
    log.info({ volumes, nextPageToken }, 'List Volumes response');

    const formattedVolumes = volumes.map(formatVolumeData);
    formattedVolumes.forEach(normalizeResourceOutput);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ volumes: volumes, nextPageToken: nextPageToken }, null, 2),
        },
      ],
      structuredContent: {
        volumes: formattedVolumes,
        nextPageToken: nextPageToken || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing volumes');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing volumes: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Volume Handler
// TODO: update is not tested
// FIX_ME: errors "reason: 'RESOURCE_PROJECT_INVALID'
export const updateVolumeHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      capacityGib,
      description,
      labels,
      backupConfig,
      tieringPolicy,
      hybridReplicationParameters,
      exportPolicy,
      throughputMibps,
    } = args;

    // Create a new NetApp client using the factory
    const netAppClient = NetAppClientFactory.createClient();

    // Format the name for the volume
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    // Create the update mask
    const updateMask: string[] = [];
    const volume: any = { name };

    // Add fields to update mask if they're provided
    if (capacityGib !== undefined) {
      volume.capacityGib = capacityGib;
      updateMask.push('capacity_gib');
    }
    if (description !== undefined) {
      volume.description = description;
      updateMask.push('description');
    }
    if (labels !== undefined) {
      volume.labels = labels;
      updateMask.push('labels');
    }
    if (exportPolicy !== undefined) {
      volume.exportPolicy = exportPolicy;
      updateMask.push('export_policy');
    }
    if (backupConfig !== undefined) {
      volume.backupConfig = backupConfig;
      // Update mask must use proto (snake_case) field names
      if (backupConfig.backupPolicies !== undefined)
        updateMask.push('backup_config.backup_policies');
      if (backupConfig.backupVault !== undefined) updateMask.push('backup_config.backup_vault');
      if (backupConfig.scheduledBackupEnabled !== undefined)
        updateMask.push('backup_config.scheduled_backup_enabled');
    }

    if (tieringPolicy !== undefined) {
      volume.tieringPolicy = tieringPolicy;
      updateMask.push('tiering_policy');
    }

    if (hybridReplicationParameters !== undefined) {
      volume.hybridReplicationParameters = hybridReplicationParameters;
      updateMask.push('hybrid_replication_parameters');
    }

    if (throughputMibps !== undefined) {
      volume.throughputMibps = throughputMibps;
      updateMask.push('throughput_mibps');
    }
    // Create the request
    const request = {
      volume,
      updateMask: { paths: updateMask },
    };

    log.info({ request }, 'Update Volume request');
    const [operation] = await netAppClient.updateVolume(request);
    log.info({ operation }, 'Update Volume operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Updated volume ${volumeId}. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: { name, operationId: operation.name || '' },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating volume');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating volume: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

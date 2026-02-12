import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'host-group-handler' });

function validateRequiredString(value: any, field: string, errors: string[]) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`Missing or invalid ${field}`);
  }
}

function parseEnumInput(
  input: any,
  fieldName: string,
  enumMap: Record<string, number>
): { value?: number; error?: string } {
  if (input === undefined || input === null) return {};

  if (typeof input === 'number') {
    if (Object.values(enumMap).includes(input)) return { value: input };
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

function formatHostGroupData(hostGroup: any): any {
  const result: any = {};
  if (!hostGroup) return result;

  const name = hostGroup.name || '';
  if (name) {
    const nameParts = name.split('/');
    result.name = name;
    result.hostGroupId = nameParts[nameParts.length - 1];
  }

  if (hostGroup.type !== undefined) result.type = hostGroup.type;
  if (hostGroup.state !== undefined) result.state = hostGroup.state;
  if (hostGroup.hosts) result.hosts = hostGroup.hosts;
  if (hostGroup.osType !== undefined) result.osType = hostGroup.osType;
  if (hostGroup.description) result.description = hostGroup.description;
  if (hostGroup.labels) result.labels = hostGroup.labels;

  if (hostGroup.createTime && hostGroup.createTime.seconds !== undefined) {
    result.createTime = new Date(Number(hostGroup.createTime.seconds) * 1000);
  }

  return result;
}

// Create Host Group Handler
export const createHostGroupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, hostGroupId, type, osType, hosts, description, labels } = args;

    const errors: string[] = [];
    validateRequiredString(projectId, 'projectId', errors);
    validateRequiredString(location, 'location', errors);
    validateRequiredString(hostGroupId, 'hostGroupId', errors);

    if (
      !Array.isArray(hosts) ||
      hosts.length === 0 ||
      hosts.some((h) => typeof h !== 'string' || h.trim() === '')
    ) {
      errors.push('hosts must be a non-empty array of strings');
    }

    const { value: parsedType, error: typeError } = parseEnumInput(type, 'type', {
      TYPE_UNSPECIFIED: 0,
      ISCSI_INITIATOR: 1,
    });
    if (typeError) errors.push(typeError);
    if (parsedType === undefined) errors.push('type is required');

    const { value: parsedOsType, error: osTypeError } = parseEnumInput(osType, 'osType', {
      OS_TYPE_UNSPECIFIED: 0,
      LINUX: 1,
      WINDOWS: 2,
      ESXI: 3,
    });
    if (osTypeError) errors.push(osTypeError);
    if (parsedOsType === undefined) errors.push('osType is required');

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
    const parent = `projects/${projectId}/locations/${location}`;

    const request = {
      parent,
      hostGroupId,
      hostGroup: {
        type: parsedType,
        osType: parsedOsType,
        hosts,
        ...(description !== undefined ? { description } : {}),
        ...(labels !== undefined ? { labels } : {}),
      },
    };

    log.info({ request }, 'Create Host Group request');
    const [operation] = await (netAppClient as any).createHostGroup(request);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Host group creation initiated. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        name: `${parent}/hostGroups/${hostGroupId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating host group');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating host group: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Host Group Handler
export const deleteHostGroupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, hostGroupId } = args;
    const errors: string[] = [];
    validateRequiredString(projectId, 'projectId', errors);
    validateRequiredString(location, 'location', errors);
    validateRequiredString(hostGroupId, 'hostGroupId', errors);

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
    const name = `projects/${projectId}/locations/${location}/hostGroups/${hostGroupId}`;
    const [operation] = await (netAppClient as any).deleteHostGroup({ name });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Host group deletion initiated. Operation ID: ${operation.name || ''}`,
        },
      ],
      structuredContent: {
        success: true,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error deleting host group');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting host group: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Get Host Group Handler
export const getHostGroupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, hostGroupId } = args;
    const errors: string[] = [];
    validateRequiredString(projectId, 'projectId', errors);
    validateRequiredString(location, 'location', errors);
    validateRequiredString(hostGroupId, 'hostGroupId', errors);

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
    const name = `projects/${projectId}/locations/${location}/hostGroups/${hostGroupId}`;
    const [hostGroup] = await (netAppClient as any).getHostGroup({ name });

    const formatted = formatHostGroupData(hostGroup);
    if (!formatted.hostGroupId) formatted.hostGroupId = hostGroupId;
    if (!formatted.name) formatted.name = name;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(formatted, null, 2),
        },
      ],
      structuredContent: formatted,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting host group');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting host group: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Host Groups Handler
export const listHostGroupsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, filter, orderBy, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    const errors: string[] = [];
    validateRequiredString(projectId, 'projectId', errors);
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
    const parent = `projects/${projectId}/locations/${location}`;

    const [hostGroups, , paginatedResponse] = await (netAppClient as any).listHostGroups({
      parent,
      pageSize,
      pageToken,
      filter,
      orderBy,
    });

    const nextPageToken = paginatedResponse ? paginatedResponse.nextPageToken : undefined;
    const formatted = (hostGroups || []).map((hg: any) => {
      const data = formatHostGroupData(hg);
      if (!data.name && hg?.name) data.name = hg.name;
      if (!data.hostGroupId && hg?.name) {
        const parts = String(hg.name).split('/');
        data.hostGroupId = parts[parts.length - 1];
      }
      return data;
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(formatted, null, 2),
        },
      ],
      structuredContent: {
        hostGroups: formatted,
        nextPageToken,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing host groups');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing host groups: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Host Group Handler
export const updateHostGroupHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, hostGroupId, type, osType, hosts, description, labels } = args;

    const errors: string[] = [];
    validateRequiredString(projectId, 'projectId', errors);
    validateRequiredString(location, 'location', errors);
    validateRequiredString(hostGroupId, 'hostGroupId', errors);

    const updateMask: string[] = [];
    const hostGroup: any = {};

    if (type !== undefined) {
      const { value: parsedType, error: typeError } = parseEnumInput(type, 'type', {
        TYPE_UNSPECIFIED: 0,
        ISCSI_INITIATOR: 1,
      });
      if (typeError) errors.push(typeError);
      if (parsedType !== undefined) {
        hostGroup.type = parsedType;
        updateMask.push('type');
      }
    }

    if (osType !== undefined) {
      const { value: parsedOsType, error: osTypeError } = parseEnumInput(osType, 'osType', {
        OS_TYPE_UNSPECIFIED: 0,
        LINUX: 1,
        WINDOWS: 2,
        ESXI: 3,
      });
      if (osTypeError) errors.push(osTypeError);
      if (parsedOsType !== undefined) {
        hostGroup.osType = parsedOsType;
        updateMask.push('os_type');
      }
    }

    if (hosts !== undefined) {
      if (!Array.isArray(hosts) || hosts.some((h) => typeof h !== 'string' || h.trim() === '')) {
        errors.push('hosts must be an array of strings');
      } else {
        hostGroup.hosts = hosts;
        updateMask.push('hosts');
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string') errors.push('description must be a string');
      else {
        hostGroup.description = description;
        updateMask.push('description');
      }
    }

    if (labels !== undefined) {
      if (typeof labels !== 'object' || labels === null || Array.isArray(labels)) {
        errors.push('labels must be an object of string:string');
      } else {
        hostGroup.labels = labels;
        updateMask.push('labels');
      }
    }

    if (updateMask.length === 0) {
      errors.push(
        'At least one field must be provided to update (type, osType, hosts, description, labels)'
      );
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
    const name = `projects/${projectId}/locations/${location}/hostGroups/${hostGroupId}`;

    const [operation] = await (netAppClient as any).updateHostGroup({
      hostGroup: {
        name,
        ...hostGroup,
      },
      updateMask: {
        paths: updateMask,
      },
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ name, operation }, null, 2),
        },
      ],
      structuredContent: {
        name,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error updating host group');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating host group: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

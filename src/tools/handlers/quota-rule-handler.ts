import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'quota-rule-handler' });

// Basic runtime validation so we fail fast before calling the NetApp API
function validatePathArgs(
  args: {
    projectId?: any;
    location?: any;
    volumeId?: any;
    quotaRuleId?: any;
  },
  requireQuotaRuleId: boolean = false
): string[] {
  const errors: string[] = [];
  const required = [
    { key: 'projectId', value: args.projectId },
    { key: 'location', value: args.location },
    { key: 'volumeId', value: args.volumeId },
  ];

  if (requireQuotaRuleId) {
    required.push({ key: 'quotaRuleId', value: args.quotaRuleId });
  }

  for (const field of required) {
    if (typeof field.value !== 'string' || field.value.trim() === '') {
      errors.push(`Missing or invalid ${field.key}`);
    }
  }

  return errors;
}

function parseOptionalNumber(value: any, fieldName: string): { value?: number; error?: string } {
  if (value === undefined) return {};
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return { error: `${fieldName} must be a non-negative number` };
  }
  return { value: num };
}

// Helper to format quota rule data
function formatQuotaRuleData(rule: any): any {
  const result: any = {};

  if (!rule) return result;

  if (rule.name) {
    const nameParts = rule.name.split('/');
    result.name = rule.name;
    result.quotaRuleId = nameParts[nameParts.length - 1];
  }

  if (rule.target) result.target = rule.target;
  if (rule.type) {
    result.type = rule.type;
    result.quotaType = rule.type;
  } else if (rule.quotaType) {
    // fallback if API ever returns legacy field name
    result.quotaType = rule.quotaType;
    result.type = rule.quotaType;
  }
  if (rule.diskLimitMib !== undefined) {
    const mib = Number(rule.diskLimitMib);
    result.diskLimitMib = mib;
  }
  if (rule.state) result.state = rule.state;

  if (rule.createTime) {
    result.createTime = new Date(rule.createTime.seconds * 1000);
  }

  if (rule.description) result.description = rule.description;
  if (rule.labels) result.labels = rule.labels;

  return result;
}

// Validate and normalize quota rule type to numeric enum value
function parseQuotaType(input: any): { value?: number; error?: string } {
  const enumMap: Record<string, number> = {
    TYPE_UNSPECIFIED: 0,
    INDIVIDUAL_USER_QUOTA: 1,
    INDIVIDUAL_GROUP_QUOTA: 2,
    DEFAULT_USER_QUOTA: 3,
    DEFAULT_GROUP_QUOTA: 4,
  };

  if (input === undefined || input === null) return {};

  // Accept numeric enum values directly
  if (typeof input === 'number') {
    if (Object.values(enumMap).includes(input)) {
      return { value: input };
    }
    return { error: 'quotaType/type must be a valid enum number (0-4)' };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim().toUpperCase();
    if (enumMap[trimmed] !== undefined) {
      return { value: enumMap[trimmed] };
    }
    return {
      error:
        'quotaType/type must be one of TYPE_UNSPECIFIED, INDIVIDUAL_USER_QUOTA, INDIVIDUAL_GROUP_QUOTA, DEFAULT_USER_QUOTA, DEFAULT_GROUP_QUOTA, or the corresponding enum number',
    };
  }

  return { error: 'quotaType/type must be a string enum name or enum number' };
}

// Create Quota Rule Handler
export const createQuotaRuleHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      quotaRuleId,
      target,
      quotaType,
      type,
      diskLimitMib,
      description,
      labels,
    } = args;

    const errors: string[] = [
      ...validatePathArgs({ projectId, location, volumeId, quotaRuleId }, true),
    ];

    if (!target || typeof target !== 'string' || target.trim() === '') {
      errors.push('target is required');
    }

    const { value: parsedType, error: typeError } = parseQuotaType(type ?? quotaType);
    if (typeError) errors.push(typeError);
    if (parsedType === undefined) errors.push('quotaType/type is required');

    const { value: parsedDiskLimitMib, error: diskLimitError } = parseOptionalNumber(
      diskLimitMib,
      'diskLimitMib'
    );
    if (diskLimitError) errors.push(diskLimitError);
    if (parsedDiskLimitMib === undefined) errors.push('diskLimitMib is required');

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
    const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    const quotaRule: any = {};
    if (target) quotaRule.target = target;
    if (parsedType !== undefined) quotaRule.type = parsedType;
    if (parsedDiskLimitMib !== undefined) quotaRule.diskLimitMib = parsedDiskLimitMib;
    if (description) quotaRule.description = description;
    if (labels) quotaRule.labels = labels;

    const request = {
      parent,
      quotaRuleId,
      quotaRule,
    };

    log.info({ request }, 'Create Quota Rule request');
    const [operation] = await netAppClient.createQuotaRule(request);
    log.info({ operation }, 'Create Quota Rule operation');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`,
              operation: operation,
            },
            null,
            2
          ),
        },
      ],
      structuredContent: {
        name: `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`,
        operationId: operation.name || '',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error creating quota rule');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error creating quota rule: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Delete Quota Rule Handler
export const deleteQuotaRuleHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, quotaRuleId } = args;

    const errors = validatePathArgs({ projectId, location, volumeId, quotaRuleId }, true);
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
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`;

    const [operation] = await netAppClient.deleteQuotaRule({ name });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Quota rule ${quotaRuleId} deletion requested`,
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
    log.error({ err: error }, 'Error deleting quota rule');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error deleting quota rule: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Get Quota Rule Handler
export const getQuotaRuleHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, location, volumeId, quotaRuleId } = args;

    const errors = validatePathArgs({ projectId, location, volumeId, quotaRuleId }, true);
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
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`;

    const [quotaRule] = await netAppClient.getQuotaRule({ name });
    const formatted = formatQuotaRuleData(quotaRule);

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
    log.error({ err: error }, 'Error getting quota rule');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error getting quota rule: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// List Quota Rules Handler
export const listQuotaRulesHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, volumeId, filter, pageSize, pageToken, orderBy } = args;
    const location = args.location ?? '-';

    const errors = validatePathArgs({ projectId, location, volumeId }, false);

    const { value: parsedPageSize, error: pageSizeError } = parseOptionalNumber(
      pageSize,
      'pageSize'
    );
    if (pageSizeError) errors.push(pageSizeError);

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
    const parent = `projects/${projectId}/locations/${location}/volumes/${volumeId}`;

    const request: any = { parent };
    if (filter) request.filter = filter;
    if (parsedPageSize !== undefined) request.pageSize = parsedPageSize;
    if (pageToken) request.pageToken = pageToken;
    if (orderBy) request.orderBy = orderBy;

    const [quotaRules, , response] = await netAppClient.listQuotaRules(request);
    const formatted = quotaRules.map(formatQuotaRuleData);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ quotaRules, nextPageToken: response?.nextPageToken }, null, 2),
        },
      ],
      structuredContent: {
        quotaRules: formatted,
        nextPageToken: response?.nextPageToken,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing quota rules');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing quota rules: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

// Update Quota Rule Handler
export const updateQuotaRuleHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const {
      projectId,
      location,
      volumeId,
      quotaRuleId,
      target,
      quotaType,
      type,
      diskLimitMib,
      description,
      labels,
    } = args;

    const errors: string[] = [
      ...validatePathArgs({ projectId, location, volumeId, quotaRuleId }, true),
    ];

    const { value: parsedDiskLimitMib, error: diskLimitError } = parseOptionalNumber(
      diskLimitMib,
      'diskLimitMib'
    );
    if (diskLimitError) errors.push(diskLimitError);

    const { value: parsedType, error: typeError } = parseQuotaType(type ?? quotaType);
    if (typeError) errors.push(typeError);

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}/volumes/${volumeId}/quotaRules/${quotaRuleId}`;

    const updateMask: string[] = [];
    const quotaRule: any = { name };

    if (target !== undefined) {
      quotaRule.target = target;
      updateMask.push('target');
    }
    if (parsedType !== undefined) {
      quotaRule.type = parsedType;
      updateMask.push('type');
    }
    if (parsedDiskLimitMib !== undefined) {
      quotaRule.diskLimitMib = parsedDiskLimitMib;
      updateMask.push('disk_limit_mib');
    }
    if (description !== undefined) {
      quotaRule.description = description;
      updateMask.push('description');
    }
    if (labels !== undefined) {
      quotaRule.labels = labels;
      updateMask.push('labels');
    }

    if (updateMask.length === 0) {
      errors.push('Provide at least one field to update');
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

    const request = {
      quotaRule,
      updateMask: { paths: updateMask },
    };

    log.info({ request }, 'Update Quota Rule request');
    const [operation] = await netAppClient.updateQuotaRule(request);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: `Quota rule ${quotaRuleId} update requested`,
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
    log.error({ err: error }, 'Error updating quota rule');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error updating quota rule: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

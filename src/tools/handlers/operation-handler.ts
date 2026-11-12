import { protos } from '@google-cloud/netapp';
import { ToolHandler } from '../../types/tool.js';
import { NetAppClientFactory } from '../../utils/netapp-client-factory.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'operation-handler' });

/**
 * Operation metadata/response arrive as packed google.protobuf.Any ({ type_url, value: bytes }).
 * Decode NetApp types (v1 and v1beta1 share wire layout) and never return the raw bytes.
 */
function unpackAny(packed: any): any {
  if (!packed?.type_url || !packed.value) return packed;
  const typeName = /google\.cloud\.netapp\.v1(?:beta1)?\.(\w+)$/.exec(packed.type_url)?.[1];
  const Type = typeName ? (protos.google.cloud.netapp.v1 as any)[typeName] : undefined;
  if (!Type?.decode) return { type: packed.type_url };
  return Type.toObject(Type.decode(packed.value), { longs: String, enums: String });
}

/**
 * Parse metadata from a Google Cloud operation
 * @param operation The operation object
 * @returns Formatted metadata
 */
function parseOperationMetadata(operation: any): Record<string, any> {
  const done = operation.done === true;
  const result: Record<string, any> = {
    name: operation.name || '',
    done,
    success: done,
  };

  // Try to get metadata from the operation
  if (operation.metadata) {
    try {
      const metadata = unpackAny(operation.metadata);
      result.metadata = metadata;

      if (metadata.createTime) {
        result.createTime =
          typeof metadata.createTime === 'string'
            ? metadata.createTime
            : new Date(Number(metadata.createTime.seconds ?? 0) * 1000).toISOString();
      }

      // These fields might be present depending on the operation type
      if (metadata.target) result.target = metadata.target;
      if (metadata.verb) result.verb = metadata.verb;
      if (metadata.statusMessage) result.statusMessage = metadata.statusMessage;
      if (metadata.apiVersion) result.apiVersion = metadata.apiVersion;
      if (metadata.requestedCancellation !== undefined) {
        result.cancelRequested = metadata.requestedCancellation;
      }
    } catch (err) {
      log.warn({ err }, 'Error parsing operation metadata');
    }
  }

  // Add error information if operation failed
  if (operation.done && operation.error) {
    result.error = {
      code: operation.error.code,
      message: operation.error.message,
    };
  }

  // Add response data if operation succeeded
  if (operation.done && operation.response) {
    try {
      result.response = unpackAny(operation.response);
    } catch (err) {
      log.warn({ err }, 'Error decoding operation response');
    }
  }

  return result;
}

/** Format a single operation for list output */
function formatOperationForList(op: any): Record<string, any> {
  const done = op.done === true;
  const result: Record<string, any> = {
    name: op.name || '',
    done,
    success: done,
  };
  let metadata: any;
  try {
    metadata = unpackAny(op.metadata);
  } catch (err) {
    log.warn({ err }, 'Error decoding operation metadata');
  }
  if (metadata) {
    if (metadata.createTime) {
      result.createTime =
        typeof metadata.createTime === 'string'
          ? metadata.createTime
          : new Date(Number(metadata.createTime.seconds ?? 0) * 1000).toISOString();
    }
    if (metadata.target) result.target = metadata.target;
    if (metadata.verb) result.verb = metadata.verb;
    if (metadata.statusMessage) result.statusMessage = metadata.statusMessage;
  }
  return result;
}

// Get Operation Handler
export const getOperationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { operationName } = args;

    const netAppClient = NetAppClientFactory.createClient();
    const [operation] = await netAppClient.getOperation({ name: operationName } as Parameters<
      typeof netAppClient.getOperation
    >[0]);

    const formattedResponse = parseOperationMetadata(operation);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Retrieved details for operation '${operationName}'\n${JSON.stringify(formattedResponse, null, 2)}`,
        },
      ],
      structuredContent: formattedResponse,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error getting operation');
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error getting operation: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        error: error.message || 'Unknown error',
      },
    };
  }
};

// Cancel Operation Handler
export const cancelOperationHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { operationName } = args;

    const netAppClient = NetAppClientFactory.createClient();

    const [operation] = await netAppClient.getOperation({ name: operationName } as Parameters<
      typeof netAppClient.getOperation
    >[0]);
    if (operation.done) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Operation '${operationName}' is already completed and cannot be cancelled.`,
          },
        ],
        structuredContent: {
          success: false,
          message: 'Operation already completed',
        },
      };
    }

    await netAppClient.cancelOperation({ name: operationName } as Parameters<
      typeof netAppClient.cancelOperation
    >[0]);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully requested cancellation of operation '${operationName}'.`,
        },
      ],
      structuredContent: {
        success: true,
        message: 'Cancellation request submitted successfully',
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error cancelling operation');
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error cancelling operation: ${error.message || 'Unknown error'}`,
        },
      ],
      structuredContent: {
        success: false,
        message: error.message || 'Unknown error',
      },
    };
  }
};

// List Operations Handler
export const listOperationsHandler: ToolHandler = async (args: { [key: string]: any }) => {
  try {
    const { projectId, filter, pageSize, pageToken } = args;
    const location = args.location ?? '-';

    const netAppClient = NetAppClientFactory.createClient();
    const name = `projects/${projectId}/locations/${location}`;

    const request: { name: string; filter?: string; pageSize?: number; pageToken?: string } = {
      name,
    };
    if (filter) request.filter = filter;
    if (pageSize != null) request.pageSize = pageSize;
    if (pageToken) request.pageToken = pageToken;

    const operations: any[] = [];
    const iterable = netAppClient.listOperationsAsync(
      request as Parameters<typeof netAppClient.listOperationsAsync>[0]
    );
    for await (const op of iterable) {
      operations.push(op);
    }

    log.info({ count: operations.length }, 'List operations response');

    const formattedOperations = operations.map(formatOperationForList);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ operations: formattedOperations }, null, 2),
        },
      ],
      structuredContent: {
        operations: formattedOperations,
        nextPageToken: undefined as string | undefined,
      },
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing operations');
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error listing operations: ${error.message || 'Unknown error'}`,
        },
      ],
    };
  }
};

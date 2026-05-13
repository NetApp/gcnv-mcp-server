import { logger } from '../logger.js';

const log = logger.child({ module: 'ontap-response-utils' });

/**
 * If the ONTAP response contains a `job` object with a `uuid`,
 * wraps the result with async job polling guidance.
 */
export function wrapAsyncJobResponse(result: unknown): {
  result: unknown;
  asyncJobDetected?: boolean;
  pollingGuidance?: string;
} {
  if (result && typeof result === 'object' && 'job' in result && (result as any).job?.uuid) {
    const jobUuid = (result as any).job.uuid as string;
    return {
      result,
      asyncJobDetected: true,
      pollingGuidance: `Async operation started. Job UUID: ${jobUuid}. Use ontap_job_get to poll status until state is 'success' or 'failure'.`,
    };
  }
  return { result };
}

/**
 * Parses an ONTAP error response body into a structured format.
 * ONTAP errors typically have { error: { code, message, target } }.
 */
export function formatOntapError(
  statusCode: number,
  responseBody: string,
  path: string
): { code: string; message: string; target: string; suggestion: string } {
  try {
    const parsed = JSON.parse(responseBody);
    const err = parsed?.error || parsed?.rawResponse?.error;
    if (err) {
      return {
        code: String(err.code ?? statusCode),
        message: String(err.message ?? 'Unknown ONTAP error'),
        target: String(err.target ?? path),
        suggestion: deriveSuggestion(statusCode, String(err.message ?? '')),
      };
    }
  } catch {
    // Response body is not JSON
  }

  return {
    code: String(statusCode),
    message: responseBody.slice(0, 500) || 'Unknown error',
    target: path,
    suggestion: deriveSuggestion(statusCode, ''),
  };
}

function deriveSuggestion(statusCode: number, message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('already exists')) {
    return 'Check if the resource already exists, or use a different name.';
  }
  if (lower.includes('not found')) {
    return 'Verify the resource UUID/name is correct. Use a list operation to find valid identifiers.';
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'Check authentication credentials and IAM permissions.';
  }
  if (statusCode === 429) {
    return 'Rate limit exceeded. Wait a moment and retry.';
  }
  if (statusCode >= 500) {
    return 'Server error. Retry the request or check ONTAP cluster health.';
  }
  return 'Review the error message and adjust the request parameters.';
}

/** Standard structured success response for MCP tool handlers. */
export function successResponse(data: unknown) {
  const wrapped = { result: data };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(wrapped, null, 2) }],
    structuredContent: wrapped,
  };
}

/**
 * Strips top-level keys from structuredContent that are not declared in the
 * tool's outputSchema. Prevents the MCP SDK from rejecting responses when a
 * handler accidentally includes extra properties.
 */
export function sanitizeStructuredContent(
  content: Record<string, unknown>,
  declaredKeys: string[]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of declaredKeys) {
    if (key in content) {
      sanitized[key] = content[key];
    }
  }
  return sanitized;
}

const ONTAP_FALLBACK_HINT =
  ' If this operation failed because the resource requires a different API endpoint,' +
  ' use ontap_discover to find the correct endpoint, then ontap_execute to call it.';

const MAX_ERROR_MESSAGE_LENGTH = 1000;

/** Truncates oversized error messages before they reach user output; full message stays in the server log. */
function sanitizeErrorMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}… [truncated; see server logs for full error]`;
}

/** Standard structured error response for MCP tool handlers. */
export function errorResponse(operation: string, err: any) {
  log.error({ err }, `Error in ${operation}`);
  const rawMessage = err?.message ?? 'Unknown error';
  const base = `Error in ${operation}: ${sanitizeErrorMessage(String(rawMessage))}`;
  const hint = operation.startsWith('ontap_') ? ONTAP_FALLBACK_HINT : '';
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: base + hint,
      },
    ],
  };
}

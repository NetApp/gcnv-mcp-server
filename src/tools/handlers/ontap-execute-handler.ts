import { ToolHandler } from '../../types/tool.js';
import { OntapHttpClient } from '../../utils/ontap-http-client.js';
import {
  wrapAsyncJobResponse,
  formatOntapError,
  sanitizeStructuredContent,
} from '../../utils/ontap-response-utils.js';
import { loadIndex } from '../../utils/ontap-index-loader.js';
import { preflightValidate } from '../../utils/ontap-preflight-validator.js';
import {
  buildScopeDeniedEnvelope,
  isPrivateCliPath,
  PRIVATE_CLI_REJECTION_REASON,
} from '../../utils/scope-denied-envelope.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'ontap-execute-handler' });

const EXECUTE_OUTPUT_KEYS = ['result', 'note'];

/**
 * Parse a value that may be a JSON string or already a parsed object.
 * Some MCP clients send body/queryParams as JSON strings; others send objects.
 *
 * Includes auto-recovery for common malformations:
 *   - Single quotes instead of double quotes
 *   - Python-style True/False/None
 */
function parseJsonParam<T>(value: unknown, paramName: string): T | undefined {
  if (value === undefined || value === null) return undefined;

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      // Auto-recovery: single quotes → double quotes, Python booleans/None.
      const fixed = value
        .replace(/'/g, '"')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null');
      try {
        parsed = JSON.parse(fixed);
      } catch {
        // Don't echo the raw value -- may contain sensitive data.
        throw new Error(
          `Invalid JSON in ${paramName}. ` +
            `Hint: pass either a parsed object or a valid JSON string using double quotes, e.g. ${paramName}: {"snapshot_policy":{"name":"my-policy"}}`
        );
      }
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${paramName} must be a JSON object.`);
  }
  return parsed as T;
}

function isRetryable(method: string, statusCode?: number): boolean {
  if (method !== 'GET') return false;
  if (statusCode === undefined) return true;
  return statusCode === 429 || statusCode >= 500;
}

const ONTAP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Collection GETs support max_records; instance GETs (trailing UUID/id) do not. */
export function shouldDefaultMaxRecordsForGet(ontapApiPath: string): boolean {
  const last = ontapApiPath.replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? '';
  if (ONTAP_UUID_RE.test(last)) return false;
  if (/^\d+$/.test(last)) return false;
  return true;
}

/**
 * Normalize query params for the GCNV ONTAP proxy.
 * The proxy renames ontap_fields → fields before forwarding to ONTAP; callers
 * must use ontap_fields. Raw `fields` is interpreted as a Google API field mask.
 */
export function normalizeOntapQueryParams(
  queryParams?: Record<string, string>
): Record<string, string> | undefined {
  if (!queryParams) return undefined;
  if (!Object.prototype.hasOwnProperty.call(queryParams, 'fields')) {
    return queryParams;
  }
  const normalized = { ...queryParams };
  if (!normalized['ontap_fields']) {
    normalized['ontap_fields'] = normalized['fields'];
  }
  delete normalized['fields'];
  return normalized;
}

export const ontapExecuteHandler: ToolHandler = async (args) => {
  const { projectId, locationId, storagePoolId, method, ontapApiPath } = args;
  const userIntent = typeof args.userIntent === 'string' ? args.userIntent : undefined;

  log.info({ method, ontapApiPath, storagePoolId, projectId, userIntent }, 'ontap_execute called');

  // DELETE is not supported. All delete capability has been removed from the
  // server; refuse the method here so a hand-crafted call can never reach the
  // proxy, independent of the API index contents.
  if (method === 'DELETE') {
    log.info({ method, ontapApiPath }, 'ontap_execute rejected -- DELETE is not supported');
    const envelope = buildScopeDeniedEnvelope({
      source: 'preflight',
      reason:
        'DELETE operations are not supported by this server. ' +
        'Delete resources through the Google Cloud console or another tool.',
    });
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(envelope, null, 2),
        },
      ],
    };
  }

  let parsedBody: Record<string, unknown> | undefined;
  let parsedQueryParams: Record<string, string> | undefined;
  try {
    parsedBody = parseJsonParam<Record<string, unknown>>(args.body, 'body');
    parsedQueryParams = normalizeOntapQueryParams(
      parseJsonParam<Record<string, string>>(args.queryParams, 'queryParams')
    );
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Failed to parse body or queryParams: ${err?.message}. Pass either a parsed object or a valid JSON string. retryable: false`,
        },
      ],
    };
  }

  // 1. Path validation
  if (!ontapApiPath || !ontapApiPath.startsWith('/api/')) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `ontapApiPath must start with '/api/'. Got: '${ontapApiPath ?? ''}'. Use ontap_discover to find valid endpoints. retryable: false`,
        },
      ],
    };
  }

  // 2a. Private-CLI guard — independent of index load (packaging errors must not bypass).
  if (isPrivateCliPath(ontapApiPath)) {
    log.info({ method, ontapApiPath }, 'ontap_execute rejected (scope_denied, private CLI)');
    const envelope = buildScopeDeniedEnvelope({
      source: 'preflight',
      reason: PRIVATE_CLI_REJECTION_REASON,
    });
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
    };
  }

  // 2b. Pre-flight validation against the API index
  try {
    const index = await loadIndex();
    const validation = preflightValidate(method, ontapApiPath, parsedBody, index);
    if (!validation.valid) {
      // Scope-boundary denials (Private CLI, statically denied endpoints) are
      // emitted as the canonical envelope so callers know the denial is terminal.
      if (validation.scopeDenied) {
        log.info(
          { method, ontapApiPath, source: validation.scopeDenied.source },
          'ontap_execute rejected at preflight (scope_denied)'
        );
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(validation.scopeDenied, null, 2),
            },
          ],
        };
      }

      const parts = [validation.error];
      if (validation.suggestion) parts.push(`Suggestion: ${validation.suggestion}`);
      if (validation.expectedBody) {
        parts.push(`Expected body template: ${JSON.stringify(validation.expectedBody)}`);
      }
      parts.push('retryable: false');
      return {
        isError: true,
        content: [{ type: 'text' as const, text: parts.join('\n') }],
      };
    }
  } catch (indexErr: any) {
    // Fail closed: a missing/unreadable index means we cannot enforce the
    // allowlist or scope-denied envelope, so refuse the call rather than let
    // a packaging/config error turn into a safety bypass.
    log.error(
      { err: indexErr, method, ontapApiPath },
      'ontap_execute refused -- could not load API index'
    );
    const envelope = buildScopeDeniedEnvelope({
      source: 'preflight',
      reason:
        'ONTAP API index could not be loaded by the MCP server, so /api/ calls cannot be ' +
        'validated against the supported endpoint allowlist. Re-install or re-add the ' +
        'gcnv-mcp-server in your MCP client; if the failure persists, see the ' +
        'troubleshooting section of the README.',
    });
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
    };
  }

  try {
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);

    // 4. Pagination defaults for collection GETs only
    let effectiveQueryParams = parsedQueryParams ? { ...parsedQueryParams } : undefined;
    const applyDefaultMaxRecords = method === 'GET' && shouldDefaultMaxRecordsForGet(ontapApiPath);
    if (applyDefaultMaxRecords) {
      effectiveQueryParams = effectiveQueryParams || {};
      if (!effectiveQueryParams['max_records']) {
        effectiveQueryParams['max_records'] = '20';
      }
    }

    let result: unknown;
    switch (method) {
      case 'GET':
        result = await client.get(ontapApiPath, effectiveQueryParams);
        break;
      case 'POST':
        result = await client.post(ontapApiPath, parsedBody, effectiveQueryParams);
        break;
      case 'PATCH':
        result = await client.patch(ontapApiPath, parsedBody, effectiveQueryParams);
        break;
      default:
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Unsupported method: ${method}. Use GET, POST, or PATCH. retryable: false`,
            },
          ],
        };
    }

    // 5. Async job detection for mutating operations
    if (method !== 'GET') {
      const wrapped = wrapAsyncJobResponse(result);
      if (wrapped.asyncJobDetected) {
        const payload = { result: wrapped };
        const structured = sanitizeStructuredContent(payload, EXECUTE_OUTPUT_KEYS);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
          structuredContent: structured,
        };
      }
    }

    // 6. Success response with optional pagination note
    const note =
      applyDefaultMaxRecords && (!parsedQueryParams || !parsedQueryParams['max_records'])
        ? 'Results limited to 20 records. Pass max_records in queryParams to adjust, or use _links.next to paginate.'
        : undefined;
    const raw = note ? { result, note } : { result };
    const structured = sanitizeStructuredContent(raw, EXECUTE_OUTPUT_KEYS);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(raw, null, 2) }],
      structuredContent: structured,
    };
  } catch (err: any) {
    log.error({ err, method, ontapApiPath }, 'Error in ontap_execute');

    // 7. ONTAP error formatting with retry hints
    const statusMatch = err?.message?.match(/ONTAP proxy returned (\d+):([\s\S]*)/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1], 10);
      const responseBody = statusMatch[2];

      // 7a. Scope-boundary denials get the canonical envelope so the caller
      //     treats them as terminal regardless of which layer enforced them.
      const denialSource = detectScopeDenialSource(statusCode, responseBody);
      if (denialSource) {
        const reason = extractDenialReason(responseBody, statusCode);
        const envelope = buildScopeDeniedEnvelope({ source: denialSource, reason });
        return {
          isError: true,
          content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
        };
      }

      const formatted = formatOntapError(statusCode, responseBody, ontapApiPath);
      const retryable = isRetryable(method, statusCode);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                isError: true,
                error: formatted,
                suggestion: formatted.suggestion,
                retryable,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const retryable = isRetryable(method);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error in ontap_execute: ${err?.message ?? 'Unknown error'}. retryable: ${retryable}`,
        },
      ],
    };
  }
};

/**
 * Decide whether a proxy/ONTAP error is a scope-boundary denial:
 *   - 403 from ONTAP            → 'ontap'  (RBAC denied the call)
 *   - "blocked by proxy rule…"  → 'proxy'  (proxy rule engine denied)
 *   - 405                       → 'proxy'  (method not allowed by proxy)
 * Returns undefined for non-denial errors (let normal formatting handle them).
 */
function detectScopeDenialSource(
  statusCode: number,
  responseBody: string
): 'proxy' | 'ontap' | undefined {
  const lower = (responseBody ?? '').toLowerCase();
  if (lower.includes('blocked by proxy rule engine') || lower.includes('proxy rule engine')) {
    return 'proxy';
  }
  if (statusCode === 403) return 'ontap';
  if (statusCode === 405) return 'proxy';
  return undefined;
}

function extractDenialReason(responseBody: string, statusCode: number): string {
  try {
    const parsed = JSON.parse(responseBody);
    const msg = parsed?.error?.message ?? parsed?.rawResponse?.error?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  } catch {
    // not JSON
  }
  const trimmed = (responseBody ?? '').trim();
  if (trimmed.length > 0) return trimmed.slice(0, 500);
  return `ONTAP returned ${statusCode} without a body.`;
}

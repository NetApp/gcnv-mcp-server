import { ApiIndex, IndexEndpoint } from './ontap-index-loader.js';
import {
  buildScopeDeniedEnvelope,
  isPrivateCliPath,
  OUT_OF_SCOPE_REJECTION_REASON,
  PRIVATE_CLI_REJECTION_REASON,
  ScopeDeniedEnvelope,
} from './scope-denied-envelope.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  expectedBody?: unknown;
  /** Set on hard scope-boundary rejections. The execute handler emits it verbatim. */
  scopeDenied?: ScopeDeniedEnvelope;
}

function pathToSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function templateMatches(templatePath: string, actualPath: string): boolean {
  const tSegs = pathToSegments(templatePath);
  const aSegs = pathToSegments(actualPath);
  if (tSegs.length !== aSegs.length) return false;
  return tSegs.every((s, i) => (s.startsWith('{') && s.endsWith('}') ? true : s === aSegs[i]));
}

function findEndpointsForPath(actualPath: string, endpoints: IndexEndpoint[]): IndexEndpoint[] {
  return endpoints.filter((ep) => templateMatches(ep.path, actualPath));
}

function findExactMatch(
  method: string,
  actualPath: string,
  endpoints: IndexEndpoint[]
): IndexEndpoint | undefined {
  return endpoints.find((ep) => ep.method === method && templateMatches(ep.path, actualPath));
}

function hasBodyField(body: Record<string, unknown>, fieldPath: string): boolean {
  if (!fieldPath.includes('.')) {
    return Object.prototype.hasOwnProperty.call(body, fieldPath);
  }

  const parts = fieldPath.split('.');
  let current: unknown = body;
  for (const part of parts) {
    if (Array.isArray(current)) current = current[0];
    if (!current || typeof current !== 'object') return false;
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, part)) return false;
    current = record[part];
  }
  return true;
}

function missingRequiredBodyGroups(
  body: Record<string, unknown> | undefined,
  requiredBody: string[][]
): string[][] {
  if (!body || Object.keys(body).length === 0) return requiredBody;
  return requiredBody.filter((group) => !group.some((field) => hasBodyField(body, field)));
}

function formatRequiredBodyGroups(groups: string[][]): string {
  return groups.map((group) => group.join(' or ')).join(', ');
}

/**
 * Rejection ladder (first match wins):
 *   1. /api/private/cli/* paths       -> scope_denied
 *   2. Path not in index              -> scope_denied (same shape as 1)
 *   3. Method not valid for path      -> validation error
 *   4. Unresolved {placeholders}      -> validation error
 *   5. POST/PATCH body missing/empty  -> validation error
 */
export function preflightValidate(
  method: string,
  ontapApiPath: string,
  body: Record<string, unknown> | undefined,
  index: ApiIndex
): ValidationResult {
  if (isPrivateCliPath(ontapApiPath)) {
    const envelope = buildScopeDeniedEnvelope({
      source: 'preflight',
      reason: PRIVATE_CLI_REJECTION_REASON,
    });
    return {
      valid: false,
      error: PRIVATE_CLI_REJECTION_REASON,
      scopeDenied: envelope,
    };
  }

  const matchingEndpoints = findEndpointsForPath(ontapApiPath, index.endpoints);

  if (matchingEndpoints.length === 0) {
    const envelope = buildScopeDeniedEnvelope({
      source: 'preflight',
      reason: OUT_OF_SCOPE_REJECTION_REASON,
    });
    return {
      valid: false,
      error: OUT_OF_SCOPE_REJECTION_REASON,
      scopeDenied: envelope,
    };
  }

  const validMethods = matchingEndpoints.map((ep) => ep.method);
  if (!validMethods.includes(method)) {
    return {
      valid: false,
      error: `Method ${method} is not valid for path ${ontapApiPath}.`,
      suggestion: `Available methods for this endpoint: ${validMethods.join(', ')}. Use ontap_discover to verify the correct method.`,
    };
  }

  const exactMatch = findExactMatch(method, ontapApiPath, index.endpoints);

  if (ontapApiPath.includes('{') && ontapApiPath.includes('}')) {
    const placeholders = ontapApiPath.match(/\{[^}]+\}/g) || [];
    return {
      valid: false,
      error: `Path contains unresolved placeholders: ${placeholders.join(', ')}.`,
      suggestion: `Replace ${placeholders.join(', ')} with actual values (e.g. UUIDs from a prior list/get call).`,
    };
  }

  if (exactMatch && (method === 'POST' || method === 'PATCH')) {
    const expectedBody = exactMatch.body;

    if (expectedBody && typeof expectedBody === 'object' && Object.keys(expectedBody).length > 0) {
      if (!body || Object.keys(body).length === 0) {
        return {
          valid: false,
          error: `${method} ${ontapApiPath} requires a request body.`,
          suggestion: `Provide a body with these fields: ${Object.keys(expectedBody as Record<string, unknown>).join(', ')}.`,
          expectedBody,
        };
      }

      // Index body templates are enforced for POST only; PATCH templates are illustrative.
      if (method === 'POST') {
        const expectedKeys = Object.keys(expectedBody as Record<string, unknown>);
        const providedKeys = Object.keys(body);
        const missingKeys = expectedKeys.filter((k) => !providedKeys.includes(k));
        if (missingKeys.length > 0 && missingKeys.length === expectedKeys.length) {
          return {
            valid: false,
            error: `${method} ${ontapApiPath} body is missing all expected fields: ${missingKeys.join(', ')}.`,
            suggestion: `The body should contain at least: ${expectedKeys.join(', ')}. See the expected body template.`,
            expectedBody,
          };
        }
      }
    }

    if (exactMatch.requiredBody && exactMatch.requiredBody.length > 0) {
      const missingRequired = missingRequiredBodyGroups(body, exactMatch.requiredBody);
      if (missingRequired.length > 0) {
        const missingText = formatRequiredBodyGroups(missingRequired);
        return {
          valid: false,
          error: `${method} ${ontapApiPath} body is missing required field(s): ${missingText}.`,
          suggestion: `Provide all required body fields: ${formatRequiredBodyGroups(exactMatch.requiredBody)}.`,
          expectedBody,
        };
      }
    }
  }

  return { valid: true };
}

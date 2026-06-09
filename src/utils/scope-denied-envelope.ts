/**
 * Canonical denial envelope. `retryability: false` is terminal.
 */

export type ScopeDeniedSource = 'preflight' | 'proxy' | 'ontap';

export interface ScopeDeniedEnvelope {
  error: 'scope_denied';
  retryability: false;
  source: ScopeDeniedSource;
  reason: string;
  suggested_tool?: string;
}

export interface ScopeDeniedInput {
  source: ScopeDeniedSource;
  reason: string;
  suggested_tool?: string;
}

export function buildScopeDeniedEnvelope(input: ScopeDeniedInput): ScopeDeniedEnvelope {
  const envelope: ScopeDeniedEnvelope = {
    error: 'scope_denied',
    retryability: false,
    source: input.source,
    reason: input.reason,
  };
  if (input.suggested_tool) envelope.suggested_tool = input.suggested_tool;
  return envelope;
}

export const PRIVATE_CLI_PATH = '/api/private/cli';
export const PRIVATE_CLI_PATH_PREFIX = `${PRIVATE_CLI_PATH}/`;

export function isPrivateCliPath(path: string): boolean {
  return path === PRIVATE_CLI_PATH || path.startsWith(PRIVATE_CLI_PATH_PREFIX);
}

export const PRIVATE_CLI_REJECTION_REASON =
  'Private CLI passthrough (/api/private/cli and subpaths) is out of scope for this tool. ' +
  'Use a purpose-built gcnv_* tool, or call a public /api/ endpoint.';

/** Neutral by design: does not distinguish unknown / out-of-scope / policy-denied. */
export const OUT_OF_SCOPE_REJECTION_REASON = 'This endpoint is out of scope for this tool.';

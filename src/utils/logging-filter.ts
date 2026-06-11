/**
 * Cloud Logging filter builder for Google Cloud NetApp Volumes (GCNV).
 *
 * GCNV has no dedicated log API. Logs, errors, and events are all surfaced
 * through Google Cloud Logging, scoped to the NetApp service via the audit-log
 * filter `protoPayload.serviceName="netapp.googleapis.com"`. These helpers turn
 * a small set of high-level, agent-friendly arguments into a valid Logging
 * filter expression so callers never have to learn the filter DSL.
 *
 * Reference: https://docs.cloud.google.com/netapp/volumes/docs/monitor/cloud-logging
 */

/** Cloud Logging service name used by all GCNV audit logs. */
export const NETAPP_SERVICE_NAME = 'netapp.googleapis.com';

/** Base clause that scopes every query to GCNV audit logs. */
export const NETAPP_BASE_FILTER = `protoPayload.serviceName="${NETAPP_SERVICE_NAME}"`;

/** Cloud Logging severities, ordered from least to most severe. */
export const LOG_SEVERITIES = [
  'DEFAULT',
  'DEBUG',
  'INFO',
  'NOTICE',
  'WARNING',
  'ERROR',
  'CRITICAL',
  'ALERT',
  'EMERGENCY',
] as const;

export type LogSeverity = (typeof LOG_SEVERITIES)[number];

/**
 * Maps a GCNV resource kind to the path segment used inside
 * `protoPayload.resourceName` (e.g. volume -> volumes).
 */
export const RESOURCE_TYPE_TO_SEGMENT: Record<string, string> = {
  storagePool: 'storagePools',
  volume: 'volumes',
  snapshot: 'snapshots',
  backup: 'backups',
  backupVault: 'backupVaults',
  backupPolicy: 'backupPolicies',
  replication: 'replications',
  activeDirectory: 'activeDirectories',
  kmsConfig: 'kmsConfigs',
  quotaRule: 'quotaRules',
  hostGroup: 'hostGroups',
};

export type GcnvResourceType = keyof typeof RESOURCE_TYPE_TO_SEGMENT;

/**
 * Maps a high-level event type to a substring that appears in the audit-log
 * method name (e.g. `google.cloud.netapp.v1.NetApp.DeleteVolume`). Matched
 * case-insensitively as a regular expression on `protoPayload.methodName`.
 */
export const EVENT_TYPE_TO_METHOD_TOKEN: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  replication: 'Replication',
  backup: 'Backup',
  snapshot: 'Snapshot',
  encrypt: 'Encrypt',
  revert: 'Revert',
};

export type GcnvEventType = keyof typeof EVENT_TYPE_TO_METHOD_TOKEN;

export interface BuildLogFilterOptions {
  /** Restrict to a single GCNV resource kind (volume, storagePool, ...). */
  resourceType?: string;
  /** Match a resource name (substring of protoPayload.resourceName). */
  resourceName?: string;
  /** Restrict to a GCP region/zone (matched inside the resource name). */
  location?: string;
  /** Minimum severity, inclusive (e.g. ERROR -> severity>=ERROR). */
  minSeverity?: string;
  /** When true, also include failed operations (protoPayload.status.code!=0). */
  includeFailures?: boolean;
  /** When true, restrict strictly to failures (errors tool). */
  failuresOnly?: boolean;
  /** Restrict to a specific audit method name (regex on protoPayload.methodName). */
  methodName?: string;
  /** High-level event category mapped onto a method-name token. */
  eventType?: string;
  /** Inclusive lower time bound (RFC3339). */
  startTime?: string;
  /** Inclusive upper time bound (RFC3339). */
  endTime?: string;
  /** Verbatim Logging filter appended as an additional AND clause. */
  freeTextFilter?: string;
}

/** Thrown when an argument cannot be turned into a safe filter clause. */
export class LogFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogFilterError';
  }
}

/** Escape a value for use inside a double-quoted Logging string literal. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Normalize and validate a severity argument. */
export function normalizeSeverity(severity: string): LogSeverity {
  const upper = severity.trim().toUpperCase();
  if (!(LOG_SEVERITIES as readonly string[]).includes(upper)) {
    throw new LogFilterError(
      `Invalid severity "${severity}". Expected one of: ${LOG_SEVERITIES.join(', ')}.`
    );
  }
  return upper as LogSeverity;
}

/**
 * Validate caller-supplied free text before it is concatenated into the filter.
 * Rejects control characters, unbalanced quotes, and unbalanced parentheses so
 * the resulting filter cannot be silently corrupted.
 */
export function sanitizeFreeText(freeText: string): string {
  const trimmed = freeText.trim();
  if (trimmed.length === 0) {
    throw new LogFilterError('freeTextFilter must not be empty.');
  }
  if (trimmed.length > 2048) {
    throw new LogFilterError('freeTextFilter is too long (max 2048 characters).');
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new LogFilterError('freeTextFilter must not contain control characters.');
  }
  const doubleQuotes = (trimmed.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) {
    throw new LogFilterError('freeTextFilter has an unbalanced double quote.');
  }
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) {
      throw new LogFilterError('freeTextFilter has unbalanced parentheses.');
    }
  }
  if (depth !== 0) {
    throw new LogFilterError('freeTextFilter has unbalanced parentheses.');
  }
  return trimmed;
}

/** Convert a glob-ish method pattern into a safe regex body for `=~`. */
function methodNameToRegex(methodName: string): string {
  const trimmed = methodName.trim();
  if (!/^[A-Za-z0-9_.*]+$/.test(trimmed)) {
    throw new LogFilterError('methodName may only contain letters, digits, ".", "_" and "*".');
  }
  // Escape regex specials except "*", then expand "*" to ".*".
  return trimmed.replace(/[.]/g, '\\.').replace(/\*/g, '.*');
}

/** Validate the location argument used for resource-name scoping. */
function validateLocation(location: string): string {
  const trimmed = location.trim();
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
    throw new LogFilterError('location may only contain letters, digits and "-".');
  }
  return trimmed;
}

/**
 * Build a Cloud Logging filter expression scoped to GCNV from high-level
 * options. The returned string always starts with the NetApp base clause.
 */
export function buildGcnvLogFilter(options: BuildLogFilterOptions = {}): string {
  const clauses: string[] = [NETAPP_BASE_FILTER];

  if (options.startTime) {
    clauses.push(`timestamp>=${quote(options.startTime)}`);
  }
  if (options.endTime) {
    clauses.push(`timestamp<=${quote(options.endTime)}`);
  }

  if (options.location) {
    const loc = validateLocation(options.location);
    clauses.push(`protoPayload.resourceName:${quote(`/locations/${loc}/`)}`);
  }

  if (options.resourceType) {
    const segment = RESOURCE_TYPE_TO_SEGMENT[options.resourceType];
    if (!segment) {
      throw new LogFilterError(
        `Invalid resourceType "${options.resourceType}". Expected one of: ${Object.keys(
          RESOURCE_TYPE_TO_SEGMENT
        ).join(', ')}.`
      );
    }
    clauses.push(`protoPayload.resourceName:${quote(`/${segment}/`)}`);
  }

  if (options.resourceName) {
    clauses.push(`protoPayload.resourceName:${quote(options.resourceName)}`);
  }

  if (options.eventType) {
    const token = EVENT_TYPE_TO_METHOD_TOKEN[options.eventType];
    if (!token) {
      throw new LogFilterError(
        `Invalid eventType "${options.eventType}". Expected one of: ${Object.keys(
          EVENT_TYPE_TO_METHOD_TOKEN
        ).join(', ')}.`
      );
    }
    clauses.push(`protoPayload.methodName=~${quote(token)}`);
  }

  if (options.methodName) {
    clauses.push(`protoPayload.methodName=~${quote(methodNameToRegex(options.methodName))}`);
  }

  // Severity / failure handling.
  if (options.failuresOnly) {
    const min = options.minSeverity ? normalizeSeverity(options.minSeverity) : undefined;
    if (min) {
      clauses.push(`(severity>=${min} OR protoPayload.status.code!=0)`);
    } else {
      clauses.push(`(severity>=ERROR OR protoPayload.status.code!=0)`);
    }
  } else {
    if (options.minSeverity) {
      const min = normalizeSeverity(options.minSeverity);
      if (options.includeFailures) {
        clauses.push(`(severity>=${min} OR protoPayload.status.code!=0)`);
      } else {
        clauses.push(`severity>=${min}`);
      }
    } else if (options.includeFailures) {
      clauses.push(`protoPayload.status.code!=0`);
    }
  }

  if (options.freeTextFilter) {
    clauses.push(`(${sanitizeFreeText(options.freeTextFilter)})`);
  }

  return clauses.join(' AND ');
}

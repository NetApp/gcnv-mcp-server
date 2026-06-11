import { ToolHandler } from '../../types/tool.js';
import { LoggingClientFactory } from '../../utils/logging-client-factory.js';
import { buildGcnvLogFilter, BuildLogFilterOptions } from '../../utils/logging-filter.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'logs-handler' });

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_SUMMARY_MAX = 500;
const MAX_SUMMARY_MAX = 1000;

/** A compact, agent-friendly projection of a Cloud Logging entry. */
export interface ProjectedLogEntry {
  timestamp?: string;
  severity?: string;
  methodName?: string;
  resourceName?: string;
  principal?: string;
  statusCode?: number;
  statusMessage?: string;
  operationId?: string;
  logName?: string;
  summary?: string;
}

/** Normalize a Logging timestamp (ITimestamp | Date | string) to RFC3339. */
function toIsoString(ts: any): string | undefined {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  // protobuf ITimestamp { seconds, nanos }
  if (typeof ts === 'object' && ts.seconds != null) {
    const seconds = Number(ts.seconds);
    const millis = seconds * 1000 + Math.floor(Number(ts.nanos ?? 0) / 1e6);
    return new Date(millis).toISOString();
  }
  try {
    return new Date(ts).toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Project a `@google-cloud/logging` Entry into the compact shape returned to
 * callers. `entry.metadata` carries the LogEntry envelope; `entry.data` carries
 * the payload (the audit `protoPayload` for GCNV audit logs).
 */
export function projectEntry(entry: any): ProjectedLogEntry {
  const meta = entry?.metadata ?? entry ?? {};
  const payload = entry?.data ?? meta.protoPayload ?? meta.jsonPayload ?? {};

  const methodName: string | undefined = payload?.methodName;
  const resourceName: string | undefined = payload?.resourceName;
  const principal: string | undefined = payload?.authenticationInfo?.principalEmail;
  const status = payload?.status ?? {};
  const statusCode: number | undefined = typeof status.code === 'number' ? status.code : undefined;
  const statusMessage: string | undefined = status.message || undefined;
  const operationId: string | undefined = meta?.operation?.id || undefined;
  const severity: string | undefined =
    typeof meta.severity === 'number' ? String(meta.severity) : meta.severity || undefined;

  const result: ProjectedLogEntry = {
    timestamp: toIsoString(meta.timestamp),
    severity,
    methodName,
    resourceName,
    principal,
    statusCode,
    statusMessage,
    operationId,
    logName: meta.logName || undefined,
  };

  const shortMethod = methodName ? methodName.split('.').pop() : undefined;
  const outcome = statusCode && statusCode !== 0 ? `FAILED: ${statusMessage || 'error'}` : 'ok';
  result.summary = [shortMethod, resourceName, `(${outcome})`].filter(Boolean).join(' ');

  return result;
}

/** Clamp a requested page size into the allowed range. */
function resolvePageSize(
  requested: unknown,
  fallback = DEFAULT_PAGE_SIZE,
  max = MAX_PAGE_SIZE
): number {
  const n =
    typeof requested === 'number' && Number.isFinite(requested) ? Math.floor(requested) : fallback;
  return Math.min(Math.max(n, 1), max);
}

/** Resolve the effective time window, defaulting to the last 24h. */
function resolveTimeWindow(
  startTime?: string,
  endTime?: string
): { startTime?: string; endTime?: string } {
  if (startTime || endTime) {
    return { startTime, endTime };
  }
  const end = new Date();
  const start = new Date(end.getTime() - DEFAULT_WINDOW_MS);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

function errorResult(message: string, structuredExtra: Record<string, any>) {
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { error: message.replace(/^Error[^:]*:\s*/, ''), ...structuredExtra },
    isError: true,
  };
}

/**
 * Shared list implementation for the logs/errors/events tools. Builds the
 * filter, runs a single page of `getEntries`, projects entries, and returns the
 * next page token.
 */
async function listEntries(
  args: { [key: string]: any },
  filterOverrides: Partial<BuildLogFilterOptions>
) {
  const { projectId } = args;
  if (!projectId) {
    return errorResult('Error: projectId is required', { entries: [], count: 0 });
  }

  const { startTime, endTime } = resolveTimeWindow(args.startTime, args.endTime);

  let filter: string;
  try {
    filter = buildGcnvLogFilter({
      location: args.location,
      resourceType: args.resourceType,
      resourceName: args.resourceName,
      startTime,
      endTime,
      minSeverity: args.severity,
      methodName: args.methodName,
      eventType: args.eventType,
      freeTextFilter: args.freeTextFilter,
      ...filterOverrides,
    });
  } catch (err: any) {
    return errorResult(`Error: ${err.message}`, { entries: [], count: 0 });
  }

  const pageSize = resolvePageSize(args.pageSize);
  const orderBy = args.orderBy === 'timestamp asc' ? 'timestamp asc' : 'timestamp desc';

  try {
    const logging = LoggingClientFactory.createClient(projectId);
    const [entries, , apiResponse] = await logging.getEntries({
      resourceNames: [`projects/${projectId}`],
      filter,
      orderBy,
      pageSize,
      autoPaginate: false,
      ...(args.pageToken ? { pageToken: args.pageToken } : {}),
    });

    const projected = (entries ?? []).map(projectEntry);
    const nextPageToken: string | undefined = (apiResponse as any)?.nextPageToken || undefined;

    log.info(
      { count: projected.length, hasNext: Boolean(nextPageToken) },
      'Listed GCNV log entries'
    );

    const structuredContent = {
      entries: projected,
      count: projected.length,
      filter,
      nextPageToken,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error listing GCNV log entries');
    return errorResult(`Error listing GCNV log entries: ${error.message || 'Unknown error'}`, {
      entries: [],
      count: 0,
      filter,
    });
  }
}

// List GCNV Logs Handler
export const listGcnvLogsHandler: ToolHandler = async (args) => listEntries(args, {});

// List GCNV Errors Handler
export const listGcnvErrorsHandler: ToolHandler = async (args) =>
  listEntries(args, {
    failuresOnly: true,
    minSeverity: args.minSeverity,
  });

// List GCNV Events Handler
export const listGcnvEventsHandler: ToolHandler = async (args) =>
  listEntries(args, {
    // Default to all admin-activity events when no narrower filter is given.
    eventType: args.eventType,
    methodName: args.methodName,
  });

// GCNV Log Summary Handler
export const gcnvLogSummaryHandler: ToolHandler = async (args) => {
  const { projectId } = args;
  if (!projectId) {
    return errorResult('Error: projectId is required', { totalEntries: 0 });
  }

  const { startTime, endTime } = resolveTimeWindow(args.startTime, args.endTime);

  let filter: string;
  try {
    filter = buildGcnvLogFilter({
      location: args.location,
      resourceType: args.resourceType,
      resourceName: args.resourceName,
      startTime,
      endTime,
      minSeverity: args.severity,
    });
  } catch (err: any) {
    return errorResult(`Error: ${err.message}`, { totalEntries: 0 });
  }

  const maxEntries = resolvePageSize(args.maxEntries, DEFAULT_SUMMARY_MAX, MAX_SUMMARY_MAX);

  try {
    const logging = LoggingClientFactory.createClient(projectId);

    const bySeverity: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    let totalEntries = 0;
    let failureCount = 0;
    let pageToken: string | undefined;
    let truncated = false;

    while (totalEntries < maxEntries) {
      const remaining = maxEntries - totalEntries;
      const [entries, , apiResponse] = await logging.getEntries({
        resourceNames: [`projects/${projectId}`],
        filter,
        orderBy: 'timestamp desc',
        pageSize: Math.min(remaining, MAX_PAGE_SIZE),
        autoPaginate: false,
        ...(pageToken ? { pageToken } : {}),
      });

      for (const entry of entries ?? []) {
        const p = projectEntry(entry);
        totalEntries++;
        const sev = p.severity || 'UNKNOWN';
        bySeverity[sev] = (bySeverity[sev] || 0) + 1;
        if (p.methodName) byMethod[p.methodName] = (byMethod[p.methodName] || 0) + 1;
        if (p.resourceName) byResource[p.resourceName] = (byResource[p.resourceName] || 0) + 1;
        if (p.statusCode && p.statusCode !== 0) failureCount++;
      }

      pageToken = (apiResponse as any)?.nextPageToken || undefined;
      if (!pageToken) break;
      if (totalEntries >= maxEntries) {
        truncated = true;
        break;
      }
    }

    const structuredContent = {
      totalEntries,
      failureCount,
      timeRange: { startTime, endTime },
      bySeverity,
      byMethod,
      byResource,
      truncated,
      filter,
    };

    log.info({ totalEntries, failureCount, truncated }, 'Summarized GCNV log entries');

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    };
  } catch (error: any) {
    log.error({ err: error }, 'Error summarizing GCNV log entries');
    return errorResult(`Error summarizing GCNV log entries: ${error.message || 'Unknown error'}`, {
      totalEntries: 0,
      filter,
    });
  }
};

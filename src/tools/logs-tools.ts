import { z } from 'zod';
import { ToolConfig, NOT_FOR_ONTAP } from '../types/tool.js';
import {
  LOG_SEVERITIES,
  RESOURCE_TYPE_TO_SEGMENT,
  EVENT_TYPE_TO_METHOD_TOKEN,
} from '../utils/logging-filter.js';

/**
 * Tool schemas for reading GCNV logs, errors, and events from Cloud Logging.
 *
 * GCNV exposes no dedicated log API; these tools query Google Cloud Logging
 * scoped to the NetApp service (`protoPayload.serviceName="netapp.googleapis.com"`)
 * and build the filter internally so callers never write the filter DSL.
 */

const resourceTypeEnum = Object.keys(RESOURCE_TYPE_TO_SEGMENT) as [string, ...string[]];
const severityEnum = [...LOG_SEVERITIES] as [string, ...string[]];
const eventTypeEnum = Object.keys(EVENT_TYPE_TO_METHOD_TOKEN) as [string, ...string[]];

/** Shared output shape for a single projected log entry. */
const logEntryShape = z.object({
  timestamp: z.string().optional().describe('Entry timestamp (RFC3339)'),
  severity: z.string().optional().describe('Log severity'),
  methodName: z.string().optional().describe('Audit method (e.g. ...NetApp.DeleteVolume)'),
  resourceName: z.string().optional().describe('Target resource name'),
  principal: z.string().optional().describe('Caller identity (principalEmail)'),
  statusCode: z.number().optional().describe('gRPC status code (0 = success)'),
  statusMessage: z.string().optional().describe('Status message, if any'),
  operationId: z.string().optional().describe('Long-running operation id, if any'),
  logName: z.string().optional().describe('Originating log name'),
  summary: z.string().optional().describe('Human-readable one-line summary'),
});

/** Common list-output schema (entries + pagination). */
const listOutputSchema = {
  entries: z.array(logEntryShape).describe('Projected log entries'),
  count: z.number().describe('Number of entries returned in this page'),
  filter: z.string().optional().describe('The Cloud Logging filter that was used'),
  nextPageToken: z.string().optional().describe('Token to retrieve the next page'),
};

/** Common input fields shared across the list-style tools. */
const commonInput = {
  projectId: z.string().describe('The ID of the Google Cloud project to read logs from'),
  location: z
    .string()
    .optional()
    .describe('Restrict to a GCP region/zone (e.g. us-central1); omit for all locations'),
  resourceType: z
    .enum(resourceTypeEnum)
    .optional()
    .describe(`Restrict to a GCNV resource kind: ${resourceTypeEnum.join(', ')}`),
  resourceName: z
    .string()
    .optional()
    .describe('Restrict to a resource whose name contains this value (e.g. a volume name)'),
  startTime: z
    .string()
    .optional()
    .describe('Inclusive lower time bound, RFC3339 (default: 24h before endTime/now)'),
  endTime: z.string().optional().describe('Inclusive upper time bound, RFC3339 (default: now)'),
  pageSize: z.number().optional().describe('Max entries to return per page (default 50, max 200)'),
  pageToken: z.string().optional().describe('Page token from a previous list request'),
  orderBy: z
    .enum(['timestamp desc', 'timestamp asc'])
    .optional()
    .describe('Sort order (default "timestamp desc")'),
};

// List GCNV Logs Tool
export const listGcnvLogsTool: ToolConfig = {
  name: 'gcnv_logs_list',
  title: 'List GCNV Logs',
  description:
    'List Google Cloud Logging entries for Google Cloud NetApp Volumes (GCNV), scoped to ' +
    'netapp.googleapis.com. Supports filtering by resource, time range, and minimum severity, ' +
    'plus an optional raw Cloud Logging filter clause.' +
    NOT_FOR_ONTAP,
  inputSchema: {
    ...commonInput,
    severity: z
      .enum(severityEnum)
      .optional()
      .describe(`Minimum severity, inclusive: ${severityEnum.join(', ')}`),
    freeTextFilter: z
      .string()
      .optional()
      .describe(
        'Optional additional Cloud Logging filter clause appended with AND ' +
          '(e.g. protoPayload.methodName:"CreateVolume"). Validated for balanced quotes/parens.'
      ),
  },
  outputSchema: listOutputSchema,
};

// List GCNV Errors Tool
export const listGcnvErrorsTool: ToolConfig = {
  name: 'gcnv_errors_list',
  title: 'List GCNV Errors',
  description:
    'List GCNV error/failure log entries (severity>=ERROR or failed operations with a non-zero ' +
    'status code). Use this to triage failures, issues, and alerts for NetApp Volumes resources.' +
    NOT_FOR_ONTAP,
  inputSchema: {
    ...commonInput,
    minSeverity: z
      .enum(severityEnum)
      .optional()
      .describe('Override the minimum severity (default ERROR); failures are always included'),
  },
  outputSchema: listOutputSchema,
};

// List GCNV Events Tool
export const listGcnvEventsTool: ToolConfig = {
  name: 'gcnv_events_list',
  title: 'List GCNV Events',
  description:
    'List GCNV lifecycle/admin-activity events (create, update, delete, replication, backup, ' +
    'snapshot operations) from audit logs. Use this for historical events and change tracking.' +
    NOT_FOR_ONTAP,
  inputSchema: {
    ...commonInput,
    eventType: z
      .enum(eventTypeEnum)
      .optional()
      .describe(`High-level event category: ${eventTypeEnum.join(', ')}`),
    methodName: z
      .string()
      .optional()
      .describe(
        'Restrict to a specific audit method name; supports "*" wildcards (e.g. *.DeleteVolume)'
      ),
  },
  outputSchema: listOutputSchema,
};

// GCNV Log Summary Tool
export const gcnvLogSummaryTool: ToolConfig = {
  name: 'gcnv_log_summary',
  title: 'Summarize GCNV Logs',
  description:
    'Fetch a window of GCNV log entries and return aggregated counts (by severity, method, and ' +
    'resource) plus a failure count. Use this to spot historical patterns and recurring issues ' +
    'without paging through raw entries.' +
    NOT_FOR_ONTAP,
  inputSchema: {
    ...commonInput,
    severity: z
      .enum(severityEnum)
      .optional()
      .describe(`Minimum severity, inclusive: ${severityEnum.join(', ')}`),
    maxEntries: z
      .number()
      .optional()
      .describe('Max entries to scan for the summary (default 500, max 1000)'),
  },
  outputSchema: {
    totalEntries: z.number().describe('Number of entries scanned'),
    failureCount: z.number().describe('Entries with a non-zero status code'),
    timeRange: z
      .object({ startTime: z.string().optional(), endTime: z.string().optional() })
      .describe('Effective time range scanned'),
    bySeverity: z.record(z.number()).describe('Entry counts keyed by severity'),
    byMethod: z.record(z.number()).describe('Entry counts keyed by audit method name'),
    byResource: z.record(z.number()).describe('Entry counts keyed by resource name'),
    truncated: z.boolean().describe('True if more entries existed than were scanned'),
    filter: z.string().optional().describe('The Cloud Logging filter that was used'),
  },
};

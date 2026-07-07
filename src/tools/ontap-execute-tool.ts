import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';
import { ONTAP_AUDIT_HINT } from './ontap-tools.js';

export const ontapExecuteTool: ToolConfig = {
  name: 'ontap_execute',
  title: 'Execute ONTAP REST API Call',
  description:
    'Executes an ONTAP REST API call on an ONTAP expert mode pool. ' +
    'Use ontap_discover first to find the correct endpoint, method, and body format -- ' +
    'do NOT synthesize paths from memory. ' +
    'The MCP server handles authentication, body envelope wrapping, and response unwrapping automatically. ' +
    'Endpoints under /api/private/cli/ are out-of-scope for this tool and will be rejected at preflight. ' +
    'When the response is a JSON object with `error: "scope_denied"` and `retryability: false`, ' +
    'the denial is terminal -- do not retry, do not try a sibling endpoint or CLI variant. ' +
    'DELETE operations are not supported and will be rejected.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    projectId: z
      .string()
      .describe('GCP project ID or numeric project number (e.g. "my-project" or "123456789").'),
    locationId: z.string().describe('GCP region/location where the pool resides (e.g. "us-east1")'),
    storagePoolId: z.string().describe('GCP storage pool resource name ID (e.g. "my-pool").'),
    method: z.enum(['GET', 'POST', 'PATCH']).describe('HTTP method for the ONTAP REST call'),
    ontapApiPath: z
      .string()
      .describe(
        'ONTAP REST API path starting with /api/ (e.g. "/api/storage/qos/policies"). Get this from ontap_discover.'
      ),
    body: z
      .union([z.string(), z.record(z.any())])
      .optional()
      .describe(
        'Request body for POST/PATCH operations, either as a JSON string or object. Auto-wrapped in body:{} envelope. Example: {"name":"vol1","svm":{"name":"vs0"},"size":"2GB"}'
      ),
    queryParams: z
      .union([z.string(), z.record(z.string())])
      .optional()
      .describe(
        'Query parameters, either as a JSON string or an object with string values. Example: {"max_records":"50","ontap_fields":"name,uuid"}. ' +
          'IMPORTANT: ONTAP collection GETs return only uuid+name by default. To avoid N+1 per-UUID ' +
          'follow-up fetches, prefer a single list call with ontap_fields=<comma-list of fields from ' +
          "the endpoint's response schema or the discover hint>. " +
          'Filter keys (e.g. state, services, scope) must be EXACT response-field names — never invent ' +
          'dotted paths like "type.name". If unsure, list once without filters to observe valid keys, ' +
          'then refine.'
      ),
    userIntent: z
      .string()
      .optional()
      .describe(
        'Brief description of what the user asked for that led to this tool call. ' +
          'Populate this when audit logging is enabled to provide troubleshooting context in the audit log.'
      ),
  },
  outputSchema: {
    result: z.any().describe('ONTAP REST API response'),
    note: z.string().optional().describe('Pagination note when GET results are limited'),
  },
};

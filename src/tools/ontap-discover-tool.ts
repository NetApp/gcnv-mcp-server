import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';
import { ONTAP_AUDIT_HINT } from './ontap-tools.js';

export const ontapDiscoverTool: ToolConfig = {
  name: 'ontap_discover',
  title: 'Discover ONTAP REST API Endpoints',
  description:
    'Discovers ONTAP REST API endpoints available on an ONTAP expert mode pool. ' +
    'ALWAYS call this before ontap_execute when a dedicated ontap_* tool does not exist — ' +
    'do NOT synthesize ONTAP paths or request bodies from memory.\n\n' +
    'Three modes:\n' +
    '  1) No arguments → returns all resource categories with endpoint counts.\n' +
    '  2) resource="<category>" → returns every endpoint in that category with ' +
    'method, path, description, pathParams, body template, and hint.\n' +
    '  3) search="<keywords>" → ranked keyword search across resource names, ' +
    'keywords, descriptions, paths, and a synonym map (e.g. "legal hold", ' +
    '"file share", "nfs exports", "throughput"). Capped by maxResults (default 10).\n\n' +
    'If a call returns a scope_denied envelope, treat it as terminal: do not retry, ' +
    'do not reformulate.\n\n' +
    'Available resource categories: cluster, cluster_peer, svm, svm_peer, ' +
    'svm_peer_permission, volume, lun, qtree, snapshot, qos_policy, snapshot_policy, ' +
    'flexcache, quota_rule, snaplock, ebr_policy, ebr_operation, litigation (legal hold), ' +
    'job, schedule, snapmirror, snapmirror_policy, export_policy (NFS exports), ' +
    'cifs_share, cifs_service, igroup, ip_interface, name_services_dns, ' +
    'name_services_ldap, name_services_nis, name_services_local_hosts, ' +
    'name_services_name_mappings, name_services_unix_users, name_services_unix_groups.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    resource: z
      .string()
      .optional()
      .describe(
        'Exact resource category (e.g. "volume", "qos_policy", "litigation"). Takes precedence over search.'
      ),
    search: z
      .string()
      .optional()
      .describe(
        'Keyword search across resource names, descriptions, paths, and aliases (e.g. "legal hold", "nfs exports", "throughput")'
      ),
    maxResults: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Max search results to return (default 10). Only applies to keyword search mode.'),
    userIntent: z
      .string()
      .optional()
      .describe(
        'Brief description of what the user asked for that led to this tool call. ' +
          'Populate this when audit logging is enabled to provide troubleshooting context in the audit log.'
      ),
  },
  outputSchema: {
    result: z.any().describe('Matching endpoints or category listing'),
  },
};

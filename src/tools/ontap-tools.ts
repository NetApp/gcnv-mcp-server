import { z } from 'zod';
import { ToolConfig } from '../types/tool.js';

/** Suffix appended to ONTAP tool descriptions to prompt for audit logging before the first call. */
export const ONTAP_AUDIT_HINT =
  '\n\nBefore your first ONTAP tool call in a session, ask the user: ' +
  '"Would you like me to log ONTAP operations to a local file for this session?" ' +
  'If yes, call ontap_audit_log with action="enable" (no outputDir needed — logs go to logs/ automatically). ' +
  'Tell the user the log file path. Do not ask again after. ' +
  'Do NOT pass userIntent to ontap_audit_log — userIntent is only for other ontap_* tools.';

/**
 * Common input fields shared by all ONTAP Expert Mode tools.
 *
 * The ONTAP proxy URL is constructed directly from these identifiers:
 *   /v1beta1/projects/{projectId}/locations/{locationId}/storagePools/{storagePoolId}/ontap/{path}
 */
const ontapCommonInput = {
  projectId: z
    .string()
    .describe('GCP project ID or numeric project number (e.g. "my-project" or "123456789").'),
  locationId: z.string().describe('GCP region/location where the pool resides (e.g. "us-east1")'),
  storagePoolId: z.string().describe('GCP storage pool resource name ID (e.g. "my-pool").'),
  userIntent: z
    .string()
    .optional()
    .describe(
      'Brief description of what the user asked for that led to this tool call. ' +
        'Populate this when audit logging is enabled to provide troubleshooting context in the audit log.'
    ),
};

const confirmDeleteInput = {
  confirmDelete: z
    .boolean()
    .optional()
    .describe(
      'Must be true for DELETE operations. IMPORTANT: Only set this to true AFTER showing ' +
        'the delete preview to the user and receiving their explicit YES.'
    ),
  confirmedResourceName: z
    .string()
    .optional()
    .describe(
      'Required when confirmDelete=true. Set to the exact resourceName from the delete preview. ' +
        'Prevents executing a DELETE for a different resource than the one the user approved.'
    ),
};

// ---------------------------------------------------------------------------
// SVM
// ---------------------------------------------------------------------------

export const ontapSvmListTool: ToolConfig = {
  name: 'ontap_svm_list',
  title: 'ONTAP List SVMs',
  description:
    'Lists Storage Virtual Machines (SVMs) on the ONTAP expert mode pool. ' +
    'Each pool has one SVM and one aggregate. Returns SVM name and aggregate name, ' +
    'which are required inputs for volume creation.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
  },
  outputSchema: {
    result: z.any().describe('SVM list with svmName and aggregateName extracted'),
  },
};

// ---------------------------------------------------------------------------
// Volumes
// ---------------------------------------------------------------------------

export const ontapVolumeCreateTool: ToolConfig = {
  name: 'ontap_volume_create',
  title: 'ONTAP Create Volume',
  description:
    'Creates an ONTAP volume on the expert mode pool. Returns an async job UUID. ' +
    'If svmName or aggregateName are not provided, they are auto-resolved via ontap_svm_list.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    name: z
      .string()
      .describe(
        'Volume name. ONTAP naming rules: letters, numbers, and underscores ONLY — hyphens are NOT allowed. Must start with a letter or underscore (e.g. "my_volume", "vol1").'
      ),
    size: z
      .string()
      .describe('Volume size string (e.g. "5GB", "500MB", "1TB"). Use GB/MB/TB — NOT GiB/MiB/TiB.'),
    svmName: z.string().optional().describe('SVM name. Auto-resolved if not provided.'),
    aggregateName: z.string().optional().describe('Aggregate name. Auto-resolved if not provided.'),
    nasPath: z
      .string()
      .optional()
      .describe(
        'Junction/mount path in the SVM namespace (e.g. "/my_volume"). Required for NAS/SMB ' +
          'access: a CIFS share cannot be created unless the volume is mounted at a junction path. ' +
          'Must start with "/". Set at creation time — PATCH /api/storage/volumes is blocked by ' +
          'the proxy rule engine after creation.'
      ),
  },
  outputSchema: {
    result: z.any().describe('ONTAP volume creation response with job UUID'),
  },
};

export const ontapVolumeListTool: ToolConfig = {
  name: 'ontap_volume_list',
  title: 'ONTAP List Volumes',
  description: 'Lists ONTAP volumes on the expert mode pool.' + ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    maxRecords: z.number().int().optional().describe('Maximum number of volumes to return'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP volume list response'),
  },
};

export const ontapVolumeGetTool: ToolConfig = {
  name: 'ontap_volume_get',
  title: 'ONTAP Get Volume',
  description: 'Gets details of a specific ONTAP volume by UUID.' + ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    volumeUuid: z.string().describe('UUID of the volume to retrieve'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP volume details'),
  },
};

export const ontapVolumeDeleteTool: ToolConfig = {
  name: 'ontap_volume_delete',
  title: 'ONTAP Delete Volume',
  description:
    'Deletes an ONTAP volume by UUID. Returns a preview first — show it to the user and get ' +
    'explicit confirmation before calling again with confirmDelete=true. Returns an async job UUID. ' +
    'Use ontap_job_get to poll until the job completes.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    volumeUuid: z.string().describe('UUID of the volume to delete'),
    ...confirmDeleteInput,
  },
  outputSchema: {
    result: z.any().describe('ONTAP volume deletion response with job UUID'),
  },
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const ontapJobGetTool: ToolConfig = {
  name: 'ontap_job_get',
  title: 'ONTAP Get Job Status',
  description:
    'Gets the status of an ONTAP async job by UUID. ' +
    'Poll this after create/delete operations until state is "success" or "failure".' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    jobUuid: z.string().describe('UUID of the ONTAP job to check'),
  },
  outputSchema: {
    result: z.any().describe('Job status with state and message'),
  },
};

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export const ontapSnapshotCreateTool: ToolConfig = {
  name: 'ontap_snapshot_create',
  title: 'ONTAP Create Snapshot',
  description:
    'Creates a snapshot of an ONTAP volume. Returns an async job UUID.' + ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    volumeUuid: z.string().describe('UUID of the volume to snapshot'),
    name: z.string().describe('Name for the snapshot'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP snapshot creation response with job UUID'),
  },
};

export const ontapSnapshotListTool: ToolConfig = {
  name: 'ontap_snapshot_list',
  title: 'ONTAP List Snapshots',
  description: 'Lists snapshots for a specific ONTAP volume.' + ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    volumeUuid: z.string().describe('UUID of the volume whose snapshots to list'),
    maxRecords: z.number().int().optional().describe('Maximum number of snapshots to return'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP snapshot list response'),
  },
};

export const ontapSnapshotDeleteTool: ToolConfig = {
  name: 'ontap_snapshot_delete',
  title: 'ONTAP Delete Snapshot',
  description:
    'Deletes a snapshot from an ONTAP volume. Returns a preview first — show it to the user and get ' +
    'explicit confirmation before calling again with confirmDelete=true. Returns an async job UUID.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    volumeUuid: z.string().describe('UUID of the volume that owns the snapshot'),
    snapshotUuid: z.string().describe('UUID of the snapshot to delete'),
    ...confirmDeleteInput,
  },
  outputSchema: {
    result: z.any().describe('ONTAP snapshot deletion response with job UUID'),
  },
};

// ---------------------------------------------------------------------------
// LUNs
// ---------------------------------------------------------------------------

export const ontapLunCreateTool: ToolConfig = {
  name: 'ontap_lun_create',
  title: 'ONTAP Create LUN',
  description:
    'Creates a LUN (Logical Unit Number) on an ONTAP volume. ' +
    'If svmName is not provided, it is auto-resolved via ontap_svm_list.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    name: z.string().describe('Name of the LUN (e.g. "/vol/vol1/lun1")'),
    volumeName: z.string().describe('Name of the volume to create the LUN in'),
    size: z.string().describe('LUN size (e.g. "1GB", "500MB")'),
    osType: z
      .enum(['linux', 'windows', 'vmware', 'aix', 'hpux', 'solaris', 'xen'])
      .describe('Host OS type for LUN geometry'),
    svmName: z.string().optional().describe('SVM name. Auto-resolved if not provided.'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP LUN creation response'),
  },
};

export const ontapLunListTool: ToolConfig = {
  name: 'ontap_lun_list',
  title: 'ONTAP List LUNs',
  description: 'Lists LUNs on the ONTAP expert mode pool.' + ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    maxRecords: z.number().int().optional().describe('Maximum number of LUNs to return'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP LUN list response'),
  },
};

export const ontapLunGetTool: ToolConfig = {
  name: 'ontap_lun_get',
  title: 'ONTAP Get LUN',
  description: 'Gets details of a specific LUN by UUID.' + ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    lunUuid: z.string().describe('UUID of the LUN to retrieve'),
  },
  outputSchema: {
    result: z.any().describe('ONTAP LUN details'),
  },
};

export const ontapLunDeleteTool: ToolConfig = {
  name: 'ontap_lun_delete',
  title: 'ONTAP Delete LUN',
  description:
    'Deletes a LUN by UUID. Returns a preview first — show it to the user and get explicit ' +
    'confirmation before calling again with confirmDelete=true.' +
    ONTAP_AUDIT_HINT,
  inputSchema: {
    ...ontapCommonInput,
    lunUuid: z.string().describe('UUID of the LUN to delete'),
    ...confirmDeleteInput,
  },
  outputSchema: {
    result: z.any().describe('ONTAP LUN deletion response'),
  },
};

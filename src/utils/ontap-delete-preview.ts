/**
 * Preview-first DELETE confirmation shared by ontap_execute and dedicated
 * ONTAP delete tools. Returns a structured preview until the caller sets
 * confirmDelete=true with confirmedResourceName matching the preview.
 *
 * The pending-preview map is per-process (not per-session). Safe because
 * stdio runs one process per session and HTTP/SSE is single-tenant — all
 * sessions share the same GCP auth context, so no cross-session privilege
 * escalation is possible.
 */

const PREVIEW_TTL_MS = 15 * 60 * 1000;

interface PendingDelete {
  toolName: string;
  projectId: string;
  locationId: string;
  storagePoolId: string;
  path: string;
  resourceName: string;
  expiresAt: number;
}

const pendingDeletes = new Map<string, PendingDelete>();

// Storage pool IDs are only unique within a (project, location), so the key
// must include both to prevent a confirmation issued for one pool from
// authorizing a DELETE against an identically-named pool in another project.
function pendingKey(
  toolName: string,
  projectId: string,
  locationId: string,
  storagePoolId: string,
  path: string
): string {
  return `${toolName}|${projectId}|${locationId}|${storagePoolId}|${path}`;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of pendingDeletes) {
    if (entry.expiresAt <= now) {
      pendingDeletes.delete(key);
    }
  }
}

/** Clears in-memory preview state (for tests). */
export function clearDeletePreviewStore(): void {
  pendingDeletes.clear();
}

/** Resolves a human-readable name for the delete target (GET with fallback). */
export async function resolveDeleteTargetName(
  client: { get: (path: string, params?: Record<string, string>) => Promise<unknown> },
  path: string
): Promise<string> {
  try {
    const record = (await client.get(path, { ontap_fields: 'name' })) as {
      name?: string;
    };
    const name = typeof record?.name === 'string' ? record.name.trim() : '';
    if (name) {
      return name;
    }
  } catch {
    // Fall back to the last path segment when GET fails or has no name.
  }

  const last = path.replace(/\/+$/, '').split('/').filter(Boolean).pop();
  return last ?? path;
}

export interface DeletePreviewParams {
  toolName: string;
  /** GCP project hosting the storage pool. Part of the pending-delete key. */
  projectId: string;
  /** GCP location/region of the storage pool. Part of the pending-delete key. */
  locationId: string;
  /** Storage pool ID. Only unique within (projectId, locationId). */
  storagePoolId: string;
  path: string;
  /** Authoritative resource name shown to the user and stored at preview time. */
  resourceName: string;
  confirmDelete?: boolean;
  /** Must exactly match resourceName from the preview before DELETE executes. */
  confirmedResourceName?: string;
}

export interface DeletePreviewResponse {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { result: Record<string, unknown> };
}

function buildPreviewPayload(params: DeletePreviewParams): Record<string, unknown> {
  return {
    action: 'confirm_delete',
    method: 'DELETE',
    tool: params.toolName,
    path: params.path,
    resourceName: params.resourceName,
    projectId: params.projectId,
    locationId: params.locationId,
    storagePoolId: params.storagePoolId,
    confirmationField: 'confirmedResourceName',
    message: 'This DELETE operation requires explicit user confirmation before execution.',
    instruction:
      `Show the user the resource that will be deleted ("${params.resourceName}", pool ${params.storagePoolId} ` +
      `in ${params.projectId}/${params.locationId}) and ask for their explicit YES. ` +
      `Only call ${params.toolName} again with confirmDelete=true ` +
      `and confirmedResourceName set to the exact resourceName from this preview ("${params.resourceName}"). ` +
      'Do NOT set confirmDelete=true on your own.',
  };
}

function buildFailurePayload(
  params: DeletePreviewParams,
  reason: string,
  detail: string,
  expectedResourceName?: string
): Record<string, unknown> {
  const expected = expectedResourceName ?? params.resourceName;
  return {
    action: 'delete_confirmation_failed',
    method: 'DELETE',
    tool: params.toolName,
    path: params.path,
    resourceName: expected || params.resourceName,
    projectId: params.projectId,
    locationId: params.locationId,
    storagePoolId: params.storagePoolId,
    reason,
    message: detail,
    instruction:
      `Call ${params.toolName} without confirmDelete first to obtain a fresh preview, then retry with ` +
      `confirmDelete=true and confirmedResourceName="${expected}" after the user approves.`,
  };
}

export function buildDeletePreviewResponse(params: DeletePreviewParams): DeletePreviewResponse {
  const preview = buildPreviewPayload(params);

  return {
    content: [{ type: 'text', text: JSON.stringify(preview, null, 2) }],
    structuredContent: { result: preview },
  };
}

function buildDeleteFailureResponse(
  params: DeletePreviewParams,
  reason: string,
  detail: string,
  expectedResourceName?: string
): DeletePreviewResponse {
  const payload = buildFailurePayload(params, reason, detail, expectedResourceName);

  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: { result: payload },
  };
}

function keyFor(params: DeletePreviewParams): string {
  return pendingKey(
    params.toolName,
    params.projectId,
    params.locationId,
    params.storagePoolId,
    params.path
  );
}

function registerPendingDelete(params: DeletePreviewParams): void {
  pruneExpired();
  pendingDeletes.set(keyFor(params), {
    toolName: params.toolName,
    projectId: params.projectId,
    locationId: params.locationId,
    storagePoolId: params.storagePoolId,
    path: params.path,
    resourceName: params.resourceName,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  });
}

function getPendingDelete(params: DeletePreviewParams): PendingDelete | undefined {
  pruneExpired();
  return pendingDeletes.get(keyFor(params));
}

function consumePendingDelete(params: DeletePreviewParams): void {
  pendingDeletes.delete(keyFor(params));
}

/**
 * Returns a preview or failure response when confirmation is missing or invalid;
 * null when the DELETE may proceed.
 */
export function requireDeleteConfirmation(
  params: DeletePreviewParams
): DeletePreviewResponse | null {
  if (params.confirmDelete !== true) {
    registerPendingDelete(params);
    return buildDeletePreviewResponse(params);
  }

  const { confirmedResourceName } = params;
  if (!confirmedResourceName?.trim()) {
    return buildDeleteFailureResponse(
      params,
      'missing_confirmed_resource_name',
      'DELETE requires confirmedResourceName matching the preview resourceName.'
    );
  }

  const pending = getPendingDelete(params);
  if (!pending) {
    return buildDeleteFailureResponse(
      params,
      'no_matching_preview',
      'No active delete preview for this tool, pool, and path. Request a preview first.'
    );
  }

  if (confirmedResourceName !== pending.resourceName) {
    return buildDeleteFailureResponse(
      params,
      'resource_name_mismatch',
      `confirmedResourceName must exactly match the preview resourceName ("${pending.resourceName}").`,
      pending.resourceName
    );
  }

  consumePendingDelete(params);
  return null;
}

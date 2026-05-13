import { describe, it, expect, beforeEach } from 'vitest';
import {
  requireDeleteConfirmation,
  clearDeletePreviewStore,
  resolveDeleteTargetName,
} from './ontap-delete-preview.js';

const baseParams = {
  toolName: 'ontap_volume_delete',
  projectId: 'proj-a',
  locationId: 'us-east1',
  storagePoolId: 'pool-1',
  path: '/api/storage/volumes/vol-1',
  resourceName: 'prod-db',
};

describe('requireDeleteConfirmation', () => {
  beforeEach(() => {
    clearDeletePreviewStore();
  });

  it('returns preview and registers pending delete when confirmDelete is not set', () => {
    const preview = requireDeleteConfirmation(baseParams);
    expect(preview).not.toBeNull();
    const result = preview!.structuredContent.result;
    expect(result.action).toBe('confirm_delete');
    expect(result.resourceName).toBe('prod-db');
    expect(result.confirmationField).toBe('confirmedResourceName');
  });

  it('allows DELETE when confirmDelete and confirmedResourceName match a prior preview', () => {
    requireDeleteConfirmation(baseParams);
    const allowed = requireDeleteConfirmation({
      ...baseParams,
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(allowed).toBeNull();
  });

  it('rejects execute without confirmedResourceName', () => {
    requireDeleteConfirmation(baseParams);
    const rejected = requireDeleteConfirmation({
      ...baseParams,
      confirmDelete: true,
    });
    expect(rejected?.structuredContent.result.action).toBe('delete_confirmation_failed');
    expect(rejected?.structuredContent.result.reason).toBe('missing_confirmed_resource_name');
  });

  it('rejects when confirmedResourceName does not match previewed name', () => {
    requireDeleteConfirmation(baseParams);
    const rejected = requireDeleteConfirmation({
      ...baseParams,
      confirmDelete: true,
      confirmedResourceName: 'staging-db',
    });
    expect(rejected?.structuredContent.result.action).toBe('delete_confirmation_failed');
    expect(rejected?.structuredContent.result.reason).toBe('resource_name_mismatch');
  });

  it('rejects execute without a prior preview for the same target', () => {
    const rejected = requireDeleteConfirmation({
      ...baseParams,
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(rejected?.structuredContent.result.reason).toBe('no_matching_preview');
  });

  it('rejects when preview was for a different path than execute', () => {
    requireDeleteConfirmation(baseParams);
    const rejected = requireDeleteConfirmation({
      ...baseParams,
      path: '/api/storage/volumes/vol-2',
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(rejected?.structuredContent.result.reason).toBe('no_matching_preview');
  });

  it('rejects when preview was for a different project than execute', () => {
    requireDeleteConfirmation(baseParams);
    const rejected = requireDeleteConfirmation({
      ...baseParams,
      projectId: 'proj-b',
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(rejected?.structuredContent.result.reason).toBe('no_matching_preview');
  });

  it('rejects when preview was for a different location than execute', () => {
    requireDeleteConfirmation(baseParams);
    const rejected = requireDeleteConfirmation({
      ...baseParams,
      locationId: 'us-west1',
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(rejected?.structuredContent.result.reason).toBe('no_matching_preview');
  });

  it('keeps pending previews isolated across (project, location, pool) tuples', () => {
    requireDeleteConfirmation({ ...baseParams, projectId: 'proj-a' });
    requireDeleteConfirmation({ ...baseParams, projectId: 'proj-b' });

    const confirmA = requireDeleteConfirmation({
      ...baseParams,
      projectId: 'proj-a',
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(confirmA).toBeNull();

    const confirmB = requireDeleteConfirmation({
      ...baseParams,
      projectId: 'proj-b',
      confirmDelete: true,
      confirmedResourceName: 'prod-db',
    });
    expect(confirmB).toBeNull();
  });

  it('includes projectId and locationId in the preview payload', () => {
    const preview = requireDeleteConfirmation(baseParams);
    const result = preview!.structuredContent.result;
    expect(result.projectId).toBe('proj-a');
    expect(result.locationId).toBe('us-east1');
    expect(result.storagePoolId).toBe('pool-1');
    expect(result.instruction).toContain('proj-a/us-east1');
  });
});

describe('resolveDeleteTargetName', () => {
  it('returns the name field from GET when present', async () => {
    const client = {
      get: async () => ({ name: 'my-volume' }),
    };
    const name = await resolveDeleteTargetName(client, '/api/storage/volumes/uuid-1');
    expect(name).toBe('my-volume');
  });

  it('falls back to the last path segment when GET has no name', async () => {
    const client = {
      get: async () => ({}),
    };
    const name = await resolveDeleteTargetName(client, '/api/cluster/peers/peer-uuid');
    expect(name).toBe('peer-uuid');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ontapSvmListHandler,
  ontapVolumeCreateHandler,
  ontapVolumeDeleteHandler,
  ontapVolumeListHandler,
  ontapVolumeGetHandler,
  ontapJobGetHandler,
  ontapSnapshotCreateHandler,
  ontapSnapshotListHandler,
  ontapSnapshotDeleteHandler,
  ontapLunCreateHandler,
  ontapLunListHandler,
  ontapLunGetHandler,
  ontapLunDeleteHandler,
} from './ontap-handler.js';
import { clearDeletePreviewStore } from '../../utils/ontap-delete-preview.js';

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../utils/ontap-http-client.js', () => ({
  OntapHttpClient: { create: vi.fn() },
}));

vi.mock('../../logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const baseArgs = {
  projectId: 'my-project',
  locationId: 'us-east1',
  storagePoolId: 'pool1',
};

describe('dedicated ONTAP handlers', () => {
  beforeEach(async () => {
    clearDeletePreviewStore();
    mockClient.get.mockReset();
    mockClient.post.mockReset();
    mockClient.delete.mockReset();
    const { OntapHttpClient } = await import('../../utils/ontap-http-client.js');
    (OntapHttpClient.create as any).mockReturnValue(mockClient);
  });

  describe('ontapSvmListHandler', () => {
    it('auto-extracts svmName and aggregateName', async () => {
      mockClient.get.mockResolvedValue({
        records: [{ name: 'svm1', aggregates: [{ name: 'aggr1' }] }],
      });
      const result = await ontapSvmListHandler(baseArgs);
      const data = result.structuredContent as any;

      expect(data.result.svmName).toBe('svm1');
      expect(data.result.aggregateName).toBe('aggr1');
    });

    it('returns null for svmName when no SVMs', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      const result = await ontapSvmListHandler(baseArgs);
      const data = result.structuredContent as any;

      expect(data.result.svmName).toBeNull();
      expect(data.result.aggregateName).toBeNull();
    });

    it('returns error response when SVM listing fails', async () => {
      mockClient.get.mockRejectedValue(new Error('svm-list-failed'));
      const result = await ontapSvmListHandler(baseArgs);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('svm-list-failed');
    });
  });

  describe('ontapVolumeCreateHandler', () => {
    it('auto-resolves SVM/aggregate when not provided', async () => {
      mockClient.get.mockResolvedValue({
        records: [{ name: 'svm1', aggregates: [{ name: 'aggr1' }] }],
      });
      mockClient.post.mockResolvedValue({ job: { uuid: 'j1' } });

      const result = await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'vol1',
        size: '2GB',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/storage/volumes', {
        name: 'vol1',
        svm: { name: 'svm1' },
        aggregates: [{ name: 'aggr1' }],
        size: '2GB',
      });

      const data = result.structuredContent as any;
      expect(data.result.asyncJobDetected).toBe(true);
      expect(data.result.pollingGuidance).toContain('j1');
    });

    it('uses provided SVM/aggregate without auto-resolve', async () => {
      mockClient.post.mockResolvedValue({ job: { uuid: 'j2' } });

      await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'vol1',
        size: '2GB',
        svmName: 'my-svm',
        aggregateName: 'my-aggr',
      });

      expect(mockClient.get).not.toHaveBeenCalled();
      expect(mockClient.post).toHaveBeenCalledWith('/api/storage/volumes', {
        name: 'vol1',
        svm: { name: 'my-svm' },
        aggregates: [{ name: 'my-aggr' }],
        size: '2GB',
      });
    });

    it('includes nas.path when nasPath is provided', async () => {
      mockClient.post.mockResolvedValue({ records: [{ uuid: 'vol-1' }] });
      await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'vol2',
        size: '3GB',
        svmName: 'my-svm',
        aggregateName: 'my-aggr',
        nasPath: '/vol2',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/storage/volumes', {
        name: 'vol2',
        svm: { name: 'my-svm' },
        aggregates: [{ name: 'my-aggr' }],
        size: '3GB',
        nas: { path: '/vol2' },
      });
    });

    it('returns non-async success when create response has no job uuid', async () => {
      mockClient.post.mockResolvedValue({ records: [{ uuid: 'vol-no-job' }] });
      const result = await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'vol-no-job',
        size: '1GB',
        svmName: 'my-svm',
        aggregateName: 'my-aggr',
      });
      expect((result.structuredContent as any).result.records[0].uuid).toBe('vol-no-job');
      expect((result.structuredContent as any).result.asyncJobDetected).toBeUndefined();
    });

    it('returns error when auto-resolve finds no SVMs', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      const result = await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'vol-bad',
        size: '1GB',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No SVMs found');
    });

    it('returns error when auto-resolve SVM has no aggregates', async () => {
      mockClient.get.mockResolvedValue({ records: [{ name: 'svm-no-aggr', aggregates: [] }] });
      const result = await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'vol-bad',
        size: '1GB',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('has no aggregates');
    });
  });

  describe('ontapVolumeDeleteHandler', () => {
    it('returns delete preview when confirmDelete is not set', async () => {
      mockClient.get.mockResolvedValue({ name: 'prod-vol' });
      const result = await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
      });
      const data = result.structuredContent as any;
      expect(data.result.action).toBe('confirm_delete');
      expect(data.result.tool).toBe('ontap_volume_delete');
      expect(data.result.resourceName).toBe('prod-vol');
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('rejects delete when confirmedResourceName does not match previewed resource', async () => {
      mockClient.get.mockResolvedValue({ name: 'prod-vol' });
      await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
      });
      const result = await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
        confirmDelete: true,
        confirmedResourceName: 'staging-vol',
      });
      const data = result.structuredContent as any;
      expect(data.result.action).toBe('delete_confirmation_failed');
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('returns pollingGuidance when job UUID present and confirmDelete=true', async () => {
      mockClient.get.mockResolvedValue({ name: 'prod-vol' });
      mockClient.delete.mockResolvedValue({ job: { uuid: 'del-job' } });
      await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
      });
      const result = await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
        confirmDelete: true,
        confirmedResourceName: 'prod-vol',
      });
      const data = result.structuredContent as any;
      expect(data.result.asyncJobDetected).toBe(true);
      expect(data.result.pollingGuidance).toContain('del-job');
      expect(mockClient.delete).toHaveBeenCalledWith('/api/storage/volumes/v-uuid');
    });

    it('returns non-async delete success when response has no job uuid', async () => {
      mockClient.get.mockResolvedValue({ name: 'prod-vol' });
      mockClient.delete.mockResolvedValue({ deleted: true });
      await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
      });
      const result = await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
        confirmDelete: true,
        confirmedResourceName: 'prod-vol',
      });
      expect((result.structuredContent as any).result.deleted).toBe(true);
      expect((result.structuredContent as any).result.asyncJobDetected).toBeUndefined();
    });

    it('falls back to uuid path segment when volume target-name resolution fails during preview', async () => {
      mockClient.get.mockRejectedValue(new Error('resolve-failed'));
      const result = await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid',
      });
      const data = result.structuredContent as any;
      expect(data.result.action).toBe('confirm_delete');
      expect(data.result.resourceName).toBe('v-uuid');
      expect(result.content[0].text).toContain('confirm_delete');
    });
  });

  describe('ontapVolumeListHandler', () => {
    it('passes maxRecords as query param', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      await ontapVolumeListHandler({
        ...baseArgs,
        maxRecords: 10,
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/volumes', {
        max_records: '10',
      });
    });

    it('calls without query params when no options provided', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      await ontapVolumeListHandler(baseArgs);
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/volumes', {});
    });

    it('returns error response when list fails', async () => {
      mockClient.get.mockRejectedValue(new Error('volume-list-failed'));
      const result = await ontapVolumeListHandler(baseArgs);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('volume-list-failed');
    });
  });

  describe('ontapVolumeGetHandler', () => {
    it('calls correct path with volume UUID (no field filtering)', async () => {
      mockClient.get.mockResolvedValue({ name: 'vol1' });
      await ontapVolumeGetHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid-1',
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/volumes/v-uuid-1');
    });

    it('returns error response on get failure', async () => {
      mockClient.get.mockRejectedValue(new Error('volume-get-failed'));
      const result = await ontapVolumeGetHandler({
        ...baseArgs,
        volumeUuid: 'v-uuid-1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('volume-get-failed');
    });
  });

  describe('ontapJobGetHandler', () => {
    it('returns state and message', async () => {
      mockClient.get.mockResolvedValue({ state: 'success', message: 'Volume created' });
      const result = await ontapJobGetHandler({
        ...baseArgs,
        jobUuid: 'job-1',
      });
      const data = result.structuredContent as any;
      expect(data.result.state).toBe('success');
      expect(data.result.message).toBe('Volume created');
    });

    it('returns error response when job lookup fails', async () => {
      mockClient.get.mockRejectedValue(new Error('job-get-failed'));
      const result = await ontapJobGetHandler({
        ...baseArgs,
        jobUuid: 'job-1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('job-get-failed');
    });
  });

  describe('ontapSnapshotCreateHandler', () => {
    it('uses correct path with volumeUuid', async () => {
      mockClient.post.mockResolvedValue({ job: { uuid: 'snap-job' } });
      const result = await ontapSnapshotCreateHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        name: 'snap1',
      });
      expect(mockClient.post).toHaveBeenCalledWith('/api/storage/volumes/v1/snapshots', {
        name: 'snap1',
      });
      const data = result.structuredContent as any;
      expect(data.result.asyncJobDetected).toBe(true);
    });

    it('returns error response on snapshot create failure', async () => {
      mockClient.post.mockRejectedValue(new Error('snap-create-failed'));
      const result = await ontapSnapshotCreateHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        name: 'snap1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('snap-create-failed');
    });
  });

  describe('ontapSnapshotListHandler', () => {
    it('uses correct path with volumeUuid', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      await ontapSnapshotListHandler({
        ...baseArgs,
        volumeUuid: 'v1',
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/volumes/v1/snapshots', {});
    });

    it('passes maxRecords as query param', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      await ontapSnapshotListHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        maxRecords: 50,
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/volumes/v1/snapshots', {
        max_records: '50',
      });
    });

    it('returns error response on snapshot list failure', async () => {
      mockClient.get.mockRejectedValue(new Error('snap-list-failed'));
      const result = await ontapSnapshotListHandler({
        ...baseArgs,
        volumeUuid: 'v1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('snap-list-failed');
    });
  });

  describe('ontapSnapshotDeleteHandler', () => {
    it('uses correct compound path', async () => {
      mockClient.get.mockResolvedValue({ name: 'snap1' });
      mockClient.delete.mockResolvedValue({ job: { uuid: 'sdel-job' } });
      await ontapSnapshotDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        snapshotUuid: 's1',
      });
      const result = await ontapSnapshotDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        snapshotUuid: 's1',
        confirmDelete: true,
        confirmedResourceName: 'snap1',
      });
      expect(mockClient.delete).toHaveBeenCalledWith('/api/storage/volumes/v1/snapshots/s1');
      const data = result.structuredContent as any;
      expect(data.result.asyncJobDetected).toBe(true);
    });

    it('falls back to uuid path segment when snapshot target-name resolution fails during preview', async () => {
      mockClient.get.mockRejectedValue(new Error('snap-resolve-failed'));
      const result = await ontapSnapshotDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        snapshotUuid: 's1',
      });
      const data = result.structuredContent as any;
      expect(data.result.action).toBe('confirm_delete');
      expect(data.result.resourceName).toBe('s1');
      expect(result.content[0].text).toContain('confirm_delete');
    });

    it('returns error when snapshot delete fails after confirmation', async () => {
      mockClient.get.mockResolvedValue({ name: 'snap1' });
      mockClient.delete.mockRejectedValue(new Error('snap-delete-failed'));
      await ontapSnapshotDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        snapshotUuid: 's1',
      });
      const result = await ontapSnapshotDeleteHandler({
        ...baseArgs,
        volumeUuid: 'v1',
        snapshotUuid: 's1',
        confirmDelete: true,
        confirmedResourceName: 'snap1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('snap-delete-failed');
    });
  });

  describe('ontapLunCreateHandler', () => {
    it('auto-resolves SVM when not provided', async () => {
      mockClient.get.mockResolvedValue({
        records: [{ name: 'svm1', aggregates: [{ name: 'aggr1' }] }],
      });
      mockClient.post.mockResolvedValue({ records: [{ uuid: 'lun1' }] });

      await ontapLunCreateHandler({
        ...baseArgs,
        name: '/vol/vol1/lun1',
        volumeName: 'vol1',
        size: '1GB',
        osType: 'linux',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/storage/luns', {
        name: '/vol/vol1/lun1',
        svm: { name: 'svm1' },
        location: { volume: { name: 'vol1' } },
        os_type: 'linux',
        space: { size: '1GB' },
      });
    });

    it('uses provided svmName without auto-resolve', async () => {
      mockClient.post.mockResolvedValue({ records: [{ uuid: 'lun1' }] });
      await ontapLunCreateHandler({
        ...baseArgs,
        name: '/vol/vol1/lun1',
        volumeName: 'vol1',
        size: '1GB',
        osType: 'linux',
        svmName: 'provided-svm',
      });
      expect(mockClient.get).not.toHaveBeenCalled();
      expect(mockClient.post).toHaveBeenCalledWith('/api/storage/luns', {
        name: '/vol/vol1/lun1',
        svm: { name: 'provided-svm' },
        location: { volume: { name: 'vol1' } },
        os_type: 'linux',
        space: { size: '1GB' },
      });
    });

    it('returns error response when lun create fails', async () => {
      mockClient.post.mockRejectedValue(new Error('lun-create-failed'));
      const result = await ontapLunCreateHandler({
        ...baseArgs,
        name: '/vol/vol1/lun1',
        volumeName: 'vol1',
        size: '1GB',
        osType: 'linux',
        svmName: 'provided-svm',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('lun-create-failed');
    });
  });

  describe('ontapLunListHandler', () => {
    it('passes maxRecords as query param', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      await ontapLunListHandler({
        ...baseArgs,
        maxRecords: 5,
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/luns', {
        max_records: '5',
      });
    });

    it('calls with empty query params when maxRecords omitted', async () => {
      mockClient.get.mockResolvedValue({ records: [] });
      await ontapLunListHandler(baseArgs);
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/luns', {});
    });

    it('returns error response when list fails', async () => {
      mockClient.get.mockRejectedValue(new Error('lun-list-failed'));
      const result = await ontapLunListHandler(baseArgs);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('lun-list-failed');
    });
  });

  describe('ontapLunGetHandler', () => {
    it('uses correct path with lun UUID (no field filtering)', async () => {
      mockClient.get.mockResolvedValue({ name: 'lun1' });
      await ontapLunGetHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/storage/luns/lun-uuid-1');
    });

    it('returns error response on get failure', async () => {
      mockClient.get.mockRejectedValue(new Error('lun-get-failed'));
      const result = await ontapLunGetHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('lun-get-failed');
    });
  });

  describe('ontapLunDeleteHandler', () => {
    it('uses correct path /api/storage/luns/{uuid}', async () => {
      mockClient.get.mockResolvedValue({ name: '/vol/vol1/lun1' });
      mockClient.delete.mockResolvedValue({});
      await ontapLunDeleteHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
      });
      await ontapLunDeleteHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
        confirmDelete: true,
        confirmedResourceName: '/vol/vol1/lun1',
      });
      expect(mockClient.delete).toHaveBeenCalledWith('/api/storage/luns/lun-uuid-1');
    });

    it('falls back to uuid path segment when target-name resolution fails during preview', async () => {
      mockClient.get.mockRejectedValue(new Error('boom-resolve'));
      const result = await ontapLunDeleteHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
      });
      const data = result.structuredContent as any;
      expect(data.result.action).toBe('confirm_delete');
      expect(data.result.resourceName).toBe('lun-uuid-1');
      expect(result.content[0].text).toContain('confirm_delete');
    });

    it('returns error response when DELETE call fails after confirmation', async () => {
      mockClient.get.mockResolvedValue({ name: '/vol/vol1/lun1' });
      mockClient.delete.mockRejectedValue(new Error('boom-delete'));
      await ontapLunDeleteHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
      });
      const result = await ontapLunDeleteHandler({
        ...baseArgs,
        lunUuid: 'lun-uuid-1',
        confirmDelete: true,
        confirmedResourceName: '/vol/vol1/lun1',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('boom-delete');
    });
  });

  describe('non-async responses', () => {
    it('SVM list does NOT include pollingGuidance', async () => {
      mockClient.get.mockResolvedValue({
        records: [{ name: 'svm1', aggregates: [{ name: 'aggr1' }] }],
      });
      const result = await ontapSvmListHandler(baseArgs);
      const data = result.structuredContent as any;
      expect(data.result.asyncJobDetected).toBeUndefined();
      expect(data.result.pollingGuidance).toBeUndefined();
    });
  });

  describe('error fallback hint', () => {
    it('includes discover+execute fallback when a typed ONTAP tool fails', async () => {
      mockClient.get.mockResolvedValue({ name: 'fc-vol' });
      mockClient.delete.mockRejectedValue(new Error('FlexCache volumes require a different API'));
      await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'fc-uuid',
      });
      const result = await ontapVolumeDeleteHandler({
        ...baseArgs,
        volumeUuid: 'fc-uuid',
        confirmDelete: true,
        confirmedResourceName: 'fc-vol',
      });
      expect(result.isError).toBe(true);
      const text = result.content[0].text;
      expect(text).toContain('ontap_discover');
      expect(text).toContain('ontap_execute');
    });
  });
});

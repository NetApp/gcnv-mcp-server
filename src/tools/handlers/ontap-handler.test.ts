import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ontapSvmListHandler,
  ontapVolumeCreateHandler,
  ontapVolumeListHandler,
  ontapVolumeGetHandler,
  ontapJobGetHandler,
  ontapSnapshotCreateHandler,
  ontapSnapshotListHandler,
  ontapLunCreateHandler,
  ontapLunListHandler,
  ontapLunGetHandler,
} from './ontap-handler.js';

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
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
    mockClient.get.mockReset();
    mockClient.post.mockReset();
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
      mockClient.post.mockRejectedValue(new Error('FlexCache volumes require a different API'));
      const result = await ontapVolumeCreateHandler({
        ...baseArgs,
        name: 'fc-vol',
        size: '2GB',
        svmName: 'my-svm',
        aggregateName: 'my-aggr',
      });
      expect(result.isError).toBe(true);
      const text = result.content[0].text;
      expect(text).toContain('ontap_discover');
      expect(text).toContain('ontap_execute');
    });
  });
});

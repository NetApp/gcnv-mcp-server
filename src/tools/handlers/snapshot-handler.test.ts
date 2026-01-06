import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('snapshot-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createSnapshotHandler calls createSnapshot and returns operationId', async () => {
    const createSnapshot = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createSnapshot });

    const { createSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await createSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
      description: 'd',
    });

    expect(createSnapshot).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      snapshotId: 's1',
      snapshot: { description: 'd', labels: undefined },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
      operationId: 'op-create',
    });
  });

  it('createSnapshotHandler includes labels when provided and handles empty operation.name', async () => {
    const createSnapshot = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ createSnapshot });

    const { createSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await createSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
      labels: { a: 'b' },
    });

    expect(createSnapshot).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      snapshotId: 's1',
      snapshot: { description: undefined, labels: { a: 'b' } },
    });
    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('createSnapshotHandler covers error path', async () => {
    const createSnapshot = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ createSnapshot });

    const { createSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await createSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('deleteSnapshotHandler calls deleteSnapshot and returns operationId', async () => {
    const deleteSnapshot = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteSnapshot });

    const { deleteSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await deleteSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(deleteSnapshot).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteSnapshotHandler falls back to empty operationId when operation.name is missing', async () => {
    const deleteSnapshot = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteSnapshot });

    const { deleteSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await deleteSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('deleteSnapshotHandler covers error path', async () => {
    const deleteSnapshot = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ deleteSnapshot });

    const { deleteSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await deleteSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('getSnapshotHandler calls getSnapshot and returns formatted snapshot', async () => {
    const getSnapshot = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getSnapshot });

    const { getSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await getSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(getSnapshot).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
      snapshotId: 's1',
      volumeId: 'vol1',
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getSnapshotHandler handles snapshot name without /volumes/../snapshots pattern (covers regex false branch)', async () => {
    const getSnapshot = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/snapshots/s1',
      },
    ]);
    createClientMock.mockReturnValue({ getSnapshot });

    const { getSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await getSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    // snapshotId extracted from name, but volumeId should not be present
    expect(result.structuredContent).toMatchObject({ snapshotId: 's1' });
    expect((result.structuredContent as any).volumeId).toBeUndefined();
  });

  it('getSnapshotHandler covers error path', async () => {
    const getSnapshot = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ getSnapshot });

    const { getSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await getSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('getSnapshotHandler returns empty structuredContent when snapshot is undefined', async () => {
    const getSnapshot = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getSnapshot });

    const { getSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await getSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(result.structuredContent).toEqual({});
  });

  it('getSnapshotHandler formats state/description/labels when present', async () => {
    const getSnapshot = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
        state: 'READY',
        description: 'd',
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getSnapshot });

    const { getSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await getSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(result.structuredContent).toMatchObject({
      snapshotId: 's1',
      volumeId: 'vol1',
      state: 'READY',
      description: 'd',
      labels: { a: 'b' },
    });
    expect((result.structuredContent as any).createTime).toBeUndefined();
  });

  it('listSnapshotsHandler calls listSnapshots and returns formatted list', async () => {
    const listSnapshots = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1' }],
        undefined,
        'next',
      ]);
    createClientMock.mockReturnValue({ listSnapshots });

    const { listSnapshotsHandler } = await import('./snapshot-handler.js');
    const result = await listSnapshotsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect(listSnapshots).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
    });
    expect(result.structuredContent).toMatchObject({
      snapshots: [expect.objectContaining({ snapshotId: 's1', volumeId: 'vol1' })],
      nextPageToken: 'next',
    });
  });

  it('listSnapshotsHandler passes filter/pageSize/pageToken when provided', async () => {
    const listSnapshots = vi.fn().mockResolvedValue([[], undefined, 'next']);
    createClientMock.mockReturnValue({ listSnapshots });

    const { listSnapshotsHandler } = await import('./snapshot-handler.js');
    const result = await listSnapshotsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
    });

    expect(listSnapshots).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
    });
    expect(result.structuredContent).toMatchObject({ snapshots: [], nextPageToken: 'next' });
  });

  it('listSnapshotsHandler uses empty nextPageToken when API returns undefined (covers nextPageToken || \"\" branches)', async () => {
    const listSnapshots = vi.fn().mockResolvedValue([[], undefined, undefined]);
    createClientMock.mockReturnValue({ listSnapshots });

    const { listSnapshotsHandler } = await import('./snapshot-handler.js');
    const result = await listSnapshotsHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect(result.structuredContent).toEqual({ snapshots: [], nextPageToken: '' });
  });

  it('revertVolumeToSnapshotHandler calls revertVolume and returns operationId', async () => {
    const revertVolume = vi.fn().mockResolvedValue([{ name: 'op-rev' }]);
    createClientMock.mockReturnValue({ revertVolume });

    const { revertVolumeToSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await revertVolumeToSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(revertVolume).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1',
      snapshot: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-rev' });
  });

  it('revertVolumeToSnapshotHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const revertVolume = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ revertVolume });

    const { revertVolumeToSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await revertVolumeToSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('updateSnapshotHandler calls updateSnapshot with updateMask', async () => {
    const updateSnapshot = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateSnapshot });

    const { updateSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await updateSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
      labels: { a: 'b' },
    });

    expect(updateSnapshot).toHaveBeenCalledTimes(1);
    expect(updateSnapshot.mock.calls[0]?.[0]).toMatchObject({
      snapshot: {
        name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
        labels: { a: 'b' },
      },
      updateMask: { paths: ['labels'] },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
      operationId: 'op-upd',
    });
  });

  it('updateSnapshotHandler can update both description and labels', async () => {
    const updateSnapshot = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateSnapshot });

    const { updateSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await updateSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
      description: 'd',
      labels: { a: 'b' },
    });

    expect(updateSnapshot.mock.calls[0]?.[0]).toMatchObject({
      snapshot: {
        name: 'projects/p1/locations/us-central1/volumes/vol1/snapshots/s1',
        description: 'd',
        labels: { a: 'b' },
      },
      updateMask: { paths: expect.arrayContaining(['description', 'labels']) },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd2' });
  });

  it('updateSnapshotHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const updateSnapshot = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ updateSnapshot });

    const { updateSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await updateSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
      labels: { a: 'b' },
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('covers error path for updateSnapshotHandler', async () => {
    const updateSnapshot = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ updateSnapshot });

    const { updateSnapshotHandler } = await import('./snapshot-handler.js');
    const result = await updateSnapshotHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      snapshotId: 's1',
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
  });

  it('covers error paths for listSnapshotsHandler and revertVolumeToSnapshotHandler', async () => {
    const err = new Error('boom');

    const listSnapshots = vi.fn().mockRejectedValue(err);
    const revertVolume = vi.fn().mockRejectedValue(err);
    createClientMock.mockReturnValue({ listSnapshots, revertVolume });

    const { listSnapshotsHandler, revertVolumeToSnapshotHandler } =
      await import('./snapshot-handler.js');

    expect(
      (
        (await listSnapshotsHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
        })) as any
      ).isError
    ).toBe(true);

    expect(
      (
        (await revertVolumeToSnapshotHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          snapshotId: 's1',
        })) as any
      ).isError
    ).toBe(true);
  });

  it('returns Unknown error for each handler when the underlying client call throws without message', async () => {
    const err = {};
    createClientMock.mockReturnValue({
      createSnapshot: vi.fn().mockRejectedValue(err),
      deleteSnapshot: vi.fn().mockRejectedValue(err),
      getSnapshot: vi.fn().mockRejectedValue(err),
      listSnapshots: vi.fn().mockRejectedValue(err),
      revertVolume: vi.fn().mockRejectedValue(err),
      updateSnapshot: vi.fn().mockRejectedValue(err),
    });

    const {
      createSnapshotHandler,
      deleteSnapshotHandler,
      getSnapshotHandler,
      listSnapshotsHandler,
      revertVolumeToSnapshotHandler,
      updateSnapshotHandler,
    } = await import('./snapshot-handler.js');

    expect(
      (
        (await createSnapshotHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          snapshotId: 's1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await deleteSnapshotHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          snapshotId: 's1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await getSnapshotHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          snapshotId: 's1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await listSnapshotsHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await revertVolumeToSnapshotHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          snapshotId: 's1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await updateSnapshotHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          snapshotId: 's1',
          description: 'd',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');
  });
});

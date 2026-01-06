import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('backup-policy-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createBackupPolicyHandler calls createBackupPolicy and returns operationId', async () => {
    const createBackupPolicy = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createBackupPolicy });

    const { createBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await createBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      dailyBackupLimit: 1,
    });

    expect(createBackupPolicy).toHaveBeenCalledTimes(1);
    expect(createBackupPolicy.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1',
      backupPolicyId: 'bp1',
      backupPolicy: { dailyBackupLimit: 1 },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupPolicy/bp1',
      operationId: 'op-create',
    });
  });

  it('createBackupPolicyHandler falls back to empty operationId when operation.name is missing', async () => {
    const createBackupPolicy = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ createBackupPolicy });

    const { createBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await createBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      dailyBackupLimit: 1,
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupPolicy/bp1',
      operationId: '',
    });
  });

  it('createBackupPolicyHandler filters undefined fields out of backupPolicy payload', async () => {
    const createBackupPolicy = vi.fn().mockResolvedValue([{ name: 'op-create2' }]);
    createClientMock.mockReturnValue({ createBackupPolicy });

    const { createBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await createBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      dailyBackupLimit: 1,
      weeklyBackupLimit: undefined,
      monthlyBackupLimit: 2,
      description: undefined,
      enabled: true,
      labels: { a: 'b' },
    });

    const req = createBackupPolicy.mock.calls[0]?.[0];
    expect(req.backupPolicy).toEqual({
      dailyBackupLimit: 1,
      monthlyBackupLimit: 2,
      enabled: true,
      labels: { a: 'b' },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create2' });
  });

  it('deleteBackupPolicyHandler calls deleteBackupPolicy and returns success', async () => {
    const deleteBackupPolicy = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteBackupPolicy });

    const { deleteBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await deleteBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
    });

    expect(deleteBackupPolicy).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteBackupPolicyHandler falls back to empty operationId when operation.name is missing', async () => {
    const deleteBackupPolicy = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteBackupPolicy });

    const { deleteBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await deleteBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('getBackupPolicyHandler calls getBackupPolicy and returns formatted policy', async () => {
    const getBackupPolicy = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
        dailyBackupLimit: 1,
        enabled: true,
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getBackupPolicy });

    const { getBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await getBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
    });

    expect(getBackupPolicy).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
      backupPolicyId: 'bp1',
      dailyBackupLimit: 1,
      enabled: true,
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getBackupPolicyHandler uses createTime fallback when missing', async () => {
    const getBackupPolicy = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
        dailyBackupLimit: 1,
        enabled: true,
        createTime: undefined,
      },
    ]);
    createClientMock.mockReturnValue({ getBackupPolicy });

    const { getBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await getBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
    });

    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getBackupPolicyHandler handles missing name and createTime.seconds (covers optional chaining/|| branches)', async () => {
    const getBackupPolicy = vi.fn().mockResolvedValue([
      {
        // name intentionally missing
        enabled: undefined,
        state: undefined,
        createTime: {},
      },
    ]);
    createClientMock.mockReturnValue({ getBackupPolicy });

    const { getBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await getBackupPolicyHandler({
      projectId: 'p1',
      location: 'l',
      backupPolicyId: 'bp1',
    });

    expect(result.structuredContent).toMatchObject({
      name: '',
      backupPolicyId: '',
      enabled: false,
      state: 'UNKNOWN',
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
    expect((result.structuredContent as any).createTime.getTime()).toBe(0);
  });

  it('listBackupPoliciesHandler handles array response', async () => {
    const listBackupPolicies = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/backupPolicies/bp1', enabled: false }],
      ]);
    createClientMock.mockReturnValue({ listBackupPolicies });

    const { listBackupPoliciesHandler } = await import('./backup-policy-handler.js');
    const result = await listBackupPoliciesHandler({ projectId: 'p1', location: 'us-central1' });

    expect(listBackupPolicies).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      filter: undefined,
      pageSize: undefined,
      pageToken: undefined,
    });
    expect(result.structuredContent).toMatchObject({
      backupPolicies: [expect.objectContaining({ backupPolicyId: 'bp1', enabled: false })],
    });
  });

  it('listBackupPoliciesHandler handles object response with backupPolicies + nextPageToken', async () => {
    const listBackupPolicies = vi.fn().mockResolvedValue([
      {
        backupPolicies: [{ name: 'projects/p1/locations/us-central1/backupPolicies/bp1' }],
        nextPageToken: 'n',
      },
    ]);
    createClientMock.mockReturnValue({ listBackupPolicies });

    const { listBackupPoliciesHandler } = await import('./backup-policy-handler.js');
    const result = await listBackupPoliciesHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({
      backupPolicies: [expect.objectContaining({ backupPolicyId: 'bp1' })],
      nextPageToken: 'n',
    });
  });

  it('listBackupPoliciesHandler falls back to empty nextPageToken when response is non-object', async () => {
    const listBackupPolicies = vi.fn().mockResolvedValue(['not-an-object']);
    createClientMock.mockReturnValue({ listBackupPolicies });

    const { listBackupPoliciesHandler } = await import('./backup-policy-handler.js');
    const result = await listBackupPoliciesHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({ backupPolicies: [], nextPageToken: '' });
  });

  it('listBackupPoliciesHandler formats createTime when present on policies', async () => {
    const listBackupPolicies = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
          createTime: { seconds: 1 },
        },
      ],
    ]);
    createClientMock.mockReturnValue({ listBackupPolicies });

    const { listBackupPoliciesHandler } = await import('./backup-policy-handler.js');
    const result = await listBackupPoliciesHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).backupPolicies[0].createTime).toBeInstanceOf(Date);
  });

  it('listBackupPoliciesHandler handles policies missing name and createTime.seconds (covers optional chaining/?? branches)', async () => {
    const listBackupPolicies = vi
      .fn()
      .mockResolvedValue([{ backupPolicies: [{ createTime: {} }], nextPageToken: '' }]);
    createClientMock.mockReturnValue({ listBackupPolicies });

    const { listBackupPoliciesHandler } = await import('./backup-policy-handler.js');
    const result = await listBackupPoliciesHandler({ projectId: 'p1', location: 'l' });

    expect(result.structuredContent).toMatchObject({
      backupPolicies: [
        expect.objectContaining({
          name: '',
          backupPolicyId: '',
        }),
      ],
      nextPageToken: '',
    });
    // createTime should be epoch if seconds is missing (?? 0)
    expect((result.structuredContent as any).backupPolicies[0].createTime).toBeInstanceOf(Date);
    expect((result.structuredContent as any).backupPolicies[0].createTime.getTime()).toBe(0);
  });

  it('updateBackupPolicyHandler calls updateBackupPolicy and uses metadata.target for name', async () => {
    const updateBackupPolicy = vi.fn().mockResolvedValue([
      {
        name: 'op-upd',
        metadata: { target: 'projects/p1/locations/us-central1/backupPolicies/bp1' },
      },
    ]);
    createClientMock.mockReturnValue({ updateBackupPolicy });

    const { updateBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await updateBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      enabled: true,
    });

    expect(updateBackupPolicy).toHaveBeenCalledTimes(1);
    const req = updateBackupPolicy.mock.calls[0]?.[0];
    expect(req).toMatchObject({
      backupPolicy: {
        name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
        enabled: true,
      },
    });
    expect(req.updateMask.paths).toContain('enabled');
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/backupPolicies/bp1',
      operationId: 'op-upd',
    });
  });

  it('updateBackupPolicyHandler includes multiple fields in updateMask paths', async () => {
    const updateBackupPolicy = vi.fn().mockResolvedValue([
      {
        name: 'op-upd2',
        metadata: { target: 'projects/p1/locations/us-central1/backupPolicies/bp1' },
      },
    ]);
    createClientMock.mockReturnValue({ updateBackupPolicy });

    const { updateBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await updateBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      dailyBackupLimit: 1,
      description: 'd',
      labels: { a: 'b' },
    });

    const req = updateBackupPolicy.mock.calls[0]?.[0];
    expect(req.updateMask.paths).toEqual(
      expect.arrayContaining(['dailyBackupLimit', 'description', 'labels'])
    );
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd2' });
  });

  it('updateBackupPolicyHandler handles missing operation.metadata and missing operation.name', async () => {
    const updateBackupPolicy = vi.fn().mockResolvedValue([
      {
        /* no name, no metadata */
      },
    ]);
    createClientMock.mockReturnValue({ updateBackupPolicy });

    const { updateBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await updateBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      enabled: true,
    });

    expect(result.structuredContent).toEqual({ name: '', operationId: '' });
  });

  it('updateBackupPolicyHandler handles operation.metadata without target', async () => {
    const updateBackupPolicy = vi.fn().mockResolvedValue([{ name: 'op', metadata: {} }]);
    createClientMock.mockReturnValue({ updateBackupPolicy });

    const { updateBackupPolicyHandler } = await import('./backup-policy-handler.js');
    const result = await updateBackupPolicyHandler({
      projectId: 'p1',
      location: 'us-central1',
      backupPolicyId: 'bp1',
      enabled: true,
    });

    expect(result.structuredContent).toEqual({ name: '', operationId: 'op' });
  });

  it('covers error paths for create/delete/get/list/update', async () => {
    const err = new Error('boom');
    const {
      createBackupPolicyHandler,
      deleteBackupPolicyHandler,
      getBackupPolicyHandler,
      listBackupPoliciesHandler,
      updateBackupPolicyHandler,
    } = await import('./backup-policy-handler.js');

    createClientMock.mockReturnValue({ createBackupPolicy: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await createBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ deleteBackupPolicy: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await deleteBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ getBackupPolicy: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await getBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ listBackupPolicies: vi.fn().mockRejectedValue(err) });
    expect(
      ((await listBackupPoliciesHandler({ projectId: 'p1', location: 'l' })) as any).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ updateBackupPolicy: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await updateBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).isError
    ).toBe(true);
  });

  it('returns Unknown error for each handler when the underlying client call throws without message', async () => {
    const err = {};
    createClientMock.mockReturnValue({
      createBackupPolicy: vi.fn().mockRejectedValue(err),
      deleteBackupPolicy: vi.fn().mockRejectedValue(err),
      getBackupPolicy: vi.fn().mockRejectedValue(err),
      listBackupPolicies: vi.fn().mockRejectedValue(err),
      updateBackupPolicy: vi.fn().mockRejectedValue(err),
    });

    const {
      createBackupPolicyHandler,
      deleteBackupPolicyHandler,
      getBackupPolicyHandler,
      listBackupPoliciesHandler,
      updateBackupPolicyHandler,
    } = await import('./backup-policy-handler.js');

    expect(
      (
        (await createBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).content?.[0]?.text
    ).toContain('undefined');

    expect(
      (
        (await deleteBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).content?.[0]?.text
    ).toContain('undefined');

    expect(
      (
        (await getBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
        })) as any
      ).content?.[0]?.text
    ).toContain('undefined');

    expect(
      (
        (await listBackupPoliciesHandler({
          projectId: 'p1',
          location: 'l',
        })) as any
      ).content?.[0]?.text
    ).toContain('undefined');

    expect(
      (
        (await updateBackupPolicyHandler({
          projectId: 'p1',
          location: 'l',
          backupPolicyId: 'bp1',
          enabled: true,
        })) as any
      ).content?.[0]?.text
    ).toContain('undefined');
  });
});

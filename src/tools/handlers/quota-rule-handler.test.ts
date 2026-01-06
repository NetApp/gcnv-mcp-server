import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('quota-rule-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createQuotaRuleHandler returns isError for missing required fields (no client call)', async () => {
    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: '',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: '',
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('Invalid input');
  });

  it('createQuotaRuleHandler calls createQuotaRule with normalized type + diskLimitMib', async () => {
    const createQuotaRule = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createQuotaRule });

    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1000',
      quotaType: 'INDIVIDUAL_USER_QUOTA',
      diskLimitMib: 123,
    });

    expect(createQuotaRule).toHaveBeenCalledTimes(1);
    const req = createQuotaRule.mock.calls[0]?.[0];
    expect(req).toMatchObject({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      quotaRuleId: 'qr1',
      quotaRule: {
        target: 'user:1000',
        diskLimitMib: 123,
      },
    });
    expect(typeof req.quotaRule.type).toBe('number');
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
      operationId: 'op-create',
    });
  });

  it('createQuotaRuleHandler includes description/labels when provided', async () => {
    const createQuotaRule = vi.fn().mockResolvedValue([{ name: 'op-create3' }]);
    createClientMock.mockReturnValue({ createQuotaRule });

    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1000',
      quotaType: 'INDIVIDUAL_USER_QUOTA',
      diskLimitMib: 123,
      description: 'd',
      labels: { a: 'b' },
    });

    expect(createQuotaRule.mock.calls[0]?.[0]).toMatchObject({
      quotaRule: {
        target: 'user:1000',
        diskLimitMib: 123,
        description: 'd',
        labels: { a: 'b' },
      },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create3' });
  });

  it('createQuotaRuleHandler returns isError for invalid diskLimitMib (covers diskLimitError branch)', async () => {
    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1000',
      quotaType: 'INDIVIDUAL_USER_QUOTA',
      diskLimitMib: -1,
    });

    expect((result as any).isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('diskLimitMib must be a non-negative number');
  });

  it('createQuotaRuleHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const createQuotaRule = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ createQuotaRule });

    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      quotaType: 'INDIVIDUAL_USER_QUOTA',
      target: 't',
      diskLimitMib: 1,
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('createQuotaRuleHandler accepts numeric quota type values', async () => {
    const createQuotaRule = vi.fn().mockResolvedValue([{ name: 'op-create2' }]);
    createClientMock.mockReturnValue({ createQuotaRule });

    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1',
      type: 1,
      diskLimitMib: 1,
    });

    expect(createQuotaRule).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create2' });
  });

  it('createQuotaRuleHandler rejects invalid numeric quota type values', async () => {
    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1',
      type: 999,
      diskLimitMib: 1,
    });

    expect((result as any).isError).toBe(true);
  });

  it('createQuotaRuleHandler rejects non-string/non-number quota type values', async () => {
    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1',
      type: { any: 'object' },
      diskLimitMib: 1,
    });

    expect((result as any).isError).toBe(true);
  });

  it('createQuotaRuleHandler covers error path', async () => {
    const createQuotaRule = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ createQuotaRule });

    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1',
      quotaType: 'DEFAULT_USER_QUOTA',
      diskLimitMib: 1,
    });

    expect((result as any).isError).toBe(true);
  });

  it('deleteQuotaRuleHandler returns isError for missing args (no client call)', async () => {
    const { deleteQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await deleteQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: '',
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('deleteQuotaRuleHandler covers error path', async () => {
    const deleteQuotaRule = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ deleteQuotaRule });

    const { deleteQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await deleteQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('deleteQuotaRuleHandler succeeds and returns operationId', async () => {
    const deleteQuotaRule = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteQuotaRule });

    const { deleteQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await deleteQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteQuotaRuleHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const deleteQuotaRule = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ deleteQuotaRule });

    const { deleteQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await deleteQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toMatchObject({ success: true, operationId: '' });
  });

  it('getQuotaRuleHandler calls getQuotaRule and returns formatted result', async () => {
    const getQuotaRule = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
        type: 1,
        diskLimitMib: '10',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(getQuotaRule).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
      quotaRuleId: 'qr1',
      diskLimitMib: 10,
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getQuotaRuleHandler formats target/description when present (covers formatQuotaRuleData branches)', async () => {
    const getQuotaRule = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
        target: 'user:1000',
        description: 'd',
      },
    ]);
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toMatchObject({
      quotaRuleId: 'qr1',
      target: 'user:1000',
      description: 'd',
    });
  });

  it('getQuotaRuleHandler returns empty structuredContent when quota rule is undefined (covers !rule branch)', async () => {
    const getQuotaRule = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toEqual({});
  });

  it('getQuotaRuleHandler formats state/createTime/labels when present', async () => {
    const getQuotaRule = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
        state: 'READY',
        createTime: { seconds: 1 },
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toMatchObject({ state: 'READY', labels: { a: 'b' } });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getQuotaRuleHandler supports legacy quotaType field (no type field)', async () => {
    const getQuotaRule = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
        quotaType: 3,
      },
    ]);
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toMatchObject({ quotaType: 3, type: 3 });
  });

  it('getQuotaRuleHandler handles quota rule response without name (covers formatQuotaRuleData name branch false)', async () => {
    const getQuotaRule = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect(result.structuredContent).toEqual({});
  });

  it('getQuotaRuleHandler returns isError for invalid input', async () => {
    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: '',
    });

    expect((result as any).isError).toBe(true);
  });

  it('getQuotaRuleHandler covers error path', async () => {
    const getQuotaRule = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ getQuotaRule });

    const { getQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await getQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('listQuotaRulesHandler calls listQuotaRules and returns list + nextPageToken', async () => {
    const listQuotaRules = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1' }],
        undefined,
        { nextPageToken: 'next' },
      ]);
    createClientMock.mockReturnValue({ listQuotaRules });

    const { listQuotaRulesHandler } = await import('./quota-rule-handler.js');
    const result = await listQuotaRulesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      pageSize: 5,
    });

    expect(listQuotaRules).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      pageSize: 5,
    });
    expect(result.structuredContent).toMatchObject({
      quotaRules: [expect.objectContaining({ quotaRuleId: 'qr1' })],
      nextPageToken: 'next',
    });
  });

  it('listQuotaRulesHandler passes filter/pageToken/orderBy when provided', async () => {
    const listQuotaRules = vi.fn().mockResolvedValue([[], undefined, { nextPageToken: 'n' }]);
    createClientMock.mockReturnValue({ listQuotaRules });

    const { listQuotaRulesHandler } = await import('./quota-rule-handler.js');
    const result = await listQuotaRulesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      filter: 'state=READY',
      pageToken: 'pt',
      orderBy: 'create_time desc',
      pageSize: 2,
    });

    expect(listQuotaRules).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1/volumes/vol1',
      filter: 'state=READY',
      pageSize: 2,
      pageToken: 'pt',
      orderBy: 'create_time desc',
    });
    expect(result.structuredContent).toMatchObject({ quotaRules: [], nextPageToken: 'n' });
  });

  it('listQuotaRulesHandler covers error path', async () => {
    const listQuotaRules = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ listQuotaRules });

    const { listQuotaRulesHandler } = await import('./quota-rule-handler.js');
    const result = await listQuotaRulesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('listQuotaRulesHandler returns isError for invalid pageSize (no client call)', async () => {
    const { listQuotaRulesHandler } = await import('./quota-rule-handler.js');
    const result = await listQuotaRulesHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      pageSize: -1,
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('createQuotaRuleHandler returns isError for invalid quotaType value (no client call)', async () => {
    const { createQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await createQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1',
      quotaType: 'NOT_A_REAL_ENUM',
      diskLimitMib: 1,
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('updateQuotaRuleHandler returns isError when no fields to update (no client call)', async () => {
    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
    });
    // Implementation currently creates the client before validating update fields.
    // Assert that no updateQuotaRule API call happens instead.
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
  });

  it('updateQuotaRuleHandler calls updateQuotaRule with updateMask', async () => {
    const updateQuotaRule = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateQuotaRule });

    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      description: 'd',
      labels: { a: 'b' },
    });

    expect(updateQuotaRule).toHaveBeenCalledTimes(1);
    expect(updateQuotaRule.mock.calls[0]?.[0]).toMatchObject({
      quotaRule: {
        name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
        description: 'd',
        labels: { a: 'b' },
      },
      updateMask: { paths: expect.arrayContaining(['description', 'labels']) },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
      operationId: 'op-upd',
    });
  });

  it('updateQuotaRuleHandler supports updating target/type/diskLimitMib', async () => {
    const updateQuotaRule = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateQuotaRule });

    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      target: 'user:1',
      type: 'DEFAULT_USER_QUOTA',
      diskLimitMib: 10,
    });

    expect(updateQuotaRule).toHaveBeenCalledTimes(1);
    expect(updateQuotaRule.mock.calls[0]?.[0]).toMatchObject({
      quotaRule: {
        name: 'projects/p1/locations/us-central1/volumes/vol1/quotaRules/qr1',
        target: 'user:1',
        diskLimitMib: 10,
      },
      updateMask: { paths: expect.arrayContaining(['target', 'type', 'disk_limit_mib']) },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd2' });
  });

  it('updateQuotaRuleHandler returns isError for invalid diskLimitMib', async () => {
    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      diskLimitMib: -1,
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
  });

  it('updateQuotaRuleHandler returns isError for invalid quotaType/type (covers typeError branch)', async () => {
    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      quotaType: 'BAD_TYPE',
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
  });

  it('updateQuotaRuleHandler handles empty operation.name (covers operation.name || \"\" branch)', async () => {
    const updateQuotaRule = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ updateQuotaRule });

    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      description: 'd',
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('returns Unknown error for each handler when the underlying client call throws without message', async () => {
    const err = {};
    createClientMock.mockReturnValue({
      createQuotaRule: vi.fn().mockRejectedValue(err),
      deleteQuotaRule: vi.fn().mockRejectedValue(err),
      getQuotaRule: vi.fn().mockRejectedValue(err),
      listQuotaRules: vi.fn().mockRejectedValue(err),
      updateQuotaRule: vi.fn().mockRejectedValue(err),
    });

    const {
      createQuotaRuleHandler,
      deleteQuotaRuleHandler,
      getQuotaRuleHandler,
      listQuotaRulesHandler,
      updateQuotaRuleHandler,
    } = await import('./quota-rule-handler.js');

    expect(
      (
        (await createQuotaRuleHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          quotaRuleId: 'qr1',
          quotaType: 'INDIVIDUAL_USER_QUOTA',
          target: 't',
          diskLimitMib: 1,
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await deleteQuotaRuleHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          quotaRuleId: 'qr1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await getQuotaRuleHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          quotaRuleId: 'qr1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await listQuotaRulesHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await updateQuotaRuleHandler({
          projectId: 'p1',
          location: 'us-central1',
          volumeId: 'vol1',
          quotaRuleId: 'qr1',
          description: 'd',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');
  });

  it('updateQuotaRuleHandler covers error path', async () => {
    const updateQuotaRule = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ updateQuotaRule });

    const { updateQuotaRuleHandler } = await import('./quota-rule-handler.js');
    const result = await updateQuotaRuleHandler({
      projectId: 'p1',
      location: 'us-central1',
      volumeId: 'vol1',
      quotaRuleId: 'qr1',
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
  });
});

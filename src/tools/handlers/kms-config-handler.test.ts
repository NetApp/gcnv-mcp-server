import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('kms-config-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createKmsConfigHandler calls createKmsConfig and returns operationId', async () => {
    const createKmsConfig = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createKmsConfig });

    const { createKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await createKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck',
    });

    expect(createKmsConfig).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      kmsConfigId: 'k1',
      kmsConfig: { cryptoKeyName: 'ck' },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      operationId: 'op-create',
    });
  });

  it('createKmsConfigHandler falls back to empty operationId when operation.name is missing', async () => {
    const createKmsConfig = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ createKmsConfig });

    const { createKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await createKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      operationId: '',
    });
  });

  it('createKmsConfigHandler includes optional fields (description/labels) when provided', async () => {
    const createKmsConfig = vi.fn().mockResolvedValue([{ name: 'op-create-all' }]);
    createClientMock.mockReturnValue({ createKmsConfig });

    const { createKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await createKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck',
      description: 'd',
      labels: { a: 'b' },
    });

    expect(createKmsConfig).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      kmsConfigId: 'k1',
      kmsConfig: {
        cryptoKeyName: 'ck',
        description: 'd',
        labels: { a: 'b' },
      },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create-all' });
  });

  it('createKmsConfigHandler omits optional fields when they are falsy (covers false branches)', async () => {
    const createKmsConfig = vi.fn().mockResolvedValue([{ name: 'op-create-empty' }]);
    createClientMock.mockReturnValue({ createKmsConfig });

    const { createKmsConfigHandler } = await import('./kms-config-handler.js');
    await createKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      cryptoKeyName: '', // falsy
      description: '', // falsy
      labels: null, // falsy
    });

    expect(createKmsConfig.mock.calls[0]?.[0]).toMatchObject({
      kmsConfig: {},
    });
  });

  it('createKmsConfigHandler covers error path', async () => {
    const createKmsConfig = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ createKmsConfig });

    const { createKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await createKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck',
    });

    expect((result as any).isError).toBe(true);
  });

  it('deleteKmsConfigHandler calls deleteKmsConfig and returns operationId', async () => {
    const deleteKmsConfig = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteKmsConfig });

    const { deleteKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await deleteKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(deleteKmsConfig).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteKmsConfigHandler falls back to empty operationId when operation.name is missing', async () => {
    const deleteKmsConfig = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteKmsConfig });

    const { deleteKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await deleteKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('deleteKmsConfigHandler covers error path', async () => {
    const deleteKmsConfig = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ deleteKmsConfig });

    const { deleteKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await deleteKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('getKmsConfigHandler calls getKmsConfig and returns schema-valid structuredContent', async () => {
    const getKmsConfig = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
        cryptoKeyName: 'ck',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getKmsConfig });

    const { getKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await getKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(getKmsConfig).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck',
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getKmsConfigHandler formats all optional fields when present', async () => {
    const getKmsConfig = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
        cryptoKeyName: 'ck',
        state: 'READY',
        stateDetails: 'ok',
        instructions: 'do x',
        serviceAccount: 'sa',
        createTime: { seconds: 1 },
        description: 'd',
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getKmsConfig });

    const { getKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await getKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(result.structuredContent).toMatchObject({
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck',
      state: 'READY',
      stateDetails: 'ok',
      instructions: 'do x',
      serviceAccount: 'sa',
      description: 'd',
      labels: { a: 'b' },
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getKmsConfigHandler returns isError when API returns undefined config (covers formatKmsConfigData !config branch)', async () => {
    const getKmsConfig = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getKmsConfig });

    const { getKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await getKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('getKmsConfigHandler covers error path', async () => {
    const getKmsConfig = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ getKmsConfig });

    const { getKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await getKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('listKmsConfigsHandler calls listKmsConfigs and returns schema-valid list', async () => {
    const listKmsConfigs = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/kmsConfigs/k1' }],
        undefined,
        { nextPageToken: 'next' },
      ]);
    createClientMock.mockReturnValue({ listKmsConfigs });

    const { listKmsConfigsHandler } = await import('./kms-config-handler.js');
    const result = await listKmsConfigsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(listKmsConfigs).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
    });
    expect(result.structuredContent).toMatchObject({
      kmsConfigs: [expect.objectContaining({ kmsConfigId: 'k1' })],
      nextPageToken: 'next',
    });
  });

  it('listKmsConfigsHandler passes filter/pageSize/pageToken/orderBy when provided', async () => {
    const listKmsConfigs = vi.fn().mockResolvedValue([[], undefined, { nextPageToken: 'n' }]);
    createClientMock.mockReturnValue({ listKmsConfigs });

    const { listKmsConfigsHandler } = await import('./kms-config-handler.js');
    const result = await listKmsConfigsHandler({
      projectId: 'p1',
      location: 'us-central1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
      orderBy: 'create_time desc',
    });

    expect(listKmsConfigs).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
      orderBy: 'create_time desc',
    });
    expect(result.structuredContent).toMatchObject({ kmsConfigs: [], nextPageToken: 'n' });
  });

  it('getKmsConfigHandler returns isError when schema validation fails (covers parse error catch)', async () => {
    const getKmsConfig = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ getKmsConfig });

    const { getKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await getKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('listKmsConfigsHandler returns isError when schema validation fails (covers parse error catch)', async () => {
    const listKmsConfigs = vi.fn().mockResolvedValue([[{}], undefined, {}]);
    createClientMock.mockReturnValue({ listKmsConfigs });

    const { listKmsConfigsHandler } = await import('./kms-config-handler.js');
    const result = await listKmsConfigsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result as any).isError).toBe(true);
  });

  it('returns Unknown error for each handler when the underlying client call throws without message', async () => {
    const err = {};
    createClientMock.mockReturnValue({
      createKmsConfig: vi.fn().mockRejectedValue(err),
      deleteKmsConfig: vi.fn().mockRejectedValue(err),
      getKmsConfig: vi.fn().mockRejectedValue(err),
      listKmsConfigs: vi.fn().mockRejectedValue(err),
      updateKmsConfig: vi.fn().mockRejectedValue(err),
      verifyKmsConfig: vi.fn().mockRejectedValue(err),
      encryptVolumes: vi.fn().mockRejectedValue(err),
    });

    const {
      createKmsConfigHandler,
      deleteKmsConfigHandler,
      getKmsConfigHandler,
      listKmsConfigsHandler,
      updateKmsConfigHandler,
      verifyKmsConfigHandler,
      encryptVolumesHandler,
    } = await import('./kms-config-handler.js');

    expect(
      (
        (await createKmsConfigHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
          cryptoKeyName: 'ck',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await deleteKmsConfigHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await getKmsConfigHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await listKmsConfigsHandler({
          projectId: 'p1',
          location: 'us-central1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await updateKmsConfigHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
          description: 'd',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await verifyKmsConfigHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await encryptVolumesHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
          volumeIds: ['v1'],
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');
  });

  it('listKmsConfigsHandler covers error path', async () => {
    const listKmsConfigs = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ listKmsConfigs });

    const { listKmsConfigsHandler } = await import('./kms-config-handler.js');
    const result = await listKmsConfigsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result as any).isError).toBe(true);
  });

  it('updateKmsConfigHandler calls updateKmsConfig with updateMask', async () => {
    const updateKmsConfig = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateKmsConfig });

    const { updateKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await updateKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      description: 'd',
    });

    expect(updateKmsConfig).toHaveBeenCalledTimes(1);
    expect(updateKmsConfig.mock.calls[0]?.[0]).toMatchObject({
      kmsConfig: { name: 'projects/p1/locations/us-central1/kmsConfigs/k1', description: 'd' },
      updateMask: { paths: ['description'] },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      operationId: 'op-upd',
    });
  });

  it('updateKmsConfigHandler falls back to empty operationId when operation.name is missing', async () => {
    const updateKmsConfig = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ updateKmsConfig });

    const { updateKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await updateKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      description: 'd',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      operationId: '',
    });
  });

  it('updateKmsConfigHandler supports updating cryptoKeyName and labels', async () => {
    const updateKmsConfig = vi.fn().mockResolvedValue([{ name: 'op-upd3' }]);
    createClientMock.mockReturnValue({ updateKmsConfig });

    const { updateKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await updateKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      cryptoKeyName: 'ck2',
      labels: { a: 'b' },
    });

    expect(updateKmsConfig.mock.calls[0]?.[0]).toMatchObject({
      kmsConfig: {
        name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
        cryptoKeyName: 'ck2',
        labels: { a: 'b' },
      },
      updateMask: { paths: expect.arrayContaining(['crypto_key_name', 'labels']) },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd3' });
  });

  it('updateKmsConfigHandler covers error path', async () => {
    const updateKmsConfig = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ updateKmsConfig });

    const { updateKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await updateKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
      description: 'd',
    });

    expect((result as any).isError).toBe(true);
  });

  it('verifyKmsConfigHandler calls verifyKmsConfig and maps health', async () => {
    const verifyKmsConfig = vi.fn().mockResolvedValue([{ healthy: true, healthError: '' }]);
    createClientMock.mockReturnValue({ verifyKmsConfig });

    const { verifyKmsConfigHandler } = await import('./kms-config-handler.js');
    const result = await verifyKmsConfigHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(verifyKmsConfig).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
    });
    expect(result.structuredContent).toEqual({ reachable: true, healthError: '' });
  });

  it('encryptVolumesHandler calls encryptVolumes and returns operationId', async () => {
    const encryptVolumes = vi.fn().mockResolvedValue([{ name: 'op-enc' }]);
    createClientMock.mockReturnValue({ encryptVolumes });

    const { encryptVolumesHandler } = await import('./kms-config-handler.js');
    const result = await encryptVolumesHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(encryptVolumes).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      operationId: 'op-enc',
    });
  });

  it('encryptVolumesHandler falls back to empty operationId when operation.name is missing', async () => {
    const encryptVolumes = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ encryptVolumes });

    const { encryptVolumesHandler } = await import('./kms-config-handler.js');
    const result = await encryptVolumesHandler({
      projectId: 'p1',
      location: 'us-central1',
      kmsConfigId: 'k1',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/kmsConfigs/k1',
      operationId: '',
    });
  });

  it('covers error paths for verifyKmsConfigHandler and encryptVolumesHandler', async () => {
    const err = new Error('boom');
    const { verifyKmsConfigHandler, encryptVolumesHandler } =
      await import('./kms-config-handler.js');

    createClientMock.mockReturnValue({ verifyKmsConfig: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await verifyKmsConfigHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ encryptVolumes: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await encryptVolumesHandler({
          projectId: 'p1',
          location: 'us-central1',
          kmsConfigId: 'k1',
        })) as any
      ).isError
    ).toBe(true);
  });
});

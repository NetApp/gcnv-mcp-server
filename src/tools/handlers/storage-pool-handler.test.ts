import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('storage-pool-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createStoragePoolHandler calls createStoragePool and returns operationId', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
    });

    expect(createStoragePool).toHaveBeenCalledTimes(1);
    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1',
      storagePoolId: 'sp1',
      storagePool: expect.objectContaining({
        capacityGib: 100,
        serviceLevel: 'PREMIUM',
        network: 'net1',
      }),
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      operationId: 'op-create',
    });
  });

  it('createStoragePoolHandler normalizes serviceLevel to uppercase (e.g. flex -> FLEX)', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'flex',
      network: 'net1',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        serviceLevel: 'FLEX',
      }),
    });
  });

  it('createStoragePoolHandler supports Flex custom performance via totalThroughputMibps', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'flex',
      network: 'net1',
      totalThroughputMibps: 512,
    });

    expect(createStoragePool).toHaveBeenCalledTimes(1);
    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        serviceLevel: 'FLEX',
        customPerformanceEnabled: true,
        totalThroughputMibps: 512,
      }),
    });
  });

  it('createStoragePoolHandler includes storagePoolType in request (FLEX + UNIFIED)', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'flex',
      network: 'net1',
      storagePoolType: 'UNIFIED',
    });

    expect(createStoragePool).toHaveBeenCalledTimes(1);
    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        serviceLevel: 'FLEX',
        type: 2,
      }),
    });
  });

  it('createStoragePoolHandler rejects UNIFIED_* storagePoolType for non-FLEX service levels', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'STANDARD',
      network: 'net1',
      storagePoolType: 'UNIFIED_LARGE_CAPACITY',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('storagePoolType UNIFIED and UNIFIED_LARGE_CAPACITY');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler rejects totalThroughputMibps for non-FLEX service levels', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      totalThroughputMibps: 512,
    });

    expect(createStoragePool).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createStoragePoolHandler sets qosType and supports MANUAL for non-FLEX service levels', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      qosType: 'manual',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        serviceLevel: 'PREMIUM',
        qosType: 'MANUAL',
      }),
    });
  });

  it('createStoragePoolHandler preserves non-string serviceLevel (covers typeof serviceLevel !== \"string\" branch)', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 4, // non-string
      network: 'net1',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        serviceLevel: 4,
      }),
    });
  });

  it('createStoragePoolHandler rejects qosType MANUAL for FLEX pools', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      network: 'net1',
      qosType: 'MANUAL',
    });

    expect(createStoragePool).not.toHaveBeenCalled();
    expect((result as any).isError).toBe(true);
  });

  it('createStoragePoolHandler handles empty operation.name (covers operation.name || "" branch)', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      operationId: '',
    });
  });

  it('createStoragePoolHandler includes optional fields in storagePool payload when provided', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create-all' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      activeDirectory: 'ad',
      kmsConfig: 'kms',
      encryptionType: 'CMEK',
      ldapEnabled: false,
      allowAutoTiering: false,
    });

    const req = createStoragePool.mock.calls[0]?.[0];
    expect(req.storagePool).toMatchObject({
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      activeDirectory: 'ad',
      kmsConfig: 'kms',
      encryptionType: 'CMEK',
      ldapEnabled: false,
      allowAutoTiering: false,
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create-all' });
  });

  it('createStoragePoolHandler (FLEX) requires zone+replicaZone when location is a region', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const resMissingZone = (await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1', // region
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      network: 'net1',
    })) as any;
    expect(resMissingZone.isError).toBe(true);
    expect(resMissingZone.content[0].text).toContain('zone must be provided');
    expect(createStoragePool).not.toHaveBeenCalled();

    const resMissingReplica = (await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1', // region
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      network: 'net1',
      zone: 'us-central1-a',
    })) as any;
    expect(resMissingReplica.isError).toBe(true);
    expect(resMissingReplica.content[0].text).toContain('replicaZone must be provided');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler (FLEX) sets zone to location when location is zonal', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      network: 'net1',
    });

    // For zonal pools, zone is encoded in URL/location; do not send zone/replicaZone in body.
    expect(createStoragePool).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePool: expect.not.objectContaining({
          zone: expect.anything(),
        }),
      })
    );
  });

  it('createStoragePoolHandler covers error path', async () => {
    const createStoragePool = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 1,
      serviceLevel: 'PREMIUM',
      network: 'net1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('deleteStoragePoolHandler calls deleteStoragePool and returns operationId', async () => {
    const deleteStoragePool = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteStoragePool });

    const { deleteStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await deleteStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      force: true,
    });

    expect(deleteStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      force: true,
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteStoragePoolHandler falls back to empty operationId when operation[0].name is missing', async () => {
    const deleteStoragePool = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteStoragePool });

    const { deleteStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await deleteStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('deleteStoragePoolHandler does not include force when false', async () => {
    const deleteStoragePool = vi.fn().mockResolvedValue([{ name: 'op-del2' }]);
    createClientMock.mockReturnValue({ deleteStoragePool });

    const { deleteStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await deleteStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      force: false,
    });

    expect(deleteStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-del2' });
  });

  it('deleteStoragePoolHandler covers error path', async () => {
    const deleteStoragePool = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ deleteStoragePool });

    const { deleteStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await deleteStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('getStoragePoolHandler calls getStoragePool and returns structuredContent', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        capacityGib: '1',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      storagePoolId: 'sp1',
      capacityGib: 1,
    });
    expect(result.structuredContent?.createTime).toBeInstanceOf(Date);
  });

  it('getStoragePoolHandler surfaces Flex custom performance fields when present', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        capacityGib: '1',
        createTime: { seconds: 1 },
        customPerformanceEnabled: true,
        totalThroughputMibps: '256',
      },
    ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect(result.structuredContent).toMatchObject({
      customPerformanceEnabled: true,
      totalThroughputMibps: 256,
    });
  });

  it('getStoragePoolHandler maps totalThroughputMibps=0 via Number(...) || 0 branch', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        capacityGib: '1',
        createTime: { seconds: 1 },
        totalThroughputMibps: '0',
      },
    ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect(result.structuredContent).toMatchObject({ totalThroughputMibps: 0 });
  });

  it('getStoragePoolHandler falls back for missing name/capacity fields (covers || 0 branches)', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([
      {
        // name missing => name || ''
        capacityGib: undefined, // Number(undefined) => NaN => || 0
        volumeCapacityGib: '0', // Number('0') => 0 => || 0
      },
    ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect(result.structuredContent).toMatchObject({
      name: '',
      capacityGib: 0,
      volumeCapacityGib: 0,
    });
  });

  it('getStoragePoolHandler uses createTime fallback when missing', async () => {
    const getStoragePool = vi
      .fn()
      .mockResolvedValue([
        { name: 'projects/p1/locations/us-central1/storagePools/sp1', capacityGib: '1' },
      ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getStoragePoolHandler covers error path', async () => {
    const getStoragePool = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
    });

    expect((result as any).isError).toBe(true);
  });

  it('listStoragePoolsHandler maps pools and surfaces nextPageToken', async () => {
    const listStoragePools = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/storagePools/sp1', capacityGib: '1' }],
        undefined,
        { nextPageToken: 'n1' },
      ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(listStoragePools).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      pageSize: undefined,
      pageToken: undefined,
      orderBy: undefined,
      filter: undefined,
    });
    expect(result.structuredContent).toMatchObject({
      storagePools: [expect.objectContaining({ storagePoolId: 'sp1', capacityGib: 1 })],
      nextPageToken: 'n1',
    });
  });

  it('listStoragePoolsHandler surfaces Flex custom performance fields when present', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/p1/locations/us-central1/storagePools/sp1',
          capacityGib: '1',
          customPerformanceEnabled: true,
          totalThroughputMibps: '512',
        },
      ],
      undefined,
      { nextPageToken: 'n1' },
    ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).storagePools[0]).toMatchObject({
      customPerformanceEnabled: true,
      totalThroughputMibps: 512,
    });
  });

  it('listStoragePoolsHandler maps non-numeric totalThroughputMibps to 0 (covers Number(x) || 0 branch)', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/p1/locations/us-central1/storagePools/sp1',
          capacityGib: '1',
          totalThroughputMibps: 'not-a-number',
        },
      ],
      undefined,
      { nextPageToken: 'n1' },
    ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).storagePools[0]).toMatchObject({
      totalThroughputMibps: 0,
    });
  });

  it('updateStoragePoolHandler preserves non-string qosType (covers typeof qosType !== \"string\" branch)', async () => {
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd-qos2' }]);
    createClientMock.mockReturnValue({ updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      qosType: 2, // non-string
    });

    expect(updateStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({ qosType: 2 }),
      updateMask: { paths: ['qos_type'] },
    });
  });

  it('listStoragePoolsHandler formats createTime when present on pools', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/p1/locations/us-central1/storagePools/sp1',
          capacityGib: '1',
          createTime: { seconds: 1 },
        },
      ],
      undefined,
      { nextPageToken: 'n1' },
    ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result.structuredContent as any).storagePools[0].createTime).toBeInstanceOf(Date);
  });

  it('listStoragePoolsHandler formats sparse pools and handles missing paginated_response', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([
      [
        {
          // missing name/serviceLevel/capacity -> hit || fallbacks
          createTime: { seconds: 0 }, // falsy seconds -> fallback new Date()
          description: '',
          labels: undefined,
          ldapEnabled: undefined,
          allowAutoTiering: undefined,
        },
      ],
      undefined,
      undefined,
    ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect(result.structuredContent).toMatchObject({
      storagePools: [
        expect.objectContaining({ name: '', storagePoolId: '', serviceLevel: '', capacityGib: 0 }),
      ],
      nextPageToken: undefined,
    });
    expect((result.structuredContent as any).storagePools[0].createTime).toBeInstanceOf(Date);
  });

  it('listStoragePoolsHandler covers error path', async () => {
    const listStoragePools = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result as any).isError).toBe(true);
  });

  it('updateStoragePoolHandler calls updateStoragePool with updateMask', async () => {
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 2,
      description: 'd',
    });

    expect(updateStoragePool).toHaveBeenCalledTimes(1);
    expect(updateStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        capacityGib: 2,
        description: 'd',
      },
      updateMask: { paths: expect.arrayContaining(['capacity_gib', 'description']) },
    });
    expect(result.structuredContent).toMatchObject({
      operationId: 'op-upd',
    });
  });

  it('updateStoragePoolHandler supports storagePoolType update and adds type to updateMask (FLEX-only for UNIFIED*)', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'FLEX' }]);
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      storagePoolType: 'UNIFIED',
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(updateStoragePool).toHaveBeenCalledTimes(1);
    const req = updateStoragePool.mock.calls[0]?.[0];
    expect(req.storagePool).toMatchObject({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      type: 2,
    });
    expect(req.updateMask.paths).toEqual(expect.arrayContaining(['type']));
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      operationId: 'op-upd',
    });
  });

  it('updateStoragePoolHandler supports updating labels', async () => {
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      labels: { a: 'b' },
    });

    expect(updateStoragePool).toHaveBeenCalledWith({
      storagePool: {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        labels: { a: 'b' },
      },
      updateMask: { paths: ['labels'] },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd2' });
  });

  it('updateStoragePoolHandler supports updating qosType', async () => {
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd-qos' }]);
    createClientMock.mockReturnValue({ updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      qosType: 'manual',
    });

    expect(updateStoragePool).toHaveBeenCalledWith({
      storagePool: {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        qosType: 'MANUAL',
      },
      updateMask: { paths: ['qos_type'] },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd-qos' });
  });

  it('validateDirectoryServiceHandler calls validateDirectoryService', async () => {
    const validateDirectoryService = vi.fn().mockResolvedValue([{ name: 'op-val' }]);
    createClientMock.mockReturnValue({ validateDirectoryService });

    const { validateDirectoryServiceHandler } = await import('./storage-pool-handler.js');
    const result = await validateDirectoryServiceHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      directoryServiceType: 'ACTIVE_DIRECTORY',
    });

    expect(validateDirectoryService).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
      directoryServiceType: 'ACTIVE_DIRECTORY',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-val' });
  });

  it('updateStoragePoolHandler handles empty operation.name (covers operation.name || "" branch)', async () => {
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      labels: { a: 'b' },
    });

    expect(result.structuredContent).toMatchObject({ operationId: '' });
  });

  it('validateDirectoryServiceHandler handles empty operation.name (covers operation.name || "" branch)', async () => {
    const validateDirectoryService = vi.fn().mockResolvedValue([{ name: '' }]);
    createClientMock.mockReturnValue({ validateDirectoryService });

    const { validateDirectoryServiceHandler } = await import('./storage-pool-handler.js');
    const result = await validateDirectoryServiceHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      directoryServiceType: 'ACTIVE_DIRECTORY',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('covers error paths for updateStoragePoolHandler and validateDirectoryServiceHandler', async () => {
    const err = new Error('boom');
    const { updateStoragePoolHandler, validateDirectoryServiceHandler } =
      await import('./storage-pool-handler.js');

    createClientMock.mockReturnValue({ updateStoragePool: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await updateStoragePoolHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
          description: 'd',
        })) as any
      ).isError
    ).toBe(true);

    createClientMock.mockReturnValue({ validateDirectoryService: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await validateDirectoryServiceHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
          directoryServiceType: 'ACTIVE_DIRECTORY',
        })) as any
      ).isError
    ).toBe(true);
  });

  it('returns Unknown error for each handler when the underlying client call throws without message', async () => {
    const err = {};
    createClientMock.mockReturnValue({
      createStoragePool: vi.fn().mockRejectedValue(err),
      deleteStoragePool: vi.fn().mockRejectedValue(err),
      getStoragePool: vi.fn().mockRejectedValue(err),
      listStoragePools: vi.fn().mockRejectedValue(err),
      updateStoragePool: vi.fn().mockRejectedValue(err),
      validateDirectoryService: vi.fn().mockRejectedValue(err),
    });

    const {
      createStoragePoolHandler,
      deleteStoragePoolHandler,
      getStoragePoolHandler,
      listStoragePoolsHandler,
      updateStoragePoolHandler,
      validateDirectoryServiceHandler,
    } = await import('./storage-pool-handler.js');

    expect(
      (
        (await createStoragePoolHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
          capacityGib: 1,
          serviceLevel: 'PREMIUM',
          network: 'net',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await deleteStoragePoolHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await getStoragePoolHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await listStoragePoolsHandler({
          projectId: 'p1',
          location: 'us-central1',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await updateStoragePoolHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
          description: 'd',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');

    expect(
      (
        (await validateDirectoryServiceHandler({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
          directoryServiceType: 'ACTIVE_DIRECTORY',
        })) as any
      ).content?.[0]?.text
    ).toContain('Unknown error');
  });
});

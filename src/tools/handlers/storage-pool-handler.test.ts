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

  it('createStoragePoolHandler includes scaleType in request payload', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 6144,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'UNIFIED',
      scaleType: 'SCALE_TYPE_SCALEOUT',
    });

    expect(createStoragePool).toHaveBeenCalledTimes(1);
    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        serviceLevel: 'FLEX',
        type: 2,
        scaleType: 'SCALE_TYPE_SCALEOUT',
      }),
    });
  });

  it('createStoragePoolHandler accepts all valid scaleType values (case-insensitive)', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const cases: [string, string][] = [
      ['SCALE_TYPE_DEFAULT', 'SCALE_TYPE_DEFAULT'],
      ['scale_type_default', 'SCALE_TYPE_DEFAULT'],
      ['SCALE_TYPE_SCALEOUT', 'SCALE_TYPE_SCALEOUT'],
      ['scale_type_scaleout', 'SCALE_TYPE_SCALEOUT'],
      ['SCALE_TYPE_UNSPECIFIED', 'SCALE_TYPE_UNSPECIFIED'],
    ];
    for (const [scaleType, expected] of cases) {
      createStoragePool.mockClear();
      await createStoragePoolHandler({
        projectId: 'p1',
        location: 'us-central1-a',
        storagePoolId: 'sp1',
        capacityGib: 1024,
        serviceLevel: 'FLEX',
        storagePoolType: 'UNIFIED',
        network: 'net1',
        scaleType,
      });
      expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
        storagePool: expect.objectContaining({ scaleType: expected }),
      });
    }
  });

  it('createStoragePoolHandler rejects invalid scaleType', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 1024,
      serviceLevel: 'FLEX',
      network: 'net1',
      scaleType: 'INVALID_SCALE',
    });

    expect((result as any).isError).toBe(true);
    expect((result as any).content?.[0]?.text).toContain('scaleType must be one of');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler rejects non-string scaleType', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 1024,
      serviceLevel: 'FLEX',
      network: 'net1',
      scaleType: 42,
    });

    expect((result as any).isError).toBe(true);
    expect((result as any).content?.[0]?.text).toContain('scaleType must be a string enum name');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler omits scaleType from payload when storagePoolType is not UNIFIED and scaleType not provided', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 2048,
      serviceLevel: 'PREMIUM',
      network: 'net1',
    });

    const payload = createStoragePool.mock.calls[0]?.[0]?.storagePool;
    expect(payload).not.toHaveProperty('scaleType');
  });

  it('createStoragePoolHandler omits scaleType from payload when UNIFIED pool created without scaleType', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    // No auto-inference — scaleType must be provided explicitly
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 6144,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'UNIFIED',
    });

    const payload = createStoragePool.mock.calls[0]?.[0]?.storagePool;
    expect(payload).not.toHaveProperty('scaleType');
  });

  it('createStoragePoolHandler sends SCALE_TYPE_SCALEOUT when explicitly provided for large capacity UNIFIED pool', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 6144,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'UNIFIED',
      scaleType: 'SCALE_TYPE_SCALEOUT',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        type: 2,
        scaleType: 'SCALE_TYPE_SCALEOUT',
      }),
    });
  });

  it('createStoragePoolHandler sends SCALE_TYPE_DEFAULT when explicitly provided for standard UNIFIED pool', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 1024,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'UNIFIED',
      scaleType: 'SCALE_TYPE_DEFAULT',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        type: 2,
        scaleType: 'SCALE_TYPE_DEFAULT',
      }),
    });
  });

  it('createStoragePoolHandler rejects UNIFIED storagePoolType for non-FLEX service levels', async () => {
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
      storagePoolType: 'UNIFIED',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('storagePoolType UNIFIED is only supported');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler rejects ONTAP mode when storagePoolType is not UNIFIED', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 2048,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'FILE',
      mode: 'ONTAP',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ONTAP mode requires storagePoolType UNIFIED');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler rejects ONTAP mode when storagePoolType is not specified', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 2048,
      serviceLevel: 'FLEX',
      network: 'net1',
      mode: 'ONTAP',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('storagePoolType was not specified');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler rejects ONTAP mode when serviceLevel is not FLEX', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 2048,
      serviceLevel: 'STANDARD',
      network: 'net1',
      storagePoolType: 'UNIFIED',
      mode: 'ONTAP',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ONTAP mode requires serviceLevel FLEX');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler includes mode in request payload for ONTAP pool', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 2048,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'UNIFIED',
      mode: 'ONTAP',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({ type: 2, mode: 'ONTAP' }),
    });
  });

  it('createStoragePoolHandler accepts lowercase mode and normalizes to uppercase', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1-a',
      storagePoolId: 'sp1',
      capacityGib: 2048,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 'UNIFIED',
      mode: 'ontap',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({ mode: 'ONTAP' }),
    });
  });

  it('createStoragePoolHandler rejects invalid string mode value', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 1024,
      serviceLevel: 'FLEX',
      storagePoolType: 'UNIFIED',
      network: 'net1',
      mode: 'INVALID',
    });

    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain('mode must be DEFAULT or ONTAP');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler rejects non-string mode value', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 1024,
      serviceLevel: 'FLEX',
      storagePoolType: 'UNIFIED',
      network: 'net1',
      mode: 123,
    });

    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain('mode must be a string');
    expect(createStoragePool).not.toHaveBeenCalled();
  });

  it('createStoragePoolHandler validates storagePoolType number/string/type inputs', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    const badNumber = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      storagePoolType: 9,
    });
    expect((badNumber as any).isError).toBe(true);
    expect((badNumber as any).content?.[0]?.text).toContain(
      'storagePoolType must be a valid enum number'
    );

    const badString = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      storagePoolType: 'NOPE',
    });
    expect((badString as any).content?.[0]?.text).toContain('storagePoolType must be one of');

    const badType = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
      storagePoolType: true,
    });
    expect((badType as any).content?.[0]?.text).toContain(
      'storagePoolType must be a string enum name or enum number'
    );
  });

  it('createStoragePoolHandler accepts numeric storagePoolType and covers non-string location branch', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });
    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');

    await createStoragePoolHandler({
      projectId: 'p1',
      location: 123,
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      network: 'net1',
      storagePoolType: 1,
      zone: 'us-central1-a',
      replicaZone: 'us-central1-b',
    });

    expect(createStoragePool).toHaveBeenCalledTimes(1);
    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({ type: 1, zone: 'us-central1-a' }),
    });
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

  it('createStoragePoolHandler (FLEX regional) includes zone and replicaZone in body', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      network: 'net1',
      zone: 'us-central1-a',
      replicaZone: 'us-central1-b',
    });

    expect(createStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: expect.objectContaining({
        zone: 'us-central1-a',
        replicaZone: 'us-central1-b',
      }),
    });
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
        state: 'READY',
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
      state: 'READY',
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

  it('getStoragePoolHandler includes mode in structured output', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/storagePools/ontap-pool',
        capacityGib: '2048',
        serviceLevel: 'FLEX',
        mode: 'ONTAP',
      },
    ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'ontap-pool',
    });

    expect((result.structuredContent as any).mode).toBe('ONTAP');
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

  it('getStoragePoolHandler does not add extra legacy fields to structuredContent', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/storagePools/egg',
        capacityGib: '1',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getStoragePool });

    const { getStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await getStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'egg',
    });

    expect((result.structuredContent as any)._h).toBeUndefined();
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

  it('listStoragePoolsHandler uses location "-" when location is omitted', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([[], undefined, undefined]);
    createClientMock.mockReturnValue({ listStoragePools });
    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');

    await listStoragePoolsHandler({ projectId: 'p1' });
    expect(listStoragePools).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/-',
      pageSize: undefined,
      pageToken: undefined,
      orderBy: undefined,
      filter: undefined,
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

  it('listStoragePoolsHandler includes mode in structured output for ONTAP and DEFAULT pools', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/p1/locations/us-central1/storagePools/ontap-pool',
          capacityGib: '2048',
          mode: 'ONTAP',
        },
        {
          name: 'projects/p1/locations/us-central1/storagePools/default-pool',
          capacityGib: '1024',
          mode: 'DEFAULT',
        },
        {
          name: 'projects/p1/locations/us-central1/storagePools/old-pool',
          capacityGib: '512',
        },
      ],
      undefined,
      undefined,
    ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });
    const pools = (result.structuredContent as any).storagePools;

    expect(pools[0]).toMatchObject({ storagePoolId: 'ontap-pool', mode: 'ONTAP' });
    expect(pools[1]).toMatchObject({ storagePoolId: 'default-pool', mode: 'DEFAULT' });
    expect(pools[2].mode).toBeUndefined();
  });

  it('listStoragePoolsHandler covers error path', async () => {
    const listStoragePools = vi.fn().mockRejectedValue(new Error('boom'));
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    expect((result as any).isError).toBe(true);
  });

  it('listStoragePoolsHandler does not add extra legacy fields to list items', async () => {
    const listStoragePools = vi.fn().mockResolvedValue([
      [
        { name: 'projects/p1/locations/us-central1/storagePools/sp1', capacityGib: '1' },
        { name: 'projects/p1/locations/us-central1/storagePools/egg', capacityGib: '2' },
      ],
      undefined,
      undefined,
    ]);
    createClientMock.mockReturnValue({ listStoragePools });

    const { listStoragePoolsHandler } = await import('./storage-pool-handler.js');
    const result = await listStoragePoolsHandler({ projectId: 'p1', location: 'us-central1' });

    const pools = (result.structuredContent as any).storagePools;
    expect(pools[0]._h).toBeUndefined();
    expect(pools[1]._h).toBeUndefined();
  });

  it('createStoragePoolHandler does not add extra legacy fields to structuredContent', async () => {
    const createStoragePool = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createStoragePool });

    const { createStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await createStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'egg',
      capacityGib: 100,
      serviceLevel: 'PREMIUM',
      network: 'net1',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/storagePools/egg',
      operationId: 'op-create',
    });
    expect((result.structuredContent as any)._h).toBeUndefined();
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

  it('updateStoragePoolHandler rejects invalid storagePoolType input and non-FLEX UNIFIED updates', async () => {
    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');

    createClientMock.mockReturnValue({ updateStoragePool: vi.fn() });
    const invalidType = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      storagePoolType: 'NOPE',
    });
    expect((invalidType as any).isError).toBe(true);
    expect((invalidType as any).content?.[0]?.text).toContain('Error updating storage pool');

    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 7 }]);
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool: vi.fn() });
    const nonFlex = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      storagePoolType: 'UNIFIED',
    });
    expect((nonFlex as any).isError).toBe(true);
    expect((nonFlex as any).content?.[0]?.text).toContain('UNIFIED is only supported');
  });

  it('updateStoragePoolHandler supports updating zone and replicaZone', async () => {
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd-zones' }]);
    createClientMock.mockReturnValue({ updateStoragePool });
    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');

    await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      zone: 'us-central1-a',
      replicaZone: 'us-central1-b',
    });

    expect(updateStoragePool.mock.calls[0]?.[0]).toMatchObject({
      storagePool: {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        zone: 'us-central1-a',
        replicaZone: 'us-central1-b',
      },
      updateMask: { paths: expect.arrayContaining(['zone', 'replica_zone']) },
    });
  });

  it('updateStoragePoolHandler does not call getStoragePool for FILE type updates', async () => {
    const getStoragePool = vi.fn();
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd-file' }]);
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool });
    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');

    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      storagePoolType: 'FILE',
    });

    expect(getStoragePool).not.toHaveBeenCalled();
    expect(updateStoragePool).toHaveBeenCalledTimes(1);
    expect((result as any).structuredContent.operationId).toBe('op-upd-file');
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

  it('updateStoragePoolHandler supports updating totalThroughputMibps for FLEX pools', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'FLEX' }]);
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd-throughput' }]);
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      totalThroughputMibps: 512,
    });

    expect(getStoragePool).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/storagePools/sp1',
    });
    expect(updateStoragePool).toHaveBeenCalledWith({
      storagePool: {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        totalThroughputMibps: 512,
      },
      updateMask: { paths: ['total_throughput_mibps'] },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd-throughput' });
  });

  it('updateStoragePoolHandler reuses cached pool lookup when multiple FLEX checks are needed', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'FLEX' }]);
    const updateStoragePool = vi.fn().mockResolvedValue([{ name: 'op-upd-cached' }]);
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      totalThroughputMibps: 512,
      storagePoolType: 'UNIFIED',
    });

    expect(getStoragePool).toHaveBeenCalledTimes(1);
    expect(updateStoragePool).toHaveBeenCalledWith({
      storagePool: {
        name: 'projects/p1/locations/us-central1/storagePools/sp1',
        totalThroughputMibps: 512,
        type: 2,
      },
      updateMask: { paths: expect.arrayContaining(['total_throughput_mibps', 'type']) },
    });
    expect((result as any).structuredContent.operationId).toBe('op-upd-cached');
  });

  it('updateStoragePoolHandler rejects totalThroughputMibps for non-FLEX pools', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 'PREMIUM' }]);
    const updateStoragePool = vi.fn();
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      totalThroughputMibps: 512,
    });

    expect((result as any).isError).toBe(true);
    expect((result as any).content?.[0]?.text).toContain(
      'totalThroughputMibps is only supported when serviceLevel is FLEX'
    );
    expect(updateStoragePool).not.toHaveBeenCalled();
  });

  it('updateStoragePoolHandler rejects totalThroughputMibps when serviceLevel is non-string', async () => {
    const getStoragePool = vi.fn().mockResolvedValue([{ serviceLevel: 7 }]);
    const updateStoragePool = vi.fn();
    createClientMock.mockReturnValue({ getStoragePool, updateStoragePool });

    const { updateStoragePoolHandler } = await import('./storage-pool-handler.js');
    const result = await updateStoragePoolHandler({
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      totalThroughputMibps: 256,
    });

    expect((result as any).isError).toBe(true);
    expect((result as any).content?.[0]?.text).toContain(
      'totalThroughputMibps is only supported when serviceLevel is FLEX'
    );
    expect(updateStoragePool).not.toHaveBeenCalled();
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

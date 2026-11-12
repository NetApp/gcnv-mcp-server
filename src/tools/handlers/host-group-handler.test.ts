import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('host-group-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createHostGroupHandler calls createHostGroup and returns operationId', async () => {
    const createHostGroup = vi.fn().mockResolvedValue([{ name: 'op-create-hg' }]);
    createClientMock.mockReturnValue({ createHostGroup });

    const { createHostGroupHandler } = await import('./host-group-handler.js');
    const result = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 'ISCSI_INITIATOR',
      osType: 'LINUX',
      hosts: ['iqn.1998-01.com.vmware:esx1'],
      description: 'd1',
      labels: { a: 'b' },
    });

    expect(createHostGroup).toHaveBeenCalledTimes(1);
    expect(createHostGroup.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1',
      hostGroupId: 'hg1',
      hostGroup: expect.objectContaining({
        type: 1,
        osType: 1,
        hosts: ['iqn.1998-01.com.vmware:esx1'],
        description: 'd1',
        labels: { a: 'b' },
      }),
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
      operationId: 'op-create-hg',
    });
  });

  it('createHostGroupHandler rejects invalid input', async () => {
    createClientMock.mockReturnValue({ createHostGroup: vi.fn() });
    const { createHostGroupHandler } = await import('./host-group-handler.js');

    const result = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: '',
      type: 'NOPE',
      osType: 'LINUX',
      hosts: [],
    });

    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid input:');
  });

  it('getHostGroupHandler calls getHostGroup and formats response', async () => {
    const getHostGroup = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/hostGroups/hg1',
        type: 1,
        state: 2,
        createTime: { seconds: 10 },
        hosts: ['h1'],
        osType: 1,
        description: 'd',
        labels: { k: 'v' },
      },
    ]);
    createClientMock.mockReturnValue({ getHostGroup });

    const { getHostGroupHandler } = await import('./host-group-handler.js');
    const result = await getHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
    });

    expect(getHostGroup).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
      hostGroupId: 'hg1',
      type: 1,
      state: 2,
      hosts: ['h1'],
      osType: 1,
      description: 'd',
      labels: { k: 'v' },
    });
    expect(result.structuredContent.createTime).toMatch(/^\d{4}-/);
  });

  it('listHostGroupsHandler calls listHostGroups and returns nextPageToken', async () => {
    const listHostGroups = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/hostGroups/hg1', hosts: ['h1'] }],
        {},
        { nextPageToken: 't1' },
      ]);
    createClientMock.mockReturnValue({ listHostGroups });

    const { listHostGroupsHandler } = await import('./host-group-handler.js');
    const result = await listHostGroupsHandler({
      projectId: 'p1',
      location: 'us-central1',
      filter: 'state=READY',
      pageSize: 10,
    });

    expect(listHostGroups).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: 'projects/p1/locations/us-central1',
        filter: 'state=READY',
        pageSize: 10,
      })
    );
    expect(result.structuredContent).toEqual({
      hostGroups: [
        {
          name: 'projects/p1/locations/us-central1/hostGroups/hg1',
          hostGroupId: 'hg1',
          hosts: ['h1'],
        },
      ],
      nextPageToken: 't1',
    });
  });

  it('updateHostGroupHandler builds updateMask and returns operationId', async () => {
    const updateHostGroup = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateHostGroup });

    const { updateHostGroupHandler } = await import('./host-group-handler.js');
    const result = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      hosts: ['h2'],
      osType: 'WINDOWS',
    });

    expect(updateHostGroup).toHaveBeenCalledTimes(1);
    const req = updateHostGroup.mock.calls[0]?.[0];
    expect(req.hostGroup).toMatchObject({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
      hosts: ['h2'],
      osType: 2,
    });
    expect(req.updateMask.paths).toEqual(expect.arrayContaining(['hosts', 'os_type']));
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
      operationId: 'op-upd',
    });
  });

  it('covers error paths (createHostGroupHandler)', async () => {
    const err = new Error('boom');
    createClientMock.mockReturnValue({ createHostGroup: vi.fn().mockRejectedValue(err) });

    const { createHostGroupHandler } = await import('./host-group-handler.js');
    const result = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 1,
      osType: 1,
      hosts: ['h1'],
    });

    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain('Error creating host group');
  });

  it('createHostGroupHandler validates enum inputs for numeric/string/type errors', async () => {
    createClientMock.mockReturnValue({ createHostGroup: vi.fn() });
    const { createHostGroupHandler } = await import('./host-group-handler.js');

    const numericErr = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 99,
      osType: 'LINUX',
      hosts: ['h1'],
    });
    expect((numericErr as any).isError).toBe(true);
    expect((numericErr as any).content?.[0]?.text).toContain('type must be a valid enum number');

    const stringErr = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 'BAD_VALUE',
      osType: 'LINUX',
      hosts: ['h1'],
    });
    expect((stringErr as any).content?.[0]?.text).toContain('type must be one of');

    const typeErr = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: true,
      osType: 'LINUX',
      hosts: ['h1'],
    });
    expect((typeErr as any).content?.[0]?.text).toContain(
      'type must be a string enum name or enum number'
    );
  });

  it('createHostGroupHandler requires type/osType when omitted and handles empty operation name', async () => {
    createClientMock.mockReturnValue({ createHostGroup: vi.fn() });
    const { createHostGroupHandler } = await import('./host-group-handler.js');

    const missingEnums = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      hosts: ['h1'],
    });
    expect((missingEnums as any).isError).toBe(true);
    expect((missingEnums as any).content?.[0]?.text).toContain('type is required');
    expect((missingEnums as any).content?.[0]?.text).toContain('osType is required');

    createClientMock.mockReturnValue({ createHostGroup: vi.fn().mockResolvedValue([{}]) });
    const noOpName = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 'ISCSI_INITIATOR',
      osType: 'LINUX',
      hosts: ['h1'],
    });
    expect((noOpName as any).structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
      operationId: '',
    });
  });

  it('createHostGroupHandler validates osType and falls back to Unknown error on thrown non-Error', async () => {
    const { createHostGroupHandler } = await import('./host-group-handler.js');

    createClientMock.mockReturnValue({ createHostGroup: vi.fn() });
    const invalidOsType = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 'ISCSI_INITIATOR',
      osType: 'BAD_OS',
      hosts: ['h1'],
    });
    expect((invalidOsType as any).isError).toBe(true);
    expect((invalidOsType as any).content?.[0]?.text).toContain('osType must be one of');

    createClientMock.mockReturnValue({ createHostGroup: vi.fn().mockRejectedValue({}) });
    const unknown = await createHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 'ISCSI_INITIATOR',
      osType: 'LINUX',
      hosts: ['h1'],
    });
    expect((unknown as any).content?.[0]?.text).toContain('Unknown error');
  });

  it('getHostGroupHandler validates required fields and handles client errors', async () => {
    const { getHostGroupHandler } = await import('./host-group-handler.js');

    createClientMock.mockReturnValue({ getHostGroup: vi.fn() });
    const invalid = await getHostGroupHandler({
      projectId: '',
      location: 'us-central1',
      hostGroupId: '',
    });
    expect((invalid as any).isError).toBe(true);
    expect((invalid as any).content?.[0]?.text).toContain('Invalid input:');

    createClientMock.mockReturnValue({
      getHostGroup: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const failed = await getHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
    });
    expect((failed as any).isError).toBe(true);
    expect((failed as any).content?.[0]?.text).toContain('Error getting host group');
  });

  it('getHostGroupHandler falls back name/id when response lacks them', async () => {
    createClientMock.mockReturnValue({ getHostGroup: vi.fn().mockResolvedValue([{}]) });
    const { getHostGroupHandler } = await import('./host-group-handler.js');

    const result = await getHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg-fallback',
    });

    expect((result as any).structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/hostGroups/hg-fallback',
      hostGroupId: 'hg-fallback',
    });
  });

  it('getHostGroupHandler falls back to Unknown error for non-Error throws', async () => {
    createClientMock.mockReturnValue({ getHostGroup: vi.fn().mockRejectedValue({}) });
    const { getHostGroupHandler } = await import('./host-group-handler.js');

    const result = await getHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
    });
    expect((result as any).content?.[0]?.text).toContain('Unknown error');
  });

  it('listHostGroupsHandler validates projectId, derives id from name, and handles errors', async () => {
    const { listHostGroupsHandler } = await import('./host-group-handler.js');

    createClientMock.mockReturnValue({ listHostGroups: vi.fn() });
    const invalid = await listHostGroupsHandler({ projectId: '' });
    expect((invalid as any).isError).toBe(true);
    expect((invalid as any).content?.[0]?.text).toContain('Invalid input:');

    const listHostGroups = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/hostGroups/hg2', hosts: ['h1'] }],
        {},
        undefined,
      ]);
    createClientMock.mockReturnValue({ listHostGroups });
    const ok = await listHostGroupsHandler({ projectId: 'p1', location: 'us-central1' });
    expect((ok as any).structuredContent.hostGroups[0]).toMatchObject({
      hostGroupId: 'hg2',
      name: 'projects/p1/locations/us-central1/hostGroups/hg2',
    });

    createClientMock.mockReturnValue({
      listHostGroups: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const failed = await listHostGroupsHandler({ projectId: 'p1', location: 'us-central1' });
    expect((failed as any).isError).toBe(true);
    expect((failed as any).content?.[0]?.text).toContain('Error listing host groups');
  });

  it('listHostGroupsHandler covers fallback hostGroupId derivation branch', async () => {
    const weirdName = { split: () => [] } as any;
    const listHostGroups = vi
      .fn()
      .mockResolvedValue([[{ name: weirdName, hosts: ['h1'] }], {}, undefined]);
    createClientMock.mockReturnValue({ listHostGroups });

    const { listHostGroupsHandler } = await import('./host-group-handler.js');
    const result = await listHostGroupsHandler({ projectId: 'p1', location: 'us-central1' });
    expect((result as any).structuredContent.hostGroups[0].hostGroupId).toBe('[object Object]');
  });

  it('listHostGroupsHandler covers hostGroup formatting when item is undefined and default location', async () => {
    const listHostGroups = vi.fn().mockResolvedValue([[undefined], {}, undefined]);
    createClientMock.mockReturnValue({ listHostGroups });
    const { listHostGroupsHandler } = await import('./host-group-handler.js');

    const result = await listHostGroupsHandler({ projectId: 'p1' });
    expect((result as any).structuredContent).toEqual({
      hostGroups: [{}],
      nextPageToken: undefined,
    });
    expect(listHostGroups).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/-',
      pageSize: undefined,
      pageToken: undefined,
      filter: undefined,
      orderBy: undefined,
    });
  });

  it('listHostGroupsHandler covers hostGroups fallback [] and Unknown error fallback', async () => {
    const { listHostGroupsHandler } = await import('./host-group-handler.js');

    const listEmpty = vi.fn().mockResolvedValue([undefined, {}, undefined]);
    createClientMock.mockReturnValue({ listHostGroups: listEmpty });
    const empty = await listHostGroupsHandler({ projectId: 'p1', location: 'us-central1' });
    expect((empty as any).structuredContent).toEqual({ hostGroups: [], nextPageToken: undefined });

    createClientMock.mockReturnValue({ listHostGroups: vi.fn().mockRejectedValue({}) });
    const unknown = await listHostGroupsHandler({ projectId: 'p1', location: 'us-central1' });
    expect((unknown as any).content?.[0]?.text).toContain('Unknown error');
  });

  it('listHostGroupsHandler executes hg?.name fallback branch in formatter', async () => {
    let readCount = 0;
    const tricky = {
      get name() {
        readCount += 1;
        return readCount === 1 ? '' : 'projects/p1/locations/us-central1/hostGroups/hg-dyn';
      },
    } as any;
    const listHostGroups = vi.fn().mockResolvedValue([[tricky], {}, undefined]);
    createClientMock.mockReturnValue({ listHostGroups });
    const { listHostGroupsHandler } = await import('./host-group-handler.js');

    const result = await listHostGroupsHandler({ projectId: 'p1', location: 'us-central1' });
    expect((result as any).structuredContent.hostGroups[0]).toMatchObject({
      name: 'projects/p1/locations/us-central1/hostGroups/hg-dyn',
      hostGroupId: 'hg-dyn',
    });
  });

  it('updateHostGroupHandler validates enum/hosts/description/labels/updateMask and handles errors', async () => {
    const { updateHostGroupHandler } = await import('./host-group-handler.js');

    createClientMock.mockReturnValue({ updateHostGroup: vi.fn() });
    const invalidType = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 99,
    });
    expect((invalidType as any).isError).toBe(true);
    expect((invalidType as any).content?.[0]?.text).toContain('type must be a valid enum number');

    const invalidHosts = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      hosts: ['ok', ''],
    });
    expect((invalidHosts as any).content?.[0]?.text).toContain('hosts must be an array of strings');

    const invalidDescription = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      description: 123,
    });
    expect((invalidDescription as any).content?.[0]?.text).toContain(
      'description must be a string'
    );

    const invalidLabels = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      labels: ['bad'],
    });
    expect((invalidLabels as any).content?.[0]?.text).toContain(
      'labels must be an object of string:string'
    );

    const noUpdates = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
    });
    expect((noUpdates as any).isError).toBe(true);
    expect((noUpdates as any).content?.[0]?.text).toContain('At least one field must be provided');

    createClientMock.mockReturnValue({
      updateHostGroup: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const failed = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      description: 'ok',
    });
    expect((failed as any).isError).toBe(true);
    expect((failed as any).content?.[0]?.text).toContain('Error updating host group');
  });

  it('updateHostGroupHandler supports valid type and labels updates', async () => {
    const updateHostGroup = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateHostGroup });
    const { updateHostGroupHandler } = await import('./host-group-handler.js');

    const result = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      type: 'ISCSI_INITIATOR',
      labels: { a: 'b' },
    });

    expect(updateHostGroup).toHaveBeenCalledWith({
      hostGroup: {
        name: 'projects/p1/locations/us-central1/hostGroups/hg1',
        type: 1,
        labels: { a: 'b' },
      },
      updateMask: { paths: expect.arrayContaining(['type', 'labels']) },
    });
    expect((result as any).structuredContent.operationId).toBe('op-upd2');
  });

  it('updateHostGroupHandler handles osType updates, empty operation name, and unknown-error fallback', async () => {
    const { updateHostGroupHandler } = await import('./host-group-handler.js');

    const updateHostGroup = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ updateHostGroup });
    const ok = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      osType: 'ESXI',
    });
    expect(updateHostGroup).toHaveBeenCalledWith({
      hostGroup: {
        name: 'projects/p1/locations/us-central1/hostGroups/hg1',
        osType: 3,
      },
      updateMask: { paths: ['os_type'] },
    });
    expect((ok as any).structuredContent.operationId).toBe('');

    createClientMock.mockReturnValue({ updateHostGroup: vi.fn().mockRejectedValue({}) });
    const unknown = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      description: 'd',
    });
    expect((unknown as any).content?.[0]?.text).toContain('Unknown error');
  });

  it('updateHostGroupHandler validates invalid osType values', async () => {
    createClientMock.mockReturnValue({ updateHostGroup: vi.fn() });
    const { updateHostGroupHandler } = await import('./host-group-handler.js');

    const invalidOsType = await updateHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
      osType: 'NOT_VALID',
    });
    expect((invalidOsType as any).isError).toBe(true);
    expect((invalidOsType as any).content?.[0]?.text).toContain('osType must be one of');
  });
});

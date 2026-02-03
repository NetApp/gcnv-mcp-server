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

    expect(result.isError).toBe(true);
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
    expect(result.structuredContent.createTime).toBeInstanceOf(Date);
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

  it('deleteHostGroupHandler calls deleteHostGroup and returns operationId', async () => {
    const deleteHostGroup = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteHostGroup });

    const { deleteHostGroupHandler } = await import('./host-group-handler.js');
    const result = await deleteHostGroupHandler({
      projectId: 'p1',
      location: 'us-central1',
      hostGroupId: 'hg1',
    });

    expect(deleteHostGroup).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/hostGroups/hg1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
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

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error creating host group');
  });
});

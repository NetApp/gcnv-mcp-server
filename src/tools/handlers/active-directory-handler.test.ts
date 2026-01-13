import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('../../utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: { createClient: createClientMock },
}));

describe('active-directory-handler', () => {
  beforeEach(() => createClientMock.mockReset());

  it('createActiveDirectoryHandler calls createActiveDirectory and returns operationId', async () => {
    const createActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-create' }]);
    createClientMock.mockReturnValue({ createActiveDirectory });

    const { createActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await createActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      domain: 'example.com',
      username: 'u',
      password: 'p',
    });

    expect(createActiveDirectory).toHaveBeenCalledTimes(1);
    expect(createActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1',
      activeDirectoryId: 'ad1',
      activeDirectory: {
        domain: 'example.com',
        username: 'u',
        password: 'p',
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
      operationId: 'op-create',
    });
  });

  it('createActiveDirectoryHandler includes all optional fields when provided', async () => {
    const createActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-create-all' }]);
    createClientMock.mockReturnValue({ createActiveDirectory });

    const { createActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await createActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      domain: 'example.com',
      site: 'site1',
      dns: '1.1.1.1',
      netBiosPrefix: 'NB',
      organizationalUnit: 'OU=Test,DC=example,DC=com',
      aesEncryption: true,
      username: 'u',
      password: 'p',
      backupOperators: ['bo'],
      administrators: ['admin1'],
      securityOperators: ['so'],
      kdcHostname: 'kdc',
      kdcIp: '10.0.0.1',
      nfsUsersWithLdap: false,
      description: 'd',
      labels: { a: 'b' },
    });

    expect(createActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      parent: 'projects/p1/locations/us-central1',
      activeDirectoryId: 'ad1',
      activeDirectory: {
        domain: 'example.com',
        site: 'site1',
        dns: '1.1.1.1',
        netBiosPrefix: 'NB',
        organizationalUnit: 'OU=Test,DC=example,DC=com',
        aesEncryption: true,
        username: 'u',
        password: 'p',
        backupOperators: ['bo'],
        administrators: ['admin1'],
        securityOperators: ['so'],
        kdcHostname: 'kdc',
        kdcIp: '10.0.0.1',
        nfsUsersWithLdap: false,
        description: 'd',
        labels: { a: 'b' },
      },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-create-all' });
  });

  it('createActiveDirectoryHandler falls back to empty operationId when operation.name is missing', async () => {
    const createActiveDirectory = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ createActiveDirectory });

    const { createActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await createActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      domain: 'example.com',
      username: 'u',
      password: 'p',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
      operationId: '',
    });
  });

  it('deleteActiveDirectoryHandler calls deleteActiveDirectory', async () => {
    const deleteActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-del' }]);
    createClientMock.mockReturnValue({ deleteActiveDirectory });

    const { deleteActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await deleteActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
    });

    expect(deleteActiveDirectory).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
    });
    expect(result.structuredContent).toEqual({ success: true, operationId: 'op-del' });
  });

  it('deleteActiveDirectoryHandler falls back to empty operationId when operation.name is missing', async () => {
    const deleteActiveDirectory = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ deleteActiveDirectory });

    const { deleteActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await deleteActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
    });

    expect(result.structuredContent).toEqual({ success: true, operationId: '' });
  });

  it('getActiveDirectoryHandler calls getActiveDirectory and returns formatted AD', async () => {
    const getActiveDirectory = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        domain: 'example.com',
        createTime: { seconds: 1 },
      },
    ]);
    createClientMock.mockReturnValue({ getActiveDirectory });

    const { getActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await getActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
    });

    expect(getActiveDirectory).toHaveBeenCalledWith({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
    });
    expect(result.structuredContent).toMatchObject({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
      activeDirectoryId: 'ad1',
      domain: 'example.com',
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getActiveDirectoryHandler formats all optional fields', async () => {
    const getActiveDirectory = vi.fn().mockResolvedValue([
      {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        domain: 'example.com',
        site: 'site1',
        dns: '1.1.1.1',
        netBiosPrefix: 'NB',
        organizationalUnit: 'OU=Test,DC=example,DC=com',
        aesEncryption: true,
        state: 'READY',
        createTime: { seconds: 1 },
        description: 'd',
        labels: { a: 'b' },
      },
    ]);
    createClientMock.mockReturnValue({ getActiveDirectory });

    const { getActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await getActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
    });

    expect(result.structuredContent).toMatchObject({
      activeDirectoryId: 'ad1',
      domain: 'example.com',
      site: 'site1',
      dns: '1.1.1.1',
      netBiosPrefix: 'NB',
      organizationalUnit: 'OU=Test,DC=example,DC=com',
      aesEncryption: true,
      state: 'READY',
      description: 'd',
      labels: { a: 'b' },
    });
    expect((result.structuredContent as any).createTime).toBeInstanceOf(Date);
  });

  it('getActiveDirectoryHandler returns empty structuredContent when AD is undefined', async () => {
    const getActiveDirectory = vi.fn().mockResolvedValue([undefined]);
    createClientMock.mockReturnValue({ getActiveDirectory });

    const { getActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await getActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
    });

    expect(result.structuredContent).toEqual({});
  });

  it('listActiveDirectoriesHandler calls listActiveDirectories and returns formatted list', async () => {
    const listActiveDirectories = vi
      .fn()
      .mockResolvedValue([
        [{ name: 'projects/p1/locations/us-central1/activeDirectories/ad1' }],
        undefined,
        { nextPageToken: 'next' },
      ]);
    createClientMock.mockReturnValue({ listActiveDirectories });

    const { listActiveDirectoriesHandler } = await import('./active-directory-handler.js');
    const result = await listActiveDirectoriesHandler({ projectId: 'p1', location: 'us-central1' });

    expect(listActiveDirectories).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
    });
    expect(result.structuredContent).toMatchObject({
      activeDirectories: [expect.objectContaining({ activeDirectoryId: 'ad1' })],
      nextPageToken: 'next',
    });
  });

  it('listActiveDirectoriesHandler passes filter/pageSize/pageToken when provided', async () => {
    const listActiveDirectories = vi
      .fn()
      .mockResolvedValue([[], undefined, { nextPageToken: 'next' }]);
    createClientMock.mockReturnValue({ listActiveDirectories });

    const { listActiveDirectoriesHandler } = await import('./active-directory-handler.js');
    const result = await listActiveDirectoriesHandler({
      projectId: 'p1',
      location: 'us-central1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
    });

    expect(listActiveDirectories).toHaveBeenCalledWith({
      parent: 'projects/p1/locations/us-central1',
      filter: 'state=READY',
      pageSize: 10,
      pageToken: 'pt',
    });
    expect(result.structuredContent).toMatchObject({
      activeDirectories: [],
      nextPageToken: 'next',
    });
  });

  it('updateActiveDirectoryHandler calls updateActiveDirectory with updateMask', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      dns: '1.1.1.1',
      description: 'd',
    });

    expect(updateActiveDirectory).toHaveBeenCalledTimes(1);
    expect(updateActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      activeDirectory: {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        dns: '1.1.1.1',
        description: 'd',
      },
      updateMask: { paths: expect.arrayContaining(['dns', 'description']) },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
      operationId: 'op-upd',
    });
  });

  it('updateActiveDirectoryHandler falls back to empty operationId when operation.name is missing', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{}]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      dns: '1.1.1.1',
    });

    expect(result.structuredContent).toEqual({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
      operationId: '',
    });
  });

  it('returns isError for each handler when the underlying client call throws', async () => {
    const err = new Error('boom');
    createClientMock.mockReturnValue({
      createActiveDirectory: vi.fn().mockRejectedValue(err),
      deleteActiveDirectory: vi.fn().mockRejectedValue(err),
      getActiveDirectory: vi.fn().mockRejectedValue(err),
      listActiveDirectories: vi.fn().mockRejectedValue(err),
      updateActiveDirectory: vi.fn().mockRejectedValue(err),
    });

    const {
      createActiveDirectoryHandler,
      deleteActiveDirectoryHandler,
      getActiveDirectoryHandler,
      listActiveDirectoriesHandler,
      updateActiveDirectoryHandler,
    } = await import('./active-directory-handler.js');

    expect(
      (
        (await createActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
        })) as any
      ).isError
    ).toBe(true);
    expect(
      (
        (await deleteActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
        })) as any
      ).isError
    ).toBe(true);
    expect(
      (
        (await getActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
        })) as any
      ).isError
    ).toBe(true);
    expect(
      ((await listActiveDirectoriesHandler({ projectId: 'p1', location: 'l' })) as any).isError
    ).toBe(true);
    expect(
      (
        (await updateActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
          dns: 'd',
        })) as any
      ).isError
    ).toBe(true);
  });

  it('handlers fall back to "Unknown error" when error.message is missing', async () => {
    const err = { code: 500 } as any;
    const {
      createActiveDirectoryHandler,
      deleteActiveDirectoryHandler,
      getActiveDirectoryHandler,
      listActiveDirectoriesHandler,
      updateActiveDirectoryHandler,
    } = await import('./active-directory-handler.js');

    createClientMock.mockReturnValue({ createActiveDirectory: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await createActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
        })) as any
      ).content[0].text
    ).toContain('Unknown error');

    createClientMock.mockReturnValue({ deleteActiveDirectory: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await deleteActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
        })) as any
      ).content[0].text
    ).toContain('Unknown error');

    createClientMock.mockReturnValue({ getActiveDirectory: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await getActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
        })) as any
      ).content[0].text
    ).toContain('Unknown error');

    createClientMock.mockReturnValue({ listActiveDirectories: vi.fn().mockRejectedValue(err) });
    expect(
      ((await listActiveDirectoriesHandler({ projectId: 'p1', location: 'l' })) as any).content[0]
        .text
    ).toContain('Unknown error');

    createClientMock.mockReturnValue({ updateActiveDirectory: vi.fn().mockRejectedValue(err) });
    expect(
      (
        (await updateActiveDirectoryHandler({
          projectId: 'p1',
          location: 'l',
          activeDirectoryId: 'ad1',
          dns: 'd',
        })) as any
      ).content[0].text
    ).toContain('Unknown error');
  });

  it('updateActiveDirectoryHandler includes additional fields in updateMask when provided', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd2' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      backupOperators: ['bo'],
      administrators: ['admin1'],
      securityOperators: ['so'],
      kdcHostname: 'kdc-host',
      kdcIp: '10.0.0.1',
      nfsUsersWithLdap: true,
      labels: { a: 'b' },
    });

    expect(updateActiveDirectory).toHaveBeenCalledTimes(1);
    expect(updateActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      activeDirectory: {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        backupOperators: ['bo'],
        administrators: ['admin1'],
        securityOperators: ['so'],
        kdcHostname: 'kdc-host',
        kdcIp: '10.0.0.1',
        nfsUsersWithLdap: true,
        labels: { a: 'b' },
      },
      updateMask: {
        paths: expect.arrayContaining([
          'backup_operators',
          'administrators',
          'security_operators',
          'kdc_hostname',
          'kdc_ip',
          'nfs_users_with_ldap',
          'labels',
        ]),
      },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd2' });
  });

  it('updateActiveDirectoryHandler includes username/password in updateMask when provided', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd3' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      username: 'u',
      password: 'p',
    });

    expect(updateActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      activeDirectory: {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        username: 'u',
        password: 'p',
      },
      updateMask: { paths: expect.arrayContaining(['username', 'password']) },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd3' });
  });

  it('updateActiveDirectoryHandler includes organizationalUnit and aesEncryption in updateMask when provided', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd4' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      organizationalUnit: 'OU=Test,DC=example,DC=com',
      aesEncryption: true,
    });

    expect(updateActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      activeDirectory: {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        organizationalUnit: 'OU=Test,DC=example,DC=com',
        aesEncryption: true,
      },
      updateMask: { paths: expect.arrayContaining(['organizational_unit', 'aes_encryption']) },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd4' });
  });

  it('updateActiveDirectoryHandler includes site and netBiosPrefix in updateMask when provided', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd5' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      site: 'site1',
      netBiosPrefix: 'NB',
    });

    expect(updateActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      activeDirectory: {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        site: 'site1',
        netBiosPrefix: 'NB',
      },
      updateMask: { paths: expect.arrayContaining(['site', 'net_bios_prefix']) },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd5' });
  });

  it('updateActiveDirectoryHandler includes domain in updateMask when provided', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd6' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      domain: 'example.com',
    });

    expect(updateActiveDirectory.mock.calls[0]?.[0]).toMatchObject({
      activeDirectory: {
        name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
        domain: 'example.com',
      },
      updateMask: { paths: ['domain'] },
    });
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd6' });
  });

  it('updateActiveDirectoryHandler includes all updateable fields in updateMask when provided', async () => {
    const updateActiveDirectory = vi.fn().mockResolvedValue([{ name: 'op-upd-all' }]);
    createClientMock.mockReturnValue({ updateActiveDirectory });

    const { updateActiveDirectoryHandler } = await import('./active-directory-handler.js');
    const result = await updateActiveDirectoryHandler({
      projectId: 'p1',
      location: 'us-central1',
      activeDirectoryId: 'ad1',
      domain: 'example.com',
      site: 'site1',
      dns: '1.1.1.1',
      netBiosPrefix: 'NB',
      organizationalUnit: 'OU=Test,DC=example,DC=com',
      aesEncryption: true,
      username: 'u',
      password: 'p',
      backupOperators: ['bo'],
      administrators: ['admin1'],
      securityOperators: ['so'],
      kdcHostname: 'kdc',
      kdcIp: '10.0.0.1',
      nfsUsersWithLdap: true,
      description: 'd',
      labels: { a: 'b' },
    });

    const req = updateActiveDirectory.mock.calls[0]?.[0];
    expect(req.activeDirectory).toMatchObject({
      name: 'projects/p1/locations/us-central1/activeDirectories/ad1',
      domain: 'example.com',
      site: 'site1',
      dns: '1.1.1.1',
      netBiosPrefix: 'NB',
      organizationalUnit: 'OU=Test,DC=example,DC=com',
      aesEncryption: true,
      username: 'u',
      password: 'p',
      backupOperators: ['bo'],
      administrators: ['admin1'],
      securityOperators: ['so'],
      kdcHostname: 'kdc',
      kdcIp: '10.0.0.1',
      nfsUsersWithLdap: true,
      description: 'd',
      labels: { a: 'b' },
    });
    expect(req.updateMask.paths).toEqual(
      expect.arrayContaining([
        'domain',
        'site',
        'dns',
        'net_bios_prefix',
        'organizational_unit',
        'aes_encryption',
        'username',
        'password',
        'backup_operators',
        'administrators',
        'security_operators',
        'kdc_hostname',
        'kdc_ip',
        'nfs_users_with_ldap',
        'description',
        'labels',
      ])
    );
    expect(result.structuredContent).toMatchObject({ operationId: 'op-upd-all' });
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerAllTools } from '../../src/registry/register-tools.js';
import { NetAppClientFactory } from '../../src/utils/netapp-client-factory.js';
import { startMockNetAppServer, MockServerHandle } from './mock-netapp-server.js';

type RegisteredMapping = Record<
  string,
  { tool: { name: string }; handler: (args: Record<string, unknown>, extra: unknown) => Promise<any> }
>;

describe('MCP tools end-to-end with mock NetApp server', () => {
  let serverHandle: MockServerHandle;
  const registeredTools: RegisteredMapping = {};

  beforeAll(async () => {
    serverHandle = await startMockNetAppServer();
    process.env.NETAPP_MOCK_SERVER_URL = serverHandle.url;
    NetAppClientFactory.reset();

    const mockMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        registeredTools[name] = { tool, handler };
      },
    } as unknown as McpServer;

    registerAllTools(mockMcpServer);
  });

  afterAll(async () => {
    delete process.env.NETAPP_MOCK_SERVER_URL;
    NetAppClientFactory.reset();
    await serverHandle.close();
  });

  it('lists storage pools through registered handler', async () => {
    const handler = registeredTools['gcnv_storage_pool_list'].handler;
    const result = await handler(
      { projectId: 'proj', location: 'us-central1' },
      {},
    );

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        storagePools: [
          expect.objectContaining({
            storagePoolId: 'pool-1',
            serviceLevel: 'PREMIUM',
            capacityGib: 1024,
          }),
        ],
        nextPageToken: '',
      }),
    );
  });

  it('lists volumes through registered handler', async () => {
    const handler = registeredTools['gcnv_volume_list'].handler;
    const result = await handler(
      { projectId: 'proj', location: 'us-central1' },
      {},
    );

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        volumes: [
          expect.objectContaining({
            volumeId: 'vol-1',
            storagePool: 'projects/proj/locations/us-central1/storagePools/pool-1',
            capacityGib: 256,
          }),
        ],
      }),
    );
  });

  it('lists snapshots through registered handler', async () => {
    const handler = registeredTools['gcnv_snapshot_list'].handler;
    const result = await handler(
      { projectId: 'proj', location: 'us-central1', volumeId: 'vol-1' },
      {},
    );

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        snapshots: [
          expect.objectContaining({
            snapshotId: 'snap-1',
            state: 'READY',
          }),
        ],
        nextPageToken: '',
      }),
    );
  });

  it('lists backups through registered handler', async () => {
    const handler = registeredTools['gcnv_backup_list'].handler;
    const result = await handler(
      { projectId: 'proj', location: 'us-central1', backupVaultId: 'vault-1' },
      {},
    );

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        backups: [
          expect.objectContaining({
            backupId: 'backup-1',
            state: 'READY',
            sourceVolume: 'projects/proj/locations/us-central1/volumes/vol-1',
          }),
        ],
      }),
    );
  });

  it('lists backup vaults through registered handler', async () => {
    const handler = registeredTools['gcnv_backup_vault_list'].handler;
    const result = await handler(
      { projectId: 'proj', location: 'us-central1' },
      {},
    );

    expect(result.structuredContent?.backupVaults?.[0]).toEqual(
      expect.objectContaining({
        backupVaultId: 'vault-1',
        state: 'READY',
      }),
    );
  });

  it('lists replications through registered handler', async () => {
    const handler = registeredTools['gcnv_replication_list'].handler;
    const result = await handler(
      { projectId: 'proj', location: 'us-central1', volumeId: 'vol-1' },
      {},
    );

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        replications: [
          expect.objectContaining({
            replicationId: 'repl-1',
            sourceVolume: 'projects/proj/locations/us-central1/volumes/vol-1',
            state: 'READY',
          }),
        ],
        nextPageToken: '',
      }),
    );
  });
});


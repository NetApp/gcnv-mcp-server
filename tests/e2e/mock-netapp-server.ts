import { createServer, IncomingMessage, ServerResponse } from 'node:http';

interface MockServerData {
  storagePools: any[];
  volumes: any[];
  snapshots: any[];
  backups: any[];
  backupVaults: any[];
  replications: any[];
}

const defaultData: MockServerData = {
  storagePools: [
    {
      name: 'projects/proj/locations/us-central1/storagePools/pool-1',
      capacityGib: 1024,
      volumeCapacityGib: 512,
      volumeCount: 2,
      serviceLevel: 'PREMIUM',
      state: 'READY',
      createTime: { seconds: 1_700_000_000 },
      labels: { env: 'test' },
    },
  ],
  volumes: [
    {
      name: 'projects/proj/locations/us-central1/volumes/vol-1',
      capacityGib: 256,
      usedGib: 128,
      state: 'READY',
      shareName: 'vol-1',
      protocols: ['NFS3'],
      storagePool: 'projects/proj/locations/us-central1/storagePools/pool-1',
      mountOptions: [],
    },
  ],
  snapshots: [
    {
      name: 'projects/proj/locations/us-central1/volumes/vol-1/snapshots/snap-1',
      state: 'READY',
      createTime: { seconds: 1_700_000_050 },
    },
  ],
  backups: [
    {
      name: 'projects/proj/locations/us-central1/backupVaults/vault-1/backups/backup-1',
      state: 'READY',
      sourceVolume: 'projects/proj/locations/us-central1/volumes/vol-1',
      volumeUsagebytes: 1_000,
    },
  ],
  backupVaults: [
    {
      name: 'projects/proj/locations/us-central1/backupVaults/vault-1',
      state: 'READY',
      backupVaultType: 'STANDARD',
      sourceRegion: 'us-central1',
      backupRegion: 'us-central1',
    },
  ],
  replications: [
    {
      name: 'projects/proj/locations/us-central1/replications/repl-1',
      sourceVolume: 'projects/proj/locations/us-central1/volumes/vol-1',
      destinationVolume: 'projects/proj/locations/us-central1/volumes/vol-2',
      state: 'READY',
    },
  ],
};

export interface MockServerHandle {
  url: string;
  close: () => Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

export async function startMockNetAppServer(
  data: MockServerData = defaultData,
): Promise<MockServerHandle> {
  const server = createServer(async (req, res) => {
    if (!req.url || req.method !== 'POST') {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }

    try {
      await readJson(req); // Body is not required for the canned responses.
    } catch (_error) {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    switch (req.url) {
      case '/listStoragePools':
        sendJson(res, 200, { result: [data.storagePools, null, { nextPageToken: '' }] });
        break;
      case '/listVolumes':
        sendJson(res, 200, { result: [data.volumes, null, ''] });
        break;
      case '/listSnapshots':
        sendJson(res, 200, { result: [data.snapshots, null, ''] });
        break;
      case '/listBackups':
        sendJson(res, 200, { result: [data.backups, null, ''] });
        break;
      case '/listBackupVaults':
        sendJson(res, 200, {
          result: [
            { backupVaults: data.backupVaults, nextPageToken: '' },
            null,
            '',
          ],
        });
        break;
      case '/listReplications':
        sendJson(res, 200, { result: [data.replications, null, ''] });
        break;
      default:
        sendJson(res, 404, { error: `No mock response for ${req.url}` });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Failed to start mock NetApp server');
  }

  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}


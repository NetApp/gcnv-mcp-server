import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clientRef = vi.hoisted(() => ({ current: {} as Record<string, any> | undefined }));
const createClientMock = vi.hoisted(() =>
  vi.fn(() => clientRef.current),
);

vi.mock('../../src/utils/netapp-client-factory.js', () => ({
  NetAppClientFactory: {
    createClient: (...args: any[]) => createClientMock(...args),
    clearCache: vi.fn(),
    reset: vi.fn(),
  },
}));

let client: Record<string, any>;

import {
  createBackupPolicyHandler,
  deleteBackupPolicyHandler,
  getBackupPolicyHandler,
  listBackupPoliciesHandler,
  updateBackupPolicyHandler,
} from '../../src/tools/handlers/backup-policy-handler.js';

const baseArgs = {
  projectId: 'proj',
  location: 'us-central1',
  backupPolicyId: 'policy1',
};

beforeEach(() => {
  client = {};
  clientRef.current = client;
  createClientMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('backup policy handlers', () => {
  it('creates a backup policy', async () => {
    client.createBackupPolicy = vi.fn().mockResolvedValue([{ name: 'operations/create' }]);

    const result = await createBackupPolicyHandler(
      { ...baseArgs, dailyBackupLimit: 3, description: 'policy' },
      {},
    );

    expect(client.createBackupPolicy).toHaveBeenCalledWith({
      parent: 'projects/proj/locations/us-central1',
      backupPolicyId: 'policy1',
      backupPolicy: {
        dailyBackupLimit: 3,
        description: 'policy',
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'projects/proj/locations/us-central1/backupPolicy/policy1',
      operationId: 'operations/create',
    });
  });

  it('deletes a backup policy', async () => {
    client.deleteBackupPolicy = vi.fn().mockResolvedValue([{ name: 'operations/delete' }]);

    const result = await deleteBackupPolicyHandler(baseArgs, {});

    expect(client.deleteBackupPolicy).toHaveBeenCalledWith({
      name: 'projects/proj/locations/us-central1/backupPolicies/policy1',
    });
    expect(result.structuredContent).toEqual({
      success: true,
      operationId: 'operations/delete',
    });
  });

  it('retrieves a backup policy', async () => {
    client.getBackupPolicy = vi.fn().mockResolvedValue([
      {
        name: 'projects/proj/locations/us-central1/backupPolicies/policy1',
        dailyBackupLimit: 3,
        weeklyBackupLimit: 2,
        monthlyBackupLimit: 1,
        description: 'policy',
        enabled: true,
        assignedVolumeCount: 2,
        state: 'READY',
        createTime: { seconds: 1700000000 },
        labels: { env: 'test' },
      },
    ]);

    const result = await getBackupPolicyHandler(baseArgs, {});

    expect(result.structuredContent).toMatchObject({
      backupPolicyId: 'policy1',
      dailyBackupLimit: 3,
      enabled: true,
      state: 'READY',
    });
  });

  it('lists backup policies', async () => {
    client.listBackupPolicies = vi.fn().mockResolvedValue([
      {
        backupPolicies: [
          {
            name: 'projects/proj/locations/us-central1/backupPolicies/policy1',
            dailyBackupLimit: 3,
            enabled: true,
            state: 'READY',
          },
        ],
        nextPageToken: 'next-1',
      },
    ]);

    const result = await listBackupPoliciesHandler(
      { projectId: 'proj', location: 'us-central1' },
      {},
    );

    expect(result.structuredContent).toEqual({
      backupPolicies: [
        expect.objectContaining({
          backupPolicyId: 'policy1',
          enabled: true,
          state: 'READY',
        }),
      ],
      nextPageToken: 'next-1',
    });
  });

  it('updates a backup policy', async () => {
    client.updateBackupPolicy = vi.fn().mockResolvedValue([
      { name: 'operations/update', metadata: { target: 'target' } },
    ]);

    const result = await updateBackupPolicyHandler(
      { ...baseArgs, description: 'new', labels: { env: 'prod' }, enabled: false },
      {},
    );

    expect(client.updateBackupPolicy).toHaveBeenCalledWith({
      backupPolicy: {
        name: 'projects/proj/locations/us-central1/backupPolicies/policy1',
        description: 'new',
        enabled: false,
        labels: { env: 'prod' },
      },
      updateMask: {
        paths: ['description', 'enabled', 'labels'],
      },
    });
    expect(result.structuredContent).toEqual({
      name: 'target',
      operationId: 'operations/update',
    });
  });
});


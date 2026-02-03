import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStoragePoolTool } from './storage-pool-tools.js';

describe('storage-pool-tools', () => {
  it('createStoragePoolTool accepts FLEX service level (case-insensitive)', () => {
    const schema = z.object(createStoragePoolTool.inputSchema);

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'FLEX',
      })
    ).not.toThrow();

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'flex',
      })
    ).not.toThrow();
  });

  it('createStoragePoolTool accepts totalThroughputMibps for FLEX pools (validation is enforced in handler)', () => {
    const schema = z.object(createStoragePoolTool.inputSchema);

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'FLEX',
        totalThroughputMibps: 512,
      })
    ).not.toThrow();
  });

  it('createStoragePoolTool accepts storagePoolType values (validation is enforced in handler)', () => {
    const schema = z.object(createStoragePoolTool.inputSchema);

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'FLEX',
        storagePoolType: 'UNIFIED_LARGE_CAPACITY',
      })
    ).not.toThrow();

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'standard',
        storagePoolType: 'FILE',
      })
    ).not.toThrow();
  });
});

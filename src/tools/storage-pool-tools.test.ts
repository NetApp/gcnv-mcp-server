import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStoragePoolTool, updateStoragePoolTool } from './storage-pool-tools.js';

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

  it('createStoragePoolTool accepts valid storagePoolType values and rejects removed UNIFIED_LARGE_CAPACITY', () => {
    const schema = z.object(createStoragePoolTool.inputSchema);

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'FLEX',
        storagePoolType: 'UNIFIED',
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

    // Negative: UNIFIED_LARGE_CAPACITY was removed from the enum; schema must reject it
    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'FLEX',
        storagePoolType: 'UNIFIED_LARGE_CAPACITY',
      })
    ).toThrow();
  });

  it('createStoragePoolTool accepts scaleType values', () => {
    const schema = z.object(createStoragePoolTool.inputSchema);

    for (const scaleType of [
      'SCALE_TYPE_UNSPECIFIED',
      'SCALE_TYPE_DEFAULT',
      'SCALE_TYPE_SCALEOUT',
    ]) {
      expect(() =>
        schema.parse({
          projectId: 'p1',
          location: 'us-central1',
          storagePoolId: 'sp1',
          capacityGib: 100,
          serviceLevel: 'FLEX',
          storagePoolType: 'UNIFIED',
          scaleType,
        })
      ).not.toThrow();
    }

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        capacityGib: 100,
        serviceLevel: 'FLEX',
        storagePoolType: 'UNIFIED',
        scaleType: 'INVALID_SCALE_TYPE',
      })
    ).toThrow();
  });

  it('createStoragePoolTool accepts DEFAULT and ONTAP mode (case-insensitive) and rejects other values', () => {
    const schema = z.object(createStoragePoolTool.inputSchema);

    const base = {
      projectId: 'p1',
      location: 'us-central1',
      storagePoolId: 'sp1',
      capacityGib: 100,
      serviceLevel: 'FLEX',
      storagePoolType: 'UNIFIED',
      network: 'net1',
    };

    for (const mode of ['DEFAULT', 'ONTAP', 'default', 'ontap']) {
      expect(() => schema.parse({ ...base, mode })).not.toThrow();
    }

    for (const mode of ['INVALID', 'FILE', 123]) {
      expect(() => schema.parse({ ...base, mode })).toThrow();
    }
  });

  it('updateStoragePoolTool accepts totalThroughputMibps input', () => {
    const schema = z.object(updateStoragePoolTool.inputSchema);

    expect(() =>
      schema.parse({
        projectId: 'p1',
        location: 'us-central1',
        storagePoolId: 'sp1',
        totalThroughputMibps: 512,
      })
    ).not.toThrow();
  });
});

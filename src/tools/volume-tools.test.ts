import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createVolumeTool, updateVolumeTool } from './volume-tools.js';

describe('volume-tools snapshotPolicy', () => {
  const baseCreate = {
    projectId: 'p1',
    location: 'us-central1',
    storagePoolId: 'sp1',
    volumeId: 'vol1',
    capacityGib: 100,
    protocols: ['NFSV3'] as const,
  };

  const baseUpdate = {
    projectId: 'p1',
    location: 'us-central1',
    volumeId: 'vol1',
  };

  it('createVolumeTool accepts a non-empty snapshotPolicy', () => {
    const schema = z.object(createVolumeTool.inputSchema);
    expect(() =>
      schema.parse({
        ...baseCreate,
        snapshotPolicy: {
          enabled: true,
          dailySchedule: { snapshotsToKeep: 7, hour: 6, minute: 0 },
        },
      })
    ).not.toThrow();
  });

  it('createVolumeTool rejects empty snapshotPolicy', () => {
    const schema = z.object(createVolumeTool.inputSchema);
    expect(() => schema.parse({ ...baseCreate, snapshotPolicy: {} })).toThrow();
  });

  it('createVolumeTool rejects unknown snapshotPolicy keys', () => {
    const schema = z.object(createVolumeTool.inputSchema);
    expect(() =>
      schema.parse({
        ...baseCreate,
        snapshotPolicy: { daily_schedule: { snapshotsToKeep: 7 } },
      })
    ).toThrow();
  });

  it('createVolumeTool rejects unknown keys inside a schedule object', () => {
    const schema = z.object(createVolumeTool.inputSchema);
    expect(() =>
      schema.parse({
        ...baseCreate,
        snapshotPolicy: { dailySchedule: { snapshots_to_keep: 7 } },
      })
    ).toThrow();
  });

  it('updateVolumeTool accepts a non-empty snapshotPolicy', () => {
    const schema = z.object(updateVolumeTool.inputSchema);
    expect(() =>
      schema.parse({
        ...baseUpdate,
        snapshotPolicy: {
          enabled: true,
          dailySchedule: { snapshotsToKeep: 7, hour: 2, minute: 0 },
        },
      })
    ).not.toThrow();
  });

  it('updateVolumeTool rejects empty snapshotPolicy', () => {
    const schema = z.object(updateVolumeTool.inputSchema);
    expect(() => schema.parse({ ...baseUpdate, snapshotPolicy: {} })).toThrow();
  });

  it('updateVolumeTool rejects snapshotsToKeep of zero', () => {
    const schema = z.object(updateVolumeTool.inputSchema);
    expect(() =>
      schema.parse({
        ...baseUpdate,
        snapshotPolicy: { dailySchedule: { snapshotsToKeep: 0, hour: 2, minute: 0 } },
      })
    ).toThrow();
  });
});

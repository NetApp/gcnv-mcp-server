/**
 * Regression tests documenting MCP output validation failures before this fix
 * and the handler output that passes after formatting.
 *
 * "Pre-fix handler output" = raw GCNV/protobuf values the old handlers copied through.
 * "Pre-fix schema" = output schemas on main before this PR (where they differ).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getBackupTool, listBackupsTool } from './backup-tools.js';
import { getReplicationTool, listReplicationsTool } from './replication-tools.js';
import {
  formatProtobufTimestamp,
  normalizeNamedEnum,
  normalizeQuotaType,
  normalizeStringEnum,
  toInt64Number,
} from '../utils/proto-format-utils.js';

const backupBase = {
  name: 'projects/p1/locations/us-central1/backupVaults/bv1/backups/b1',
  backupId: 'b1',
  backupVaultId: 'bv1',
  state: 'READY',
  sourceVolume: 'projects/p1/locations/us-central1/volumes/vol1',
};

/** Schemas from main before this PR — used to prove the customer-visible failure mode. */
const preFixListBackupItemSchema = z.object({
  ...listBackupsTool.outputSchema.backups.element.shape,
  enforcedRetentionEndTime: z
    .number()
    .optional()
    .describe('The number of days the backup is retained'),
});

const preFixListBackupsOutputSchema = z.object({
  backups: z.array(preFixListBackupItemSchema),
  nextPageToken: listBackupsTool.outputSchema.nextPageToken,
});

const preFixGetReplicationOutputSchema = z.object({
  ...getReplicationTool.outputSchema,
  lastReplicationTime: z
    .date()
    .optional()
    .describe('The timestamp of the last successful replication'),
});

const currentListBackupsOutputSchema = z.object(listBackupsTool.outputSchema);
const currentGetBackupOutputSchema = z.object(getBackupTool.outputSchema);
const currentGetReplicationOutputSchema = z.object(getReplicationTool.outputSchema);
const currentListReplicationsOutputSchema = z.object(listReplicationsTool.outputSchema);

function expectSchemaRejection(
  schema: z.ZodTypeAny,
  value: unknown,
  messageFragment: string
): void {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.message).toContain(messageFragment);
  }
}

describe('MCP output schema regression', () => {
  describe('gcnv_backup_list / gcnv_backup_get — enforcedRetentionEndTime', () => {
    const apiBackup = {
      ...backupBase,
      enforcedRetentionEndTime: { seconds: 1234567890, nanos: 500_000_000 },
    };

    /** Old handler copied the protobuf Timestamp object unchanged. */
    const preFixHandlerOutput = {
      backups: [apiBackup],
    };

    it('pre-fix FAILS: protobuf Timestamp rejected by old schema (expected number)', () => {
      expectSchemaRejection(
        preFixListBackupsOutputSchema,
        preFixHandlerOutput,
        'Expected number, received object'
      );
    });

    it('pre-fix FAILS: protobuf Timestamp rejected by current schema (expected string)', () => {
      expectSchemaRejection(
        currentListBackupsOutputSchema,
        preFixHandlerOutput,
        'Expected string, received object'
      );
    });

    it('post-fix PASSES: ISO string from formatProtobufTimestamp accepted by current schema', () => {
      const formatted = {
        backups: [
          {
            ...backupBase,
            enforcedRetentionEndTime: formatProtobufTimestamp(
              apiBackup.enforcedRetentionEndTime
            ),
          },
        ],
      };

      expect(formatted.backups[0].enforcedRetentionEndTime).toBe('2009-02-13T23:31:30.500Z');
      expect(() => currentListBackupsOutputSchema.parse(formatted)).not.toThrow();
      expect(() => currentGetBackupOutputSchema.parse(formatted.backups[0])).not.toThrow();
    });
  });

  describe('gcnv_backup_list / gcnv_backup_get — int64 byte fields', () => {
    const preFixHandlerOutput = {
      backups: [
        {
          ...backupBase,
          volumeUsagebytes: '12345',
          chainStoragebytes: '67890',
        },
      ],
    };

    it('pre-fix FAILS: string int64 values rejected by schema (expected number)', () => {
      expectSchemaRejection(
        currentListBackupsOutputSchema,
        preFixHandlerOutput,
        'Expected number, received string'
      );
    });

    it('post-fix PASSES: coerced numbers accepted by current schema', () => {
      const formatted = {
        backups: [
          {
            ...backupBase,
            volumeUsagebytes: toInt64Number('12345'),
            chainStoragebytes: toInt64Number('67890'),
          },
        ],
      };

      expect(() => currentListBackupsOutputSchema.parse(formatted)).not.toThrow();
    });
  });

  describe('gcnv_backup_list — required sourceVolume', () => {
    const preFixHandlerOutput = {
      backups: [
        {
          name: backupBase.name,
          backupId: backupBase.backupId,
          backupVaultId: backupBase.backupVaultId,
          state: backupBase.state,
        },
      ],
    };

    it('pre-fix FAILS: missing sourceVolume rejected as required field', () => {
      expectSchemaRejection(currentListBackupsOutputSchema, preFixHandlerOutput, 'sourceVolume');
    });

    it('post-fix PASSES: placeholder sourceVolume accepted by current schema', () => {
      const formatted = {
        backups: [
          {
            ...preFixHandlerOutput.backups[0],
            sourceVolume:
              'projects/p1/locations/us-central1/storagePools/unknown/volumes/unknown',
          },
        ],
      };

      expect(() => currentListBackupsOutputSchema.parse(formatted)).not.toThrow();
    });
  });

  describe('gcnv_replication_get / gcnv_replication_list — lastReplicationTime', () => {
    const replicationBase = {
      name: 'projects/p1/locations/us-central1/volumes/vol1/replications/r1',
      replicationId: 'r1',
      sourceVolume: 'src',
      destinationVolume: 'dst',
      state: 'READY',
      createTime: '1970-01-01T00:00:01.000Z',
    };

    /** Old handler formatted transferStats.lastTransferEndTime to ISO string. */
    const preFixHandlerOutput = {
      ...replicationBase,
      lastReplicationTime: '2009-02-13T23:31:30.000Z',
    };

    it('pre-fix FAILS: ISO string rejected by old schema (expected date)', () => {
      expectSchemaRejection(
        preFixGetReplicationOutputSchema,
        preFixHandlerOutput,
        'Expected date, received string'
      );
    });

    it('post-fix PASSES: ISO string accepted by current string schema', () => {
      expect(() => currentGetReplicationOutputSchema.parse(preFixHandlerOutput)).not.toThrow();
      expect(() =>
        currentListReplicationsOutputSchema.parse({ replications: [preFixHandlerOutput] })
      ).not.toThrow();
    });

    it('post-fix PASSES: transferStats.lastTransferEndTime mapped to ISO string', () => {
      const apiReplication = {
        ...replicationBase,
        createTime: { seconds: 1 },
        transferStats: { lastTransferEndTime: { seconds: 1234567890, nanos: 0 } },
      };

      const formatted = {
        ...replicationBase,
        lastReplicationTime: formatProtobufTimestamp(
          apiReplication.transferStats.lastTransferEndTime
        ),
      };

      expect(formatted.lastReplicationTime).toBe('2009-02-13T23:31:30.000Z');
      expect(() => currentGetReplicationOutputSchema.parse(formatted)).not.toThrow();
    });
  });

  describe('enum normalization helpers', () => {
    it('pre-fix FAILS: string quota type rejected by z.number() schema', () => {
      const quotaSchema = z.object({ type: z.number() });
      expectSchemaRejection(quotaSchema, { type: 'INDIVIDUAL_USER_QUOTA' }, 'Expected number');
    });

    it('post-fix PASSES: normalized quota type accepted', () => {
      const quotaSchema = z.object({ type: z.number() });
      expect(() =>
        quotaSchema.parse({ type: normalizeQuotaType('INDIVIDUAL_USER_QUOTA') })
      ).not.toThrow();
    });

    it('pre-fix FAILS: numeric KMS state rejected by z.string() schema', () => {
      const kmsSchema = z.object({ state: z.string() });
      expectSchemaRejection(kmsSchema, { state: 2 }, 'Expected string, received number');
    });

    it('post-fix PASSES: normalized KMS state accepted', () => {
      const kmsSchema = z.object({ state: z.string() });
      expect(() => kmsSchema.parse({ state: normalizeStringEnum(2) })).not.toThrow();
      expect(normalizeStringEnum(2)).toBe('UNKNOWN');
    });

    it('pre-fix FAILS: numeric pool qosType rejected by z.string() schema', () => {
      const poolSchema = z.object({ qosType: z.string() });
      expectSchemaRejection(poolSchema, { qosType: 1 }, 'Expected string, received number');
    });

    it('post-fix PASSES: normalized pool qosType accepted', () => {
      const poolSchema = z.object({ qosType: z.string() });
      expect(() =>
        poolSchema.parse({
          qosType: normalizeNamedEnum(1, { 1: 'AUTO', 2: 'MANUAL' }),
        })
      ).not.toThrow();
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatProtobufTimestamp,
  normalizeNamedEnum,
  normalizeQuotaType,
  normalizeStringEnum,
  toInt64Number,
  toInt64String,
} from './proto-format-utils.js';

describe('proto-format-utils', () => {
  it('formatProtobufTimestamp preserves nanos', () => {
    expect(formatProtobufTimestamp({ seconds: 1234567890, nanos: 500_000_000 })).toBe(
      '2009-02-13T23:31:30.500Z'
    );
  });

  it('toInt64Number coerces string int64 values', () => {
    expect(toInt64Number('12345')).toBe(12345);
    expect(toInt64Number(undefined, 7)).toBe(7);
  });

  it('toInt64String preserves decimal int64 strings beyond MAX_SAFE_INTEGER', () => {
    expect(toInt64String('9007199254740993')).toBe('9007199254740993');
    expect(toInt64String('12345')).toBe('12345');
    expect(toInt64String(undefined, '7')).toBe('7');
    expect(toInt64String(42)).toBe('42');
  });

  it('normalizeStringEnum coerces non-string enums', () => {
    expect(normalizeStringEnum('READY')).toBe('READY');
    expect(normalizeStringEnum(1)).toBe('UNKNOWN');
  });

  it('normalizeQuotaType accepts string enum names', () => {
    expect(normalizeQuotaType('INDIVIDUAL_USER_QUOTA')).toBe(1);
  });

  it('normalizeNamedEnum maps numeric enum values to names', () => {
    expect(normalizeNamedEnum(1, { 1: 'AUTO', 2: 'MANUAL' })).toBe('AUTO');
    expect(normalizeNamedEnum('MANUAL', { 1: 'AUTO', 2: 'MANUAL' })).toBe('MANUAL');
  });
});

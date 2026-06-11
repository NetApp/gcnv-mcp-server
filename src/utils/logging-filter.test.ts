import { describe, expect, it } from 'vitest';
import {
  buildGcnvLogFilter,
  normalizeSeverity,
  sanitizeFreeText,
  LogFilterError,
  NETAPP_BASE_FILTER,
} from './logging-filter.js';

describe('buildGcnvLogFilter', () => {
  it('returns the base NetApp clause with no options', () => {
    expect(buildGcnvLogFilter()).toBe(NETAPP_BASE_FILTER);
  });

  it('adds time bounds', () => {
    const f = buildGcnvLogFilter({
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2026-01-02T00:00:00Z',
    });
    expect(f).toContain('timestamp>="2026-01-01T00:00:00Z"');
    expect(f).toContain('timestamp<="2026-01-02T00:00:00Z"');
  });

  it('adds location scoping', () => {
    expect(buildGcnvLogFilter({ location: 'us-central1' })).toContain(
      'protoPayload.resourceName:"/locations/us-central1/"'
    );
  });

  it('maps resourceType to the plural segment', () => {
    expect(buildGcnvLogFilter({ resourceType: 'volume' })).toContain(
      'protoPayload.resourceName:"/volumes/"'
    );
  });

  it('rejects an unknown resourceType', () => {
    expect(() => buildGcnvLogFilter({ resourceType: 'nope' })).toThrow(LogFilterError);
  });

  it('adds a resourceName substring clause', () => {
    expect(buildGcnvLogFilter({ resourceName: 'vol-123' })).toContain(
      'protoPayload.resourceName:"vol-123"'
    );
  });

  it('maps eventType to a method-name regex', () => {
    expect(buildGcnvLogFilter({ eventType: 'delete' })).toContain(
      'protoPayload.methodName=~"Delete"'
    );
  });

  it('rejects an unknown eventType', () => {
    expect(() => buildGcnvLogFilter({ eventType: 'frobnicate' })).toThrow(LogFilterError);
  });

  it('expands method-name wildcards to a regex (escaped for the quoted literal)', () => {
    // "*" -> ".*" and "." -> "\." which is escaped again as "\\." inside the
    // double-quoted Logging string literal.
    expect(buildGcnvLogFilter({ methodName: '*.DeleteVolume' })).toContain(
      'protoPayload.methodName=~".*\\\\.DeleteVolume"'
    );
  });

  it('rejects invalid method-name characters', () => {
    expect(() => buildGcnvLogFilter({ methodName: 'bad name!' })).toThrow(LogFilterError);
  });

  it('adds a minimum severity clause', () => {
    expect(buildGcnvLogFilter({ minSeverity: 'warning' })).toContain('severity>=WARNING');
  });

  it('combines severity OR failures when includeFailures is set', () => {
    expect(buildGcnvLogFilter({ minSeverity: 'error', includeFailures: true })).toContain(
      '(severity>=ERROR OR protoPayload.status.code!=0)'
    );
  });

  it('adds only a failures clause when includeFailures is set without severity', () => {
    expect(buildGcnvLogFilter({ includeFailures: true })).toContain('protoPayload.status.code!=0');
  });

  it('defaults failuresOnly to severity>=ERROR OR failure', () => {
    expect(buildGcnvLogFilter({ failuresOnly: true })).toContain(
      '(severity>=ERROR OR protoPayload.status.code!=0)'
    );
  });

  it('honors a custom min severity with failuresOnly', () => {
    expect(buildGcnvLogFilter({ failuresOnly: true, minSeverity: 'critical' })).toContain(
      '(severity>=CRITICAL OR protoPayload.status.code!=0)'
    );
  });

  it('appends a validated free-text clause in parentheses', () => {
    const f = buildGcnvLogFilter({ freeTextFilter: 'protoPayload.methodName:"CreateVolume"' });
    expect(f).toContain('(protoPayload.methodName:"CreateVolume")');
  });

  it('joins all clauses with AND and always starts with the base clause', () => {
    const f = buildGcnvLogFilter({ resourceType: 'volume', minSeverity: 'error' });
    expect(f.startsWith(NETAPP_BASE_FILTER)).toBe(true);
    expect(f.split(' AND ').length).toBe(3);
  });

  it('validates the location characters', () => {
    expect(() => buildGcnvLogFilter({ location: 'us central1' })).toThrow(LogFilterError);
  });
});

describe('normalizeSeverity', () => {
  it('uppercases and accepts valid severities', () => {
    expect(normalizeSeverity('error')).toBe('ERROR');
  });
  it('throws on invalid severity', () => {
    expect(() => normalizeSeverity('loud')).toThrow(LogFilterError);
  });
});

describe('sanitizeFreeText', () => {
  it('passes balanced input through trimmed', () => {
    expect(sanitizeFreeText('  a="b"  ')).toBe('a="b"');
  });
  it('rejects empty input', () => {
    expect(() => sanitizeFreeText('   ')).toThrow(LogFilterError);
  });
  it('rejects unbalanced quotes', () => {
    expect(() => sanitizeFreeText('a="b')).toThrow(LogFilterError);
  });
  it('rejects unbalanced parentheses', () => {
    expect(() => sanitizeFreeText('(a OR b')).toThrow(LogFilterError);
  });
  it('rejects a closing paren before an opening one', () => {
    expect(() => sanitizeFreeText('a) OR (b')).toThrow(LogFilterError);
  });
  it('rejects control characters', () => {
    expect(() => sanitizeFreeText('a\nb')).toThrow(LogFilterError);
  });
  it('rejects overly long input', () => {
    expect(() => sanitizeFreeText('x'.repeat(2049))).toThrow(LogFilterError);
  });
});

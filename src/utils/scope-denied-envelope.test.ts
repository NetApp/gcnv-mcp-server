import { describe, it, expect } from 'vitest';
import {
  buildScopeDeniedEnvelope,
  isPrivateCliPath,
  PRIVATE_CLI_PATH_PREFIX,
} from './scope-denied-envelope.js';

describe('buildScopeDeniedEnvelope', () => {
  it('produces the canonical envelope shape', () => {
    const envelope = buildScopeDeniedEnvelope({
      source: 'preflight',
      reason: 'Out-of-scope',
    });
    expect(envelope).toEqual({
      error: 'scope_denied',
      retryability: false,
      source: 'preflight',
      reason: 'Out-of-scope',
    });
  });

  it('omits suggested_tool when not provided', () => {
    const envelope = buildScopeDeniedEnvelope({
      source: 'proxy',
      reason: 'Blocked',
    });
    expect(envelope).not.toHaveProperty('suggested_tool');
  });

  it('includes suggested_tool when provided', () => {
    const envelope = buildScopeDeniedEnvelope({
      source: 'ontap',
      reason: 'Forbidden',
      suggested_tool: 'gcnv_volume_update',
    });
    expect(envelope.suggested_tool).toBe('gcnv_volume_update');
  });

  it('always sets retryability to false (never true)', () => {
    const envelope = buildScopeDeniedEnvelope({ source: 'preflight', reason: 'x' });
    expect(envelope.retryability).toBe(false);
  });

  it('preserves reason verbatim (no truncation, no rewriting)', () => {
    const reason = 'A long reason\nwith newlines and "quotes" and 123 numbers.';
    const envelope = buildScopeDeniedEnvelope({ source: 'ontap', reason });
    expect(envelope.reason).toBe(reason);
  });
});

describe('isPrivateCliPath', () => {
  it('matches bare /api/private/cli and subpaths', () => {
    expect(isPrivateCliPath('/api/private/cli')).toBe(true);
    expect(isPrivateCliPath('/api/private/cli/volume')).toBe(true);
    expect(isPrivateCliPath('/api/private/cli/storage/aggregate/show')).toBe(true);
  });

  it('matches the exact prefix without trailing segment', () => {
    expect(isPrivateCliPath(PRIVATE_CLI_PATH_PREFIX + 'x')).toBe(true);
  });

  it('does not match other /api/private/* paths', () => {
    expect(isPrivateCliPath('/api/private/something/else')).toBe(false);
  });

  it('does not match unrelated paths', () => {
    expect(isPrivateCliPath('/api/storage/volumes')).toBe(false);
    expect(isPrivateCliPath('/api/cluster')).toBe(false);
  });

  it('is case-sensitive (ONTAP paths are lowercase by convention)', () => {
    expect(isPrivateCliPath('/API/PRIVATE/CLI/X')).toBe(false);
  });
});

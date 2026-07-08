import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('fs', async () => {
  const actual = (await vi.importActual('fs')) as any;
  return {
    ...actual,
    chmodSync: vi.fn(() => {
      throw new Error('chmod-failed');
    }),
  };
});

vi.mock('../logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const testDir = join(tmpdir(), `gcnv-audit-chmod-test-${Date.now()}`);

describe('ontap-audit-logger chmod fallback', () => {
  beforeEach(async () => {
    const mod = await import('./ontap-audit-logger.js');
    mod._resetAuditState();
  });

  afterEach(async () => {
    const mod = await import('./ontap-audit-logger.js');
    mod._resetAuditState();
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('enables logging even when chmodSync throws', async () => {
    const mod = await import('./ontap-audit-logger.js');
    const path = mod.enableAuditLog(testDir);
    expect(path).toContain('ontap-audit-');
    expect(mod.isAuditEnabled()).toBe(true);
    expect(existsSync(path)).toBe(true);
  });
});

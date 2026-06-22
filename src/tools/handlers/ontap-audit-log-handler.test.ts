import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ontapAuditLogHandler } from './ontap-audit-log-handler.js';
import { _resetAuditState } from '../../utils/ontap-audit-logger.js';

vi.mock('../../logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const testDir = join(tmpdir(), `gcnv-audit-handler-test-${Date.now()}`);

describe('ontapAuditLogHandler', () => {
  beforeEach(() => {
    _resetAuditState();
  });

  afterEach(() => {
    _resetAuditState();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('enable creates log file and returns path', async () => {
    const result = await ontapAuditLogHandler({ action: 'enable', outputDir: testDir });
    const data = JSON.parse(result.content[0].text);

    expect(data.enabled).toBe(true);
    expect(data.logFilePath).toContain('ontap-audit-');
    expect(existsSync(data.logFilePath)).toBe(true);
  });

  it('enable when already enabled returns existing path', async () => {
    await ontapAuditLogHandler({ action: 'enable', outputDir: testDir });
    const result = await ontapAuditLogHandler({ action: 'enable', outputDir: testDir });
    const data = JSON.parse(result.content[0].text);

    expect(data.enabled).toBe(true);
    expect(data.message).toContain('already enabled');
  });

  it('disable after enable returns log path', async () => {
    await ontapAuditLogHandler({ action: 'enable', outputDir: testDir });
    const result = await ontapAuditLogHandler({ action: 'disable' });
    const data = JSON.parse(result.content[0].text);

    expect(data.enabled).toBe(false);
    expect(data.logFilePath).toContain('ontap-audit-');
    expect(data.message).toContain('summary written');
  });

  it('disable when not enabled returns null path', async () => {
    const result = await ontapAuditLogHandler({ action: 'disable' });
    const data = JSON.parse(result.content[0].text);

    expect(data.enabled).toBe(false);
    expect(data.logFilePath).toBeNull();
    expect(data.message).toContain('not active');
  });

  it('status returns enabled=false initially', async () => {
    const result = await ontapAuditLogHandler({ action: 'status' });
    const data = JSON.parse(result.content[0].text);

    expect(data.enabled).toBe(false);
    expect(data.logFilePath).toBeNull();
  });

  it('status returns enabled=true after enable', async () => {
    await ontapAuditLogHandler({ action: 'enable', outputDir: testDir });
    const result = await ontapAuditLogHandler({ action: 'status' });
    const data = JSON.parse(result.content[0].text);

    expect(data.enabled).toBe(true);
    expect(data.logFilePath).toContain('ontap-audit-');
  });

  it('scopes enable/status/disable to the current MCP session', async () => {
    await ontapAuditLogHandler({ action: 'enable', outputDir: testDir }, { sessionId: 'a' });
    await ontapAuditLogHandler({ action: 'enable', outputDir: testDir }, { sessionId: 'b' });

    const statusA = JSON.parse(
      (await ontapAuditLogHandler({ action: 'status' }, { sessionId: 'a' })).content[0].text
    );
    const statusB = JSON.parse(
      (await ontapAuditLogHandler({ action: 'status' }, { sessionId: 'b' })).content[0].text
    );
    expect(statusA.enabled).toBe(true);
    expect(statusB.enabled).toBe(true);
    expect(statusA.logFilePath).not.toBe(statusB.logFilePath);

    await ontapAuditLogHandler({ action: 'disable' }, { sessionId: 'a' });

    const afterA = JSON.parse(
      (await ontapAuditLogHandler({ action: 'status' }, { sessionId: 'a' })).content[0].text
    );
    const afterB = JSON.parse(
      (await ontapAuditLogHandler({ action: 'status' }, { sessionId: 'b' })).content[0].text
    );
    expect(afterA.enabled).toBe(false);
    expect(afterB.enabled).toBe(true);
  });

  it('invalid action returns error', async () => {
    const result = await ontapAuditLogHandler({ action: 'invalid' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid action');
  });

  it('enable returns structured isError when underlying call throws', async () => {
    const auditLogger = await import('../../utils/ontap-audit-logger.js');
    const spy = vi.spyOn(auditLogger, 'enableAuditLog').mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    try {
      const result = await ontapAuditLogHandler({ action: 'enable', outputDir: '/nope' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to enable audit logging');
      expect(result.content[0].text).toContain('EACCES');
      expect(result.content[0].text).toContain('retryable: false');
    } finally {
      spy.mockRestore();
    }
  });

  it('enable uses unknown error fallback when thrown error has no message', async () => {
    const auditLogger = await import('../../utils/ontap-audit-logger.js');
    const spy = vi.spyOn(auditLogger, 'enableAuditLog').mockImplementation(() => {
      throw new Error();
    });
    try {
      const result = await ontapAuditLogHandler({ action: 'enable', outputDir: '/nope' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('unknown error');
    } finally {
      spy.mockRestore();
    }
  });

  it('disable returns structured isError when underlying call throws', async () => {
    await ontapAuditLogHandler({ action: 'enable', outputDir: testDir });
    const auditLogger = await import('../../utils/ontap-audit-logger.js');
    const spy = vi.spyOn(auditLogger, 'disableAuditLog').mockImplementation(() => {
      throw new Error('ENOSPC: no space left on device');
    });
    try {
      const result = await ontapAuditLogHandler({ action: 'disable' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to disable audit logging');
      expect(result.content[0].text).toContain('ENOSPC');
      expect(result.content[0].text).toContain('retryable: false');
    } finally {
      spy.mockRestore();
    }
  });

  it('disable uses unknown error fallback when thrown error has no message', async () => {
    const auditLogger = await import('../../utils/ontap-audit-logger.js');
    const spy = vi.spyOn(auditLogger, 'disableAuditLog').mockImplementation(() => {
      throw new Error();
    });
    try {
      const result = await ontapAuditLogHandler({ action: 'disable' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('unknown error');
    } finally {
      spy.mockRestore();
    }
  });

  it('disable reports multi-file summary message when log spans multiple files', async () => {
    const auditLogger = await import('../../utils/ontap-audit-logger.js');
    const getAllSpy = vi
      .spyOn(auditLogger, 'getAllAuditLogPaths')
      .mockReturnValue(['/tmp/a.jsonl', '/tmp/b.jsonl']);
    const disableSpy = vi
      .spyOn(auditLogger, 'disableAuditLog')
      .mockReturnValue('/tmp/session-summary.jsonl');

    try {
      const result = await ontapAuditLogHandler({ action: 'disable' });
      const data = JSON.parse(result.content[0].text);
      expect(data.enabled).toBe(false);
      expect(data.logFiles).toHaveLength(2);
      expect(data.message).toContain('Log spans 2 files');
    } finally {
      getAllSpy.mockRestore();
      disableSpy.mockRestore();
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { tmpdir } from 'os';
import {
  enableAuditLog,
  disableAuditLog,
  logOperation,
  isAuditEnabled,
  getAuditLogPath,
  withAuditLog,
  _resetAuditState,
} from './ontap-audit-logger.js';

vi.mock('../logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const testDir = join(tmpdir(), `gcnv-audit-test-${Date.now()}`);

function readLog(sessionId?: string): string {
  const path = getAuditLogPath(sessionId);
  return path ? readFileSync(path, 'utf-8') : '';
}

describe('ontap-audit-logger', () => {
  beforeEach(() => {
    _resetAuditState();
  });

  afterEach(() => {
    _resetAuditState();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('enableAuditLog', () => {
    it('creates a log file with markdown header', () => {
      const path = enableAuditLog(testDir);
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('# ONTAP Operation Audit Log');
      expect(content).toContain('Session started');
    });

    it('sets enabled state', () => {
      expect(isAuditEnabled()).toBe(false);
      enableAuditLog(testDir);
      expect(isAuditEnabled()).toBe(true);
    });

    it('returns the log file path', () => {
      const path = enableAuditLog(testDir);
      expect(path).toContain('ontap-audit-');
      expect(path).toContain('.md');
      expect(getAuditLogPath()).toBe(path);
    });

    it('keeps audit state isolated by MCP session ID', () => {
      const sessionA = 'session-a';
      const sessionB = 'session-b';
      const pathA = enableAuditLog(testDir, sessionA);
      const pathB = enableAuditLog(testDir, sessionB);

      expect(pathA).not.toBe(pathB);
      expect(getAuditLogPath(sessionA)).toBe(pathA);
      expect(getAuditLogPath(sessionB)).toBe(pathB);
      expect(isAuditEnabled(sessionA)).toBe(true);
      expect(isAuditEnabled(sessionB)).toBe(true);

      logOperation(
        'ontap_volume_list',
        { storagePoolId: 'pool-a', locationId: 'us-east1' },
        { content: [{ type: 'text', text: '{}' }] },
        100,
        sessionA
      );
      logOperation(
        'ontap_volume_list',
        { storagePoolId: 'pool-b', locationId: 'us-west1' },
        { content: [{ type: 'text', text: '{}' }] },
        100,
        sessionB
      );

      const contentA = readLog(sessionA);
      const contentB = readLog(sessionB);
      expect(contentA).toContain('pool-a');
      expect(contentA).not.toContain('pool-b');
      expect(contentB).toContain('pool-b');
      expect(contentB).not.toContain('pool-a');

      disableAuditLog(sessionA);
      expect(isAuditEnabled(sessionA)).toBe(false);
      expect(isAuditEnabled(sessionB)).toBe(true);
    });

    it('keeps internal schema metadata out of the user-facing header', () => {
      const path = enableAuditLog(testDir);
      const content = readFileSync(path, 'utf-8');
      expect(content).not.toContain('Log schema');
    });

    it('creates the log file with owner-only permissions (0600) on POSIX', () => {
      if (platform() === 'win32') return; // chmod is a no-op on Windows
      const path = enableAuditLog(testDir);
      const mode = statSync(path).mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe('disableAuditLog', () => {
    it('writes session summary and disables', () => {
      enableAuditLog(testDir);
      const path = disableAuditLog();
      expect(path).not.toBeNull();
      expect(isAuditEnabled()).toBe(false);
      const content = readFileSync(path!, 'utf-8');
      expect(content).toContain('Session Summary');
      expect(content).toContain('Total operations');
    });

    it('returns null when not enabled', () => {
      expect(disableAuditLog()).toBeNull();
    });
  });

  describe('logOperation', () => {
    it('appends a SUCCESS entry to the log file', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_svm_list',
        { locationId: 'us-east1', storagePoolId: 'pool1' },
        {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ result: { svmName: 'svm1', aggregateName: 'aggr1' } }),
            },
          ],
        },
        150
      );

      const content = readLog();
      expect(content).toContain('ontap_svm_list');
      expect(content).toContain('SUCCESS');
      expect(content).toContain('svm1');
      expect(content).toContain('us-east1');
    });

    it('appends an ERROR entry to the log file', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_execute',
        {
          method: 'POST',
          ontapApiPath: '/api/storage/volumes',
          locationId: 'us-east1',
          storagePoolId: 'pool1',
        },
        {
          isError: true,
          content: [{ type: 'text', text: 'ONTAP proxy returned 400: Bad request' }],
        },
        200
      );

      const content = readLog();
      expect(content).toContain('**ERROR**');
      expect(content).toContain('POST');
      expect(content).toContain('/api/storage/volumes');
    });

    it('extracts nested ONTAP error messages for visible lines and session summary', () => {
      enableAuditLog(testDir);
      const nestedError = {
        isError: true,
        error: {
          code: '400',
          message:
            'code: 400, message: {\n' +
            '  "error":  {\n' +
            '    "code":  "262179",\n' +
            '    "message":  "Unexpected argument \\"type.name\\".",\n' +
            '    "target":  "type.name"\n' +
            '  }\n' +
            '}',
          target: '/api/network/ip/interfaces',
        },
      };

      logOperation(
        'ontap_execute',
        {
          method: 'GET',
          ontapApiPath: '/api/network/ip/interfaces',
          locationId: 'us-east1',
          storagePoolId: 'pool1',
        },
        {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify(nestedError) }],
        },
        200
      );
      disableAuditLog();

      const content = readLog();
      expect(content).toContain('**Error**: Unexpected argument "type.name".');
      expect(content).toContain('| 1 | ontap_execute |');
      expect(content).toContain('Unexpected argument "type.name".');
      // The failed-operation summary should no longer collapse to "code: 400, message: {".
      expect(content).not.toContain('| code: 400, message: { |');
    });

    it('sanitizes projectId from logged args', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_svm_list',
        { projectId: 'secret-project-123', locationId: 'us-east1', storagePoolId: 'pool1' },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).not.toContain('secret-project-123');
      expect(content).toContain('us-east1');
    });

    it('redacts sensitive keys nested inside a JSON-string body parameter', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_execute',
        {
          method: 'POST',
          ontapApiPath: '/api/protocols/cifs/services',
          storagePoolId: 'pool1',
          locationId: 'us-east1',
          body: JSON.stringify({
            name: 'CIFS_SVR',
            ad_domain: {
              fqdn: 'corp.example.com',
              user: 'svc_account',
              password: 'P@ssw0rd!hunter2',
            },
          }),
        },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).not.toContain('P@ssw0rd!hunter2');
      expect(content).toContain('[REDACTED]');
      // Non-sensitive fields are preserved.
      expect(content).toContain('CIFS_SVR');
      expect(content).toContain('corp.example.com');
    });

    it('redacts sensitive keys when args carry nested objects directly (not JSON strings)', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_execute',
        {
          method: 'POST',
          ontapApiPath: '/api/security/ldap',
          storagePoolId: 'pool1',
          credential: 'my-token-abc',
          ad: { bind_password: 'super-secret', user: 'ldap-svc' },
        },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).not.toContain('my-token-abc');
      expect(content).not.toContain('super-secret');
      expect(content).toContain('[REDACTED]');
      expect(content).toContain('ldap-svc');
    });

    it('redacts sensitive keys echoed back in the response payload', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_execute',
        {
          method: 'POST',
          ontapApiPath: '/api/protocols/cifs/services',
          storagePoolId: 'pool1',
          locationId: 'us-east1',
        },
        {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                result: {
                  name: 'CIFS_SVR',
                  ad_domain: { password: 'echoed-secret-xyz', user: 'svc_account' },
                },
              }),
            },
          ],
        },
        100
      );

      const content = readLog();
      expect(content).not.toContain('echoed-secret-xyz');
      expect(content).toContain('[REDACTED]');
      expect(content).toContain('CIFS_SVR');
    });

    it('omits ontap_discover endpoint keywords from audit full response', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_discover',
        { search: 'peer' },
        {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                search: 'peer',
                endpoints: [
                  {
                    resource: 'cluster_peer',
                    keywords: ['cluster peering', 'intercluster'],
                    method: 'POST',
                    path: '/api/cluster/peers',
                    hint: 'Use intercluster LIF addresses.',
                  },
                ],
              }),
            },
          ],
        },
        100
      );

      const content = readLog();
      expect(content).toContain('POST');
      expect(content).toContain('/api/cluster/peers');
      expect(content).toContain('Use intercluster LIF addresses.');
      expect(content).not.toContain('cluster peering');
      expect(content).not.toContain('"keywords"');
    });

    it('leaves non-sensitive args (and invalid JSON strings) unchanged', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_execute',
        {
          method: 'GET',
          ontapApiPath: '/api/storage/volumes',
          storagePoolId: 'pool1',
          queryParams: 'not-valid-json-but-no-secrets',
        },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).toContain('not-valid-json-but-no-secrets');
      expect(content).not.toContain('[REDACTED]');
    });

    it('escapes Markdown table delimiters in logged parameter keys and values', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_execute',
        {
          method: 'GET',
          ontapApiPath: '/api/storage/volumes',
          'pipe|key': 'line1\nline2|tail',
        },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).toContain('| pipe&#124;key | line1<br>line2&#124;tail |');
    });

    it('displays userIntent as a query group heading', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_volume_list',
        {
          locationId: 'us-east4',
          storagePoolId: 'pool1',
          userIntent: 'User asked to list all volumes in the east4 pool',
        },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).toContain('## Query 1: User asked to list all volumes in the east4 pool');
      // userIntent now also appears in the per-operation parameter table for full traceability
      expect(content).toContain('| userIntent |');
    });

    it('groups operations with the same userIntent under one query heading', () => {
      enableAuditLog(testDir);
      const baseResult = { content: [{ type: 'text' as const, text: '{}' }] };
      const intent = 'Show cluster peering status';

      logOperation(
        'ontap_discover',
        { resource: 'cluster_peer', userIntent: intent },
        baseResult,
        50
      );
      logOperation(
        'ontap_execute',
        { method: 'GET', ontapApiPath: '/api/cluster/peers', userIntent: intent },
        baseResult,
        200
      );

      const content = readLog();
      const queryHeadings = content.match(/## Query \d+/g) ?? [];
      expect(queryHeadings).toHaveLength(1);
      expect(content).toContain('## Query 1: Show cluster peering status');
      expect(content).toContain('### 1. ontap_discover');
      expect(content).toContain('### 2. ontap_execute');
    });

    it('starts a new query group when userIntent changes', () => {
      enableAuditLog(testDir);
      const baseResult = { content: [{ type: 'text' as const, text: '{}' }] };

      logOperation(
        'ontap_discover',
        { resource: 'volume', userIntent: 'List volumes' },
        baseResult,
        50
      );
      logOperation(
        'ontap_execute',
        { method: 'GET', ontapApiPath: '/api/storage/volumes', userIntent: 'List volumes' },
        baseResult,
        200
      );
      logOperation(
        'ontap_discover',
        { resource: 'cluster_peer', userIntent: 'Check cluster peers' },
        baseResult,
        50
      );

      const content = readLog();
      const queryHeadings = content.match(/## Query \d+/g) ?? [];
      expect(queryHeadings).toHaveLength(2);
      expect(content).toContain('## Query 1: List volumes');
      expect(content).toContain('## Query 2: Check cluster peers');
    });

    it('omits userIntent from query heading when not provided', () => {
      enableAuditLog(testDir);
      logOperation(
        'ontap_volume_list',
        { locationId: 'us-east4', storagePoolId: 'pool1' },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      const content = readLog();
      expect(content).toContain('## Query 1\n');
      expect(content).not.toContain('## Query 1:');
    });

    it('does nothing when logging is disabled', () => {
      logOperation(
        'ontap_svm_list',
        { locationId: 'us-east1' },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );
      expect(getAuditLogPath()).toBeNull();
    });

    it('increments operation numbers sequentially', () => {
      enableAuditLog(testDir);
      const baseResult = { content: [{ type: 'text' as const, text: '{}' }] };

      logOperation('ontap_svm_list', {}, baseResult, 100);
      logOperation('ontap_volume_list', {}, baseResult, 100);
      logOperation('ontap_job_get', {}, baseResult, 100);

      const content = readLog();
      expect(content).toContain('### 1. ontap_svm_list');
      expect(content).toContain('### 2. ontap_volume_list');
      expect(content).toContain('### 3. ontap_job_get');
    });
  });

  describe('session summary', () => {
    it('includes failed operations table when there are errors', () => {
      enableAuditLog(testDir);

      logOperation(
        'ontap_svm_list',
        { storagePoolId: 'pool1', locationId: 'us-east1' },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );
      logOperation(
        'ontap_execute',
        {
          method: 'POST',
          ontapApiPath: '/api/storage/volumes',
          storagePoolId: 'pool1',
          locationId: 'us-east1',
        },
        { isError: true, content: [{ type: 'text', text: 'Volume creation failed' }] },
        500
      );
      logOperation(
        'ontap_volume_list',
        { storagePoolId: 'pool1', locationId: 'us-east1' },
        { content: [{ type: 'text', text: '{}' }] },
        100
      );

      disableAuditLog();
      const content = readLog();

      expect(content).toContain('User queries**: 1');
      expect(content).toContain('Total operations**: 3');
      expect(content).toContain('Successful**: 2');
      expect(content).toContain('Failed**: 1');
      expect(content).toContain('Failed Operations');
      expect(content).toContain('ontap_execute');
      expect(content).toContain('Pools used**: us-east1/pool1');
    });
  });

  describe('withAuditLog', () => {
    it('calls handler directly when logging is disabled', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      });

      const wrapped = withAuditLog(handler, 'test_tool');
      await wrapped({ foo: 'bar' });

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('logs operation when logging is enabled', async () => {
      enableAuditLog(testDir);

      const handler = vi.fn().mockResolvedValue({
        content: [
          { type: 'text', text: JSON.stringify({ result: { records: [{ name: 'v1' }] } }) },
        ],
      });

      const wrapped = withAuditLog(handler, 'ontap_volume_list');
      const result = await wrapped({ locationId: 'us-east1', storagePoolId: 'pool1' });

      expect(handler).toHaveBeenCalled();
      expect(result.content[0].text).toContain('records');

      const content = readLog();
      expect(content).toContain('ontap_volume_list');
      expect(content).toContain('1 record(s)');
    });

    it('logs wrapped operations only to the current MCP session', async () => {
      const sessionA = 'session-a';
      const sessionB = 'session-b';
      enableAuditLog(testDir, sessionA);
      enableAuditLog(testDir, sessionB);

      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"result":{"ok":true}}' }],
      });

      const wrapped = withAuditLog(handler, 'ontap_volume_list');
      await wrapped({ storagePoolId: 'pool-a' }, { sessionId: sessionA });
      await wrapped({ storagePoolId: 'pool-b' }, { sessionId: sessionB });

      expect(readLog(sessionA)).toContain('pool-a');
      expect(readLog(sessionA)).not.toContain('pool-b');
      expect(readLog(sessionB)).toContain('pool-b');
      expect(readLog(sessionB)).not.toContain('pool-a');
    });

    it('logs errors from handler', async () => {
      enableAuditLog(testDir);

      const handler = vi.fn().mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'Something went wrong' }],
      });

      const wrapped = withAuditLog(handler, 'ontap_execute');
      await wrapped({ method: 'POST', ontapApiPath: '/api/storage/volumes' });

      const content = readLog();
      expect(content).toContain('**ERROR**');
      expect(content).toContain('Something went wrong');
    });

    it('returns handler result when audit log write fails', async () => {
      const { chmodSync } = await import('fs');
      enableAuditLog(testDir);
      const logPath = getAuditLogPath();
      expect(logPath).toBeTruthy();
      chmodSync(logPath!, 0o444);

      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"result":{"ok":true}}' }],
      });

      try {
        const wrapped = withAuditLog(handler, 'ontap_volume_list');
        const result = await wrapped({});
        expect(result.content[0].text).toContain('ok');
        expect(handler).toHaveBeenCalled();
      } finally {
        chmodSync(logPath!, 0o644);
      }
    });
  });
});

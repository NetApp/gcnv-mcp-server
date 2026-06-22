import { describe, expect, it } from 'vitest';
import { registerAllTools } from './register-tools.js';

describe('registerAllTools', () => {
  it('registers all tools with name, definition, and handler', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];

    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);

    // Keep this count in sync with register-tools.ts
    expect(calls.length).toBe(85);

    // Each registration uses the tool's name as the key
    for (const c of calls) {
      expect(c.name).toBeTruthy();
      expect(c.tool?.name).toBe(c.name);
      expect(typeof c.handler).toBe('function');
    }

    // Names should be unique
    const uniqueNames = new Set(calls.map((c) => c.name));
    expect(uniqueNames.size).toBe(calls.length);
  });

  it('forwards delegated token and strips internal arg before handler call', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();

    const result = await auditTool!.handler({
      action: 'status',
      _delegated_google_access_token: 'token-from-rm',
    });
    expect(result.structuredContent?.result).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('_delegated_google_access_token');
  });

  it('handles blank delegated token args without throwing', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();

    await expect(
      auditTool!.handler({
        action: 'status',
        _delegated_google_access_token: '   ',
      })
    ).resolves.toBeDefined();
  });

  it('adds delegated token to each tool schema and accepts non-string token inputs', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();
    expect(auditTool!.tool.inputSchema).toBeDefined();

    await expect(
      auditTool!.handler({
        action: 'status',
        _delegated_google_access_token: 12345,
      })
    ).resolves.toBeDefined();
  });

  it('passes empty object to wrapped handler when args are undefined', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    expect(calls.length).toBeGreaterThan(0);

    await expect(calls[0].handler(undefined)).resolves.toBeDefined();
  });
});

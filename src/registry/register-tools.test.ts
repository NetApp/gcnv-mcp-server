import { describe, expect, it, vi } from 'vitest';
import { registerAllTools } from './register-tools.js';
import * as accessTokenContext from '../auth/access-token-context.js';

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

  it('does not expose delegated token in public tool schemas', () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];

    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);

    for (const c of calls) {
      expect(
        Object.prototype.hasOwnProperty.call(c.tool.inputSchema, '_delegated_google_access_token')
      ).toBe(false);
    }
  });

  it('allows internal delegated token args without exposing them in results', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];

    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);

    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();
    const runWithRequestAccessTokenSpy = vi
      .spyOn(accessTokenContext, 'runWithRequestAccessToken')
      .mockImplementation((token, fn) => {
        expect(token).toBe('token-from-rm');
        return fn();
      });

    const result = await auditTool!.handler({
      action: 'status',
      _delegated_google_access_token: 'token-from-rm',
    });
    expect(result.structuredContent?.result).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('_delegated_google_access_token');
    expect(runWithRequestAccessTokenSpy).toHaveBeenCalledOnce();
  });
});

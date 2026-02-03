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
    expect(calls.length).toBe(69);

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
});

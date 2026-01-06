import { describe, expect, it, afterEach } from 'vitest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandler } from '../types/tool.js';
import {
  clearToolRegistry,
  getAllToolDefinitions,
  getToolHandler,
  registerTool,
  toolRegistry,
} from './tool-registry.js';

describe('tool-registry', () => {
  afterEach(() => {
    clearToolRegistry();
  });

  it('registerTool stores tool definition and handler by name', async () => {
    const tool: Tool = {
      name: 'test.tool',
      description: 'test tool',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };

    const handler: ToolHandler = async () => ({ content: [{ type: 'text', text: 'ok' }] });

    registerTool(tool, handler);

    expect(toolRegistry['test.tool']).toEqual(tool);
    expect(getToolHandler('test.tool')).toBe(handler);
  });

  it('getAllToolDefinitions returns all registered tools', async () => {
    const toolA: Tool = {
      name: 'test.a',
      description: 'a',
      inputSchema: { type: 'object', properties: {} },
    };
    const toolB: Tool = {
      name: 'test.b',
      description: 'b',
      inputSchema: { type: 'object', properties: {} },
    };

    const handler: ToolHandler = async () => ({ content: [{ type: 'text', text: 'ok' }] });

    registerTool(toolA, handler);
    registerTool(toolB, handler);

    const defs = getAllToolDefinitions()
      .map((t) => t.name)
      .sort();
    expect(defs).toEqual(['test.a', 'test.b']);
  });
});

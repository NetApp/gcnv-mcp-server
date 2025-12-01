import { describe, expect, it } from 'vitest';

import {
  getAllToolDefinitions,
  getToolHandler,
  registerTool,
  toolRegistry,
} from '../src/registry/tool-registry.js';

const sampleTool = {
  name: 'example-tool',
  description: 'A sample tool',
  inputSchema: {},
  outputSchema: {},
  title: 'Example',
};

describe('tool-registry', () => {
  it('registers tool definitions and handlers', () => {
    const handler = () => undefined;

    registerTool(sampleTool, handler);

    expect(toolRegistry[sampleTool.name]).toBe(sampleTool);
    expect(getAllToolDefinitions()).toContain(sampleTool);
    expect(getToolHandler(sampleTool.name)).toBe(handler);
  });
});


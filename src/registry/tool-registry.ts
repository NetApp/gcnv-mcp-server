/**
 * Tool Registry for GCNV MCP Server
 * Registers all available tools and their handlers
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolHandler } from '../types/tool.js';

// Registry of all tools
export const toolRegistry: Record<string, Tool> = {};

// Map of tool names to handler functions
const toolHandlers: Record<string, ToolHandler> = {};

/**
 * Register a tool and its handler in the registry
 */
export function registerTool(tool: Tool, handler: ToolHandler): void {
  toolRegistry[tool.name] = tool;
  toolHandlers[tool.name] = handler;
}

/**
 * Get all tool definitions
 */
export function getAllToolDefinitions(): Tool[] {
  return Object.values(toolRegistry);
}

/**
 * Get a handler function for a tool
 */
export function getToolHandler(toolName: string): ToolHandler | undefined {
  return toolHandlers[toolName];
}

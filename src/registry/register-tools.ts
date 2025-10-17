/**
 * Tool Registration Utility
 * 
 * Registers all tool definitions and their handlers to the tool registry
 */

import { registerTool } from "./tool-registry.js";
import { z } from 'zod';
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { greetUserTool } from "../tools/greet-tools.js";
import { greetHandler } from "../tools/handlers/greet-handler.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register all tools and their handlers to the tool registry
 */
export function registerAllTools(mcpServer: McpServer) {
  // Register tools
    mcpServer.registerTool(greetUserTool.name, greetUserTool, greetHandler);
      
}
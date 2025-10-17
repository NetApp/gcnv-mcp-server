/**
 * Tool Registration Utility
 * 
 * Registers all tool definitions and their handlers to the tool registry
 */

import { greetUserTool } from "../tools/greet-tools.js";
import { greetHandler } from "../tools/handlers/greet-handler.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  createStoragePoolTool,
  deleteStoragePoolTool,
  getStoragePoolTool,
  listStoragePoolsTool,
  updateStoragePoolTool
} from "../tools/storage-pool-tools.js";
import {
  createStoragePoolHandler,
  deleteStoragePoolHandler,
  getStoragePoolHandler,
  listStoragePoolsHandler,
  updateStoragePoolHandler
} from "../tools/handlers/storage-pool-handler.js";

/**
 * Register all tools and their handlers to the tool registry
 */
export function registerAllTools(mcpServer: McpServer) {
  // Register greet tool
  mcpServer.registerTool(greetUserTool.name, greetUserTool, greetHandler);
  
  // Register storage pool tools
  mcpServer.registerTool(createStoragePoolTool.name, createStoragePoolTool, createStoragePoolHandler);
  mcpServer.registerTool(deleteStoragePoolTool.name, deleteStoragePoolTool, deleteStoragePoolHandler);
  mcpServer.registerTool(getStoragePoolTool.name, getStoragePoolTool, getStoragePoolHandler);
  mcpServer.registerTool(listStoragePoolsTool.name, listStoragePoolsTool, listStoragePoolsHandler);
  mcpServer.registerTool(updateStoragePoolTool.name, updateStoragePoolTool, updateStoragePoolHandler);
}
/**
 * Tool Registration Utility
 * 
 * Registers all tool definitions and their handlers to the tool registry
 */
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
import {
  createVolumeTool,
  deleteVolumeTool,
  getVolumeTool,
  listVolumesTool,
  updateVolumeTool
} from "../tools/volume-tools.js";
import {
  createVolumeHandler,
  deleteVolumeHandler,
  getVolumeHandler,
  listVolumesHandler,
  updateVolumeHandler
} from "../tools/handlers/volume-handler.js";
import {
  getOperationTool,
  cancelOperationTool,
  listOperationsTool
} from "../tools/operation-tools.js";
import {
  getOperationHandler,
  cancelOperationHandler,
  listOperationsHandler
} from "../tools/handlers/operation-handler.js";

/**
 * Register all tools and their handlers to the tool registry
 */
export function registerAllTools(mcpServer: McpServer) {
  // Register storage pool tools
  mcpServer.registerTool(createStoragePoolTool.name, createStoragePoolTool, createStoragePoolHandler);
  mcpServer.registerTool(deleteStoragePoolTool.name, deleteStoragePoolTool, deleteStoragePoolHandler);
  mcpServer.registerTool(getStoragePoolTool.name, getStoragePoolTool, getStoragePoolHandler);
  mcpServer.registerTool(listStoragePoolsTool.name, listStoragePoolsTool, listStoragePoolsHandler);
  mcpServer.registerTool(updateStoragePoolTool.name, updateStoragePoolTool, updateStoragePoolHandler);
  
  // Register volume tools
  mcpServer.registerTool(createVolumeTool.name, createVolumeTool, createVolumeHandler);
  mcpServer.registerTool(deleteVolumeTool.name, deleteVolumeTool, deleteVolumeHandler);
  mcpServer.registerTool(getVolumeTool.name, getVolumeTool, getVolumeHandler);
  mcpServer.registerTool(listVolumesTool.name, listVolumesTool, listVolumesHandler);
  mcpServer.registerTool(updateVolumeTool.name, updateVolumeTool, updateVolumeHandler);
  
  // Register operation tools
  mcpServer.registerTool(getOperationTool.name, getOperationTool, getOperationHandler);
  mcpServer.registerTool(cancelOperationTool.name, cancelOperationTool, cancelOperationHandler);
  mcpServer.registerTool(listOperationsTool.name, listOperationsTool, listOperationsHandler);
}
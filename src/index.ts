#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './registry/register-tools.js';

async function startStdioTransport(mcpServer: McpServer) {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('MCP Server listening on stdio');
    await new Promise<void>((resolve, reject) => {
        const originalClose = transport.onclose;
        transport.onclose = () => {
            originalClose?.();
            resolve();
        };
        const originalError = transport.onerror;
        transport.onerror = (error) => {
            originalError?.(error);
            reject(error);
        };
    });
}

async function main() {
    const mcpServer = new McpServer({
        name: 'gcnv-mcp',
        version: '1.0.0',
    });

    registerAllTools(mcpServer);

    await startStdioTransport(mcpServer);
}

main().catch(error => {
    console.error('Fatal server error:', error);
    process.exit(1);
});
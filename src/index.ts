import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { registerAllTools } from './registry/register-tools.js';


function main() {
    const mcpServer = new McpServer({
        name: 'gcnv-mcp-local',
        version: '1.0.0',
    });

    registerAllTools(mcpServer);
    
    const app = express();
    app.use(express.json());
    app.post('/mcp', async (req, res) => {
        // Create a new transport for each request to prevent request ID collisions
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        });
    
        res.on('close', () => {
            transport.close();
        });
    
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });


    const port = parseInt(process.env.PORT || '3001');
    app.listen(port, () => {
        console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
    }).on('error', error => {
        console.error('Server error:', error);
        process.exit(1);
    });
}


main();
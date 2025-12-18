#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { registerAllTools } from './registry/register-tools.js';
import { logger } from './logger.js';

const log = logger.child({});

async function startStdioTransport(mcpServer: McpServer) {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  log.info('MCP Server listening on stdio');
  await new Promise<void>((resolve, reject) => {
    const originalClose = transport.onclose;
    transport.onclose = () => {
      originalClose?.();
      resolve();
    };
    const originalError = transport.onerror;
    transport.onerror = (error) => {
      originalError?.(error);

      // The stdio transport will throw a SyntaxError if it receives a blank
      // line or otherwise malformed JSON on stdin (for example when a user
      // accidentally hits Enter). Those are non-fatal and can be safely
      // ignored; keep the server alive and just log a warning.
      const message = error instanceof Error ? (error.message ?? '') : '';
      if (error instanceof SyntaxError && message.includes('Unexpected end of JSON input')) {
        log.debug({ err: error }, 'Ignored malformed/empty JSON on stdio');
        return;
      }

      log.error({ err: error }, 'Error on stdio transport');
      reject(error);
    };
  });
}

async function startHttpTransport(mcpServerTemplate: McpServer, port: number = 3000) {
  const http = await import('http');

  // Store transports by session ID to route POST requests
  const transports: Map<string, SSEServerTransport> = new Map();

  const server = http.createServer((req, res) => {
    // Handle GET request to establish SSE stream
    if (req.method === 'GET' && req.url === '/message') {
      void (async () => {
        try {
          // Create a new server instance for each connection to avoid conflicts
          const connectionServer = new McpServer({
            name: 'gcnv-mcp',
            version: '1.0.0',
          });

          // Register tools for this connection
          registerAllTools(connectionServer);

          // Create transport with the response object (not the server)
          const transport = new SSEServerTransport('/message', res);

          // Store transport by session ID for POST message routing
          const sessionId = transport.sessionId;
          transports.set(sessionId, transport);

          // Set up cleanup handler
          transport.onclose = () => {
            transports.delete(sessionId);
          };

          // Connect the server to the transport (this automatically calls start())
          await connectionServer.connect(transport);
        } catch (error) {
          log.error({ err: error }, 'Error handling HTTP connection');
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          }
        }
      })();
    }
    // Handle POST request to receive messages
    else if (req.method === 'POST' && req.url?.startsWith('/message')) {
      try {
        // Extract session ID from query parameter
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing sessionId parameter');
          return;
        }

        const transport = transports.get(sessionId);
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Session not found');
          return;
        }

        // Parse request body
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          void (async () => {
            try {
              const parsedBody = body ? JSON.parse(body) : undefined;
              await transport.handlePostMessage(req, res, parsedBody);
            } catch (error) {
              log.error({ err: error }, 'Error handling POST message');
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error handling request');
              }
            }
          })();
        });
      } catch (error) {
        log.error({ err: error }, 'Error handling POST request');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    log.info({ port }, `MCP Server listening on http://localhost:${port}/message`);
  });

  await new Promise<void>((resolve, reject) => {
    server.on('close', () => {
      resolve();
    });
    server.on('error', (error) => {
      reject(error);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      server.close(() => {
        resolve();
      });
    });
    process.on('SIGTERM', () => {
      server.close(() => {
        resolve();
      });
    });
  });
}

function parseArgs(): { transport: 'stdio' | 'http'; port?: number } {
  const args = process.argv.slice(2);
  let transport: 'stdio' | 'http' = 'stdio';
  let port: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--transport' || args[i] === '-t') {
      const value = args[i + 1];
      if (value === 'http' || value === 'stdio') {
        transport = value;
        i++;
      }
    } else if (args[i] === '--port' || args[i] === '-p') {
      const value = parseInt(args[i + 1], 10);
      if (!isNaN(value)) {
        port = value;
        i++;
      }
    }
  }

  return { transport, port };
}

async function main() {
  const { transport, port } = parseArgs();

  const mcpServer = new McpServer({
    name: 'gcnv-mcp',
    version: '1.0.0',
  });

  registerAllTools(mcpServer);

  if (transport === 'http') {
    await startHttpTransport(mcpServer, port);
  } else {
    await startStdioTransport(mcpServer);
  }
}

main().catch((error) => {
  log.fatal({ err: error }, 'Fatal server error');
  process.exit(1);
});

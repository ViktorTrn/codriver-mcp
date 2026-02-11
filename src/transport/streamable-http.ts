/**
 * Streamable HTTP Transport
 * Provides remote MCP access via HTTP/SSE using the official MCP SDK transport.
 * Supports session management, API-key auth, and DNS rebinding protection.
 */

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Request, Response, NextFunction } from 'express';

export interface HttpTransportOptions {
  /** Port to listen on. Default: 3100 */
  port: number;
  /** Hostname to bind to. Default: '127.0.0.1' (localhost only) */
  host: string;
  /** API key for authentication. If set, all requests must include Bearer token. */
  apiKey?: string;
}

/**
 * Start the MCP server with Streamable HTTP transport.
 * Provides remote access via HTTP POST (requests) and GET (SSE stream).
 */
export async function startHttpTransport(
  server: McpServer,
  options: HttpTransportOptions
): Promise<void> {
  const { port, host, apiKey } = options;

  // Create Express app with MCP DNS rebinding protection
  const app = createMcpExpressApp({ host });

  // API key authentication middleware
  if (apiKey) {
    app.use('/mcp', (req: Request, res: Response, next: NextFunction) => {
      // Allow DELETE without auth (session cleanup)
      if (req.method === 'DELETE') {
        next();
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        res.status(401).json({ error: 'Unauthorized. Provide Authorization: Bearer <api-key>' });
        return;
      }
      next();
    });
  }

  // Create stateful transport with session management
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // Wire up Express routes to transport
  app.post('/mcp', async (req: Request, res: Response) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req: Request, res: Response) => {
    await transport.handleRequest(req, res);
  });

  app.delete('/mcp', async (req: Request, res: Response) => {
    await transport.handleRequest(req, res);
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', server: 'codriver-mcp', transport: 'streamable-http' });
  });

  // Connect server to transport
  await server.connect(transport);

  // Start listening
  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.error(`CoDriver MCP server started (HTTP transport)`);
      console.error(`  Endpoint: http://${host}:${port}/mcp`);
      console.error(`  Health:   http://${host}:${port}/health`);
      if (apiKey) {
        console.error(`  Auth:     API key required (Bearer token)`);
      }
      resolve();
    });
  });
}

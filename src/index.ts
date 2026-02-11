#!/usr/bin/env node

/**
 * CoDriver MCP - Entry Point
 *
 * AI-powered Desktop Automation via Model Context Protocol.
 * Lets Claude control any desktop application through screenshots,
 * accessibility trees, and input injection.
 *
 * Usage:
 *   codriver-mcp              Start with stdio transport (default)
 *   codriver-mcp --http       Start with HTTP transport (remote)
 *   codriver-mcp --help       Show help
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { startHttpTransport } from './transport/streamable-http.js';

interface CliArgs {
  help: boolean;
  version: boolean;
  http: boolean;
  port: number;
  host: string;
  apiKey?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    help: false,
    version: false,
    http: false,
    port: 3100,
    host: '127.0.0.1',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-v':
        args.version = true;
        break;
      case '--http':
        args.http = true;
        break;
      case '--port':
        args.port = parseInt(argv[++i], 10);
        break;
      case '--host':
        args.host = argv[++i];
        break;
      case '--api-key':
        args.apiKey = argv[++i];
        break;
    }
  }

  // Also check environment variable for API key
  if (!args.apiKey && process.env.CODRIVER_API_KEY) {
    args.apiKey = process.env.CODRIVER_API_KEY;
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
CoDriver MCP - AI-powered Desktop Automation

Usage:
  codriver-mcp                        Start MCP server (stdio transport)
  codriver-mcp --http                 Start MCP server (HTTP transport)
  codriver-mcp --http --port 8080     Custom port (default: 3100)
  codriver-mcp --http --host 0.0.0.0  Bind to all interfaces
  codriver-mcp --http --api-key KEY   Require API key authentication

Options:
  --http              Use HTTP/SSE transport instead of stdio
  --port <number>     Port for HTTP transport (default: 3100)
  --host <address>    Host to bind to (default: 127.0.0.1)
  --api-key <key>     API key for authentication (or set CODRIVER_API_KEY env var)
  --version, -v       Show version
  --help, -h          Show this help

Environment Variables:
  CODRIVER_API_KEY    API key for HTTP transport authentication

Configuration in Claude Code (~/.claude/settings.json):
  {
    "mcpServers": {
      "codriver": {
        "command": "npx",
        "args": ["codriver-mcp"]
      }
    }
  }

Remote Configuration (HTTP transport):
  {
    "mcpServers": {
      "codriver-remote": {
        "url": "http://localhost:3100/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_API_KEY"
        }
      }
    }
  }
`);
    process.exit(0);
  }

  if (args.version) {
    console.log('codriver-mcp v0.3.0');
    process.exit(0);
  }

  // Create MCP server with all tools
  const server = createServer();

  if (args.http) {
    // HTTP/SSE transport for remote access
    await startHttpTransport(server, {
      port: args.port,
      host: args.host,
      apiKey: args.apiKey,
    });
  } else {
    // Default: stdio transport for local Claude Code
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('CoDriver MCP server started (stdio transport)');
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

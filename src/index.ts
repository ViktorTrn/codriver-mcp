#!/usr/bin/env node

/**
 * CoDriver MCP - Entry Point
 *
 * AI-powered Desktop Automation via Model Context Protocol.
 * Lets Claude control any desktop application through screenshots,
 * accessibility trees, and input injection.
 *
 * Usage:
 *   npx codriver-mcp          # Start with stdio transport (default)
 *   npx codriver-mcp --help   # Show help
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
CoDriver MCP - AI-powered Desktop Automation

Usage:
  codriver-mcp              Start MCP server (stdio transport)
  codriver-mcp --version    Show version
  codriver-mcp --help       Show this help

Configuration in Claude Code (~/.claude/settings.json):
  {
    "mcpServers": {
      "codriver": {
        "command": "npx",
        "args": ["codriver-mcp"]
      }
    }
  }
`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('codriver-mcp v0.1.0');
    process.exit(0);
  }

  // Create MCP server with all tools
  const server = createServer();

  // Connect via stdio transport (default)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('CoDriver MCP server started (stdio transport)');
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

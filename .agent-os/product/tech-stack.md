# CoDriver MCP - Tech Stack

## Core

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Runtime |
| TypeScript | 5.7+ | Language (strict mode) |
| ES Modules | ESNext | Module system |

## MCP Protocol

| Package | Version | Purpose |
|---------|---------|---------|
| @modelcontextprotocol/server | ^2.0.0 | MCP Server SDK |
| zod | ^3.24 | Schema validation for tool inputs/outputs |

## Desktop Automation

| Package | Version | Purpose |
|---------|---------|---------|
| @nut-tree/nut-js | ^4.2 | Mouse, Keyboard, Screen, Window automation |
| screenshot-desktop | ^1.15 | Fast desktop screenshots |
| sharp | ^0.33 | Image processing (resize, compress, crop) |

## Accessibility (Phase 2)

| Technology | Platform | Purpose |
|-----------|----------|---------|
| Windows UI Automation | Windows | Native accessibility tree |
| node-ffi-napi | Windows | FFI bridge to Win32 API |
| macOS Accessibility | macOS | AX API for UI elements |

## OCR (Phase 4)

| Package | Version | Purpose |
|---------|---------|---------|
| tesseract.js | ^5.0 | Client-side OCR for apps without a11y |

## Development

| Tool | Version | Purpose |
|------|---------|---------|
| vitest | ^2.0 | Unit testing |
| tsx | ^4.0 | TypeScript execution (dev mode) |
| eslint | ^9.0 | Linting |

## Transport

| Method | Use Case |
|--------|----------|
| stdio | Local MCP connection (default) |
| WebSocket | Remote connection (Phase 3) |
| SSH Tunnel | Secure remote (Phase 3) |

## Decisions

### Why Node.js (not Python)?
- MCP SDK is Node.js-native (`@modelcontextprotocol/server`)
- TypeScript provides strong typing for tool schemas
- nut-js is actively maintained and cross-platform
- Same ecosystem as Claude Code

### Why nut-js (not robotjs)?
- robotjs is unmaintained (last release 2020)
- nut-js v4 is actively developed with TypeScript support
- Better cross-platform support (Windows, macOS, Linux)
- Built-in screen, mouse, keyboard, window APIs

### Why screenshot-desktop + sharp (not nut-js screen)?
- screenshot-desktop is faster for full-screen captures
- sharp provides efficient image compression (important for MCP transfer)
- Can crop and resize before sending (reduce bandwidth)

### Why stdio transport first?
- Simplest setup (no network config)
- Works with `claude --mcp` natively
- Remote transport (WebSocket) added in Phase 3
